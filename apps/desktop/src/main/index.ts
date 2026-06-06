import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { ConnectParams, ForwardParams, MeshProfile, SessionType } from '@kt-virtual-env/shared';
import { SessionManager } from './session-manager.js';
import { KtctlService } from './ktctl-service.js';
import { K8sService } from './k8s-service.js';
import { ensureConfigReady, loadConfig, saveConfig } from './config-store.js';
import { getBundledBinary } from './binary-resolver.js';
import { HelperClient, buildConnectMessage } from './helper-client.js';
import { isHelperRunning, launchHelperElevated } from './helper-launcher.js';
import { stageKubeconfigForElevated, stageKtctlForElevated } from './elevated-binary-staging.js';
import { ensureUserKtReady, getElevatedKtHome } from './kt-state.js';
import { defaultChromeExtensionsDir } from './stain-extensions.js';
import {
  closeAllStainBrowsers,
  closeStainBrowser,
  focusStainBrowser,
  listStainBrowsers,
  openStainBrowser,
  toggleStainBrowserDevTools,
} from './stain-browser.js';
import { checkEnvironment } from './environment-check.js';
import {
  checkConnectHealth,
  checkSessionHealth,
  checkSessionsHealth,
} from './health-check.js';
import {
  discoverLocalDevPorts,
  pickMeshLocalPort,
  validateMeshLocalPort,
} from './local-dev-ports.js';
import { pickAvailableLocalPort } from './port-picker.js';
import fs from 'node:fs';

const versions = (() => {
  const candidates = [
    path.join(app.getAppPath(), '../../resources/versions.json'),
    path.join(process.cwd(), '../../resources/versions.json'),
    path.join(process.cwd(), 'resources/versions.json'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as {
        ktctl: { version: string };
        kubectl: { version: string };
      };
    }
  }
  return { ktctl: { version: '0.3.7' }, kubectl: { version: '1.28.15' } };
})();

let mainWindow: BrowserWindow | null = null;
const sessions = new SessionManager();
const ktctlService = new KtctlService(sessions);
let meshProfileCache: MeshProfile[] = [];
let connectSessionId: string | null = null;
let helperClient: HelperClient | null = null;

function k8s(): K8sService {
  const cfg = loadConfig();
  return new K8sService(cfg.kubeconfig, cfg.context);
}

function broadcastSessions(): void {
  mainWindow?.webContents.send('sessions:update', sessions.list());
}

sessions.onChange(() => broadcastSessions());

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Kubernetes 虚拟环境工作台',
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  mainWindow.webContents.on('preload-error', (_e, preloadPath, error) => {
    console.error('preload 加载失败:', preloadPath, error);
  });
  if (process.env.NODE_ENV_ELECTRON_VITE === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('页面加载失败:', code, desc, url);
  });
}

