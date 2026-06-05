import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import type { ConnectParams, ForwardParams, MeshProfile } from '@zt-virtual-env/shared';
import { SessionManager } from './session-manager.js';
import { KtctlService } from './ktctl-service.js';
import { K8sService } from './k8s-service.js';
import { loadConfig, saveConfig } from './config-store.js';
import { getBundledBinary } from './binary-resolver.js';
import { HelperClient, buildConnectMessage } from './helper-client.js';
import { isHelperRunning, launchHelperElevated } from './helper-launcher.js';
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
    title: 'zt-virtual-env',
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

function registerIpc(): void {
  ipcMain.handle('config:get', () => loadConfig());
  ipcMain.handle('config:save', (_e, cfg) => saveConfig(cfg));
  ipcMain.handle('app:versions', () => ({
    app: app.getVersion(),
    ktctl: versions.ktctl.version,
    kubectl: versions.kubectl.version,
  }));

  ipcMain.handle('k8s:testConnection', () => k8s().testConnection());
  ipcMain.handle('k8s:listProfiles', async () => {
    meshProfileCache = await k8s().listMeshProfiles();
    return meshProfileCache;
  });
  ipcMain.handle('k8s:listNamespaces', () => k8s().listNamespaces());
  ipcMain.handle('k8s:listServices', (_e, ns: string) => k8s().listServices(ns));
  ipcMain.handle('k8s:listContexts', () => k8s().listContexts());

  ipcMain.handle('forward:start', (_e, params: ForwardParams) => ktctlService.startForward(params));
  ipcMain.handle('mesh:start', (_e, profileKey: string, localPort: number) => {
    const profile = meshProfileCache.find(
      (p) => `${p.namespace}/${p.deploymentName}` === profileKey,
    );
    if (!profile) throw new Error('未找到工作负载，请先刷新列表');
    return ktctlService.startMesh(profile, localPort);
  });

  ipcMain.handle('connect:start', async (_e, params: ConnectParams) => {
    if (!(await isHelperRunning())) {
      await launchHelperElevated();
    }
    helperClient = new HelperClient();
    await helperClient.connect();
    const ktctlPath = getBundledBinary('ktctl');
    const session = sessions.create({
      type: 'connect',
      target: params.namespace,
      namespace: params.namespace,
      command: `ktctl connect --namespace ${params.namespace}`,
    });
    connectSessionId = session.id;
    sessions.markStarting(session.id);
    helperClient.onMessage((msg) => {
      if (msg.event === 'log') sessions.appendLog(session.id, msg.line);
      if (msg.event === 'status') {
        if (msg.state === 'running') sessions.markRunning(session.id, 0);
        if (msg.state === 'failed') sessions.markFailed(session.id);
        if (msg.state === 'stopped') sessions.markStopped(session.id);
      }
    });
    helperClient.send(buildConnectMessage(ktctlPath, params));
    return session.id;
  });

  ipcMain.handle('connect:stop', async () => {
    if (helperClient) {
      helperClient.send({ cmd: 'disconnect' });
      helperClient.close();
      helperClient = null;
    }
    if (connectSessionId) {
      sessions.markStopped(connectSessionId);
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
      sessions.markStopped(id);
      connectSessionId = null;
      return;
    }
    ktctlService.stopSession(id);
  });
  ipcMain.handle('sessions:stopAll', async () => {
    ktctlService.stopAll();
    if (connectSessionId) {
      helperClient?.send({ cmd: 'disconnect' });
      helperClient?.close();
      sessions.markStopped(connectSessionId);
      connectSessionId = null;
    }
  });

  ipcMain.handle('ktctl:recover', (_e, target: string, ns: string) => ktctlService.recover(target, ns));
  ipcMain.handle('ktctl:clean', () => ktctlService.clean());
  ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url));
}

app.whenReady().then(() => {
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
    ktctlService.stopAll();
    helperClient?.send({ cmd: 'shutdown' });
    app.exit(0);
  }
});