function registerIpc(): void {
  ipcMain.handle('config:get', () => loadConfig());
  ipcMain.handle('config:save', async (_e, cfg) => saveConfig(cfg));
  ipcMain.handle('config:pickKubeconfig', async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      properties: ['openFile'],
      filters: [{ name: 'Kubeconfig', extensions: ['yaml', 'yml'] }, { name: 'All', extensions: ['*'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  ipcMain.handle('app:versions', () => ({
    app: app.getVersion(),
    ktctl: versions.ktctl.version,
    kubectl: versions.kubectl.version,
  }));
  ipcMain.handle('app:checkEnvironment', () => checkEnvironment());

  ipcMain.handle('k8s:testConnection', () => k8s().testConnection());
  ipcMain.handle('k8s:listProfiles', async () => {
    meshProfileCache = await k8s().listMeshProfiles();
    return meshProfileCache;
  });
  ipcMain.handle(
    'k8s:searchProfiles',
    (_e, virtualEnvQuery: string, ns?: string, deployQuery?: string) =>
      k8s().searchMeshProfiles(virtualEnvQuery, ns, deployQuery),
  );
  ipcMain.handle('k8s:listNamespaces', () => k8s().listNamespaces());
  ipcMain.handle('k8s:listServices', (_e, ns: string) => k8s().listServices(ns));
  ipcMain.handle('k8s:searchServices', (_e, query: string, ns?: string) =>
    k8s().searchServices(query, ns),
  );
  ipcMain.handle('k8s:listContexts', () => k8s().listContexts());

  ipcMain.handle('health:checkConnect', async () => {
    const session = connectSessionId ? sessions.get(connectSessionId) : undefined;
    return checkConnectHealth(session, await isHelperRunning(), k8s());
  });
  ipcMain.handle('health:checkSession', async (_e, id: string) =>
    checkSessionHealth(sessions.get(id), ktctlService),
  );
  ipcMain.handle('health:checkSessionsByType', async (_e, type: SessionType) => {
    const list = sessions.list().filter((s) => s.type === type && s.state !== 'stopped');
    return checkSessionsHealth(list, ktctlService);
  });

  ipcMain.handle(
    'system:pickLocalPort',
    async (_e, reserved: number[], preferred: number) =>
      pickAvailableLocalPort(reserved, preferred),
  );
  ipcMain.handle('system:listLocalDevPorts', () => discoverLocalDevPorts());
  ipcMain.handle('system:pickMeshLocalPort', async (_e, profile: MeshProfile, reserved: number[]) => {
    const hit = await pickMeshLocalPort(profile, reserved);
    return hit;
  });
  ipcMain.handle('system:validateMeshLocalPort', async (_e, port: number) => {
    await validateMeshLocalPort(port);
  });

  ipcMain.handle('forward:start', async (_e, params: ForwardParams) => {
    await ensureUserKtReady();
    return ktctlService.startForward(params);
  });
  ipcMain.handle(
    'mesh:start',
    async (_e, profile: MeshProfile, localPort: number, userId?: string) => {
      await ensureUserKtReady();
      const cfg = loadConfig();
      const id = (userId ?? cfg.meshUserId).trim();
      if (!id) {
        throw new Error('请先在配置页填写个人标识');
      }
      return ktctlService.startMesh(profile, localPort, id);
    },
  );

  ipcMain.handle('connect:start', async (_e, params: ConnectParams) => {
    if (!(await isHelperRunning())) {
      await launchHelperElevated();
    }
    helperClient = new HelperClient();
    await helperClient.connect();
    const ktctlPath = stageKtctlForElevated(getBundledBinary('ktctl'));
    const elevatedParams: ConnectParams = {
      ...params,
      kubeconfig: stageKubeconfigForElevated(params.kubeconfig),
    };
    const session = sessions.create({
      type: 'connect',
      target: params.namespace,
      namespace: params.namespace,
      command: `ktctl connect --namespace ${params.namespace}`,
    });
    connectSessionId = session.id;
    await saveConfig({ connectDnsNamespaces: params.dnsNamespaces });
    sessions.markStarting(session.id);
    helperClient.onMessage((msg) => {
      if (msg.event === 'log') sessions.appendLog(session.id, msg.line);
      if (msg.event === 'status') {
        if (msg.state === 'running') sessions.markRunning(session.id, 0);
        if (msg.state === 'failed') sessions.markFailed(session.id);
        if (msg.state === 'stopped') {
          sessions.remove(session.id);
          if (connectSessionId === session.id) connectSessionId = null;
        }
      }
    });
    helperClient.send(buildConnectMessage(ktctlPath, elevatedParams, getElevatedKtHome()));
    return session.id;
  });

  ipcMain.handle('connect:stop', async () => {
    if (helperClient) {
      helperClient.send({ cmd: 'disconnect' });
      helperClient.close();
      helperClient = null;
    }
    if (connectSessionId) {
      sessions.remove(connectSessionId);
      connectSessionId = null;
    }
  });

  ipcMain.handle('helper:status', async () => ({ running: await isHelperRunning() }));
  ipcMain.handle('helper:authorize', async () => {
    await launchHelperElevated();
    return { running: await isHelperRunning() };
  });

  ipcMain.handle('sessions:list', () => sessions.list());
  ipcMain.handle('sessions:stop', async (_e, id: string) => {
    const s = sessions.get(id);
    if (s?.type === 'connect') {
      helperClient?.send({ cmd: 'disconnect' });
      helperClient?.close();
      helperClient = null;
      sessions.remove(id);
      connectSessionId = null;
      return;
    }
    await ktctlService.stopSession(id);
  });
  ipcMain.handle('sessions:stopAll', async () => {
    await ktctlService.stopAll();
    if (connectSessionId) {
      helperClient?.send({ cmd: 'disconnect' });
      helperClient?.close();
      sessions.remove(connectSessionId);
      connectSessionId = null;
    }
  });

  ipcMain.handle('ktctl:recover', (_e, target: string, ns: string) => ktctlService.recover(target, ns));
  ipcMain.handle('ktctl:clean', () => ktctlService.clean());
  ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url));

  ipcMain.handle('stain:open', async (_e, url: string, virtualEnv: string) => {
    const cfg = loadConfig();
    return openStainBrowser(url, virtualEnv, {
      devTools: cfg.stainDevTools,
      extensionPaths: cfg.stainExtensionPaths,
    });
  });
  ipcMain.handle('stain:pickExtensionDir', async () => {
    const chromeDir = defaultChromeExtensionsDir();
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: chromeDir && fs.existsSync(chromeDir) ? chromeDir : undefined,
      title: '选择解压后的 Chrome 扩展目录（含 manifest.json）',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0] ?? null;
  });
  ipcMain.handle('stain:list', () => listStainBrowsers());
  ipcMain.handle('stain:close', (_e, id: string) => {
    closeStainBrowser(id);
  });
  ipcMain.handle('stain:closeAll', () => {
    closeAllStainBrowsers();
  });
  ipcMain.handle('stain:focus', (_e, id: string) => {
    focusStainBrowser(id);
  });
  ipcMain.handle('stain:toggleDevTools', (_e, id: string) => {
    toggleStainBrowserDevTools(id);
  });
}

app.whenReady().then(() => {
  void ensureUserKtReady().catch((err: unknown) => {
    console.warn('~/.kt 权限修复失败，端口转发可能不可用:', err);
  });
  void ensureConfigReady().catch((err: unknown) => {
    console.warn('~/.kt-virtual-env 权限修复失败，配置保存可能不可用:', err);
  });
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', (e) => {
  const running = sessions.list().filter((s) => s.state === 'running');
  if (running.length > 0) {
    e.preventDefault();
    mainWindow?.webContents.send('app:confirmExit', running.length);
  }
});

ipcMain.handle('app:forceQuit', async (_e, action: 'stopAll' | 'cancel') => {
  if (action === 'stopAll') {
    await ktctlService.clean();
    await ktctlService.stopAll();
    helperClient?.send({ cmd: 'shutdown' });
    app.exit(0);
  }
});
