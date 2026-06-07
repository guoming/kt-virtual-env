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
  CHROME_WEB_STORE_HOME,
  installExtensionFromChromeWebStore,
  installExtensionFromCrxFile,
  listLocalChromeExtensions,
} from './stain-extension-store.js';
import {
  closeAllStainBrowsers,
  closeStainBrowser,
  focusStainBrowser,
  listStainBrowsers,
  openStainBrowser,
  resetPreparedStainSessions,
  toggleStainBrowserDevTools,
} from './stain-browser.js';
import { checkEnvironment } from './environment-check.js';
import { HealthMonitor } from './health-monitor.js';
import {
  discoverLocalDevPorts,
  pickMeshLocalPort,
  validateMeshLocalPort,
} from './local-dev-ports.js';
import { pickAvailableLocalPort } from './port-picker.js';
import { loadBundledVersions } from './bundled-versions.js';
import { RestartSpecRegistry } from './restart-spec-registry.js';
import { SessionRecovery } from './session-recovery.js';
import { createAppTray, destroyAppTray } from './tray.js';
import { resolveAppIconPath } from './app-icon.js';
import { getAppUpdater, initAppUpdater } from './app-updater.js';
import { INITIAL_UPDATE_STATUS, type AppUpdateStatus } from '@kt-virtual-env/shared';

const versions = loadBundledVersions();

let mainWindow: BrowserWindow | null = null;
const sessions = new SessionManager();
const restartRegistry = new RestartSpecRegistry();
const ktctlService = new KtctlService(sessions, restartRegistry);
let meshProfileCache: MeshProfile[] = [];
let connectSessionId: string | null = null;
let helperClient: HelperClient | null = null;
let healthMonitor: HealthMonitor | null = null;
let isQuitting = false;

function k8s(): K8sService {
  const cfg = loadConfig();
  return new K8sService(cfg.kubeconfig, cfg.context);
}

function broadcastSessions(): void {
  mainWindow?.webContents.send('sessions:update', sessions.list());
}

function broadcastHealth(): void {
  if (!healthMonitor) return;
  mainWindow?.webContents.send('health:changed', healthMonitor.getSnapshot());
}

function broadcastUpdate(status: AppUpdateStatus): void {
  mainWindow?.webContents.send('update:changed', status);
}

sessions.onChange(() => broadcastSessions());

async function disconnectConnectHelper(): Promise<void> {
  if (helperClient) {
    helperClient.send({ cmd: 'disconnect' });
    helperClient.close();
    helperClient = null;
  }
}

function bindConnectHelperMessages(sessionId: string): void {
  helperClient?.onMessage((msg) => {
    if (msg.event === 'log') {
      sessions.appendLog(sessionId, msg.line);
    }
    if (msg.event === 'status') {
      if (msg.state === 'starting') sessions.markStarting(sessionId);
      if (msg.state === 'running') {
        sessions.markRunning(sessionId, 0);
        sessions.appendLog(sessionId, '[connect] 集群网络已打通');
      }
      if (msg.state === 'failed') {
        sessions.markFailed(sessionId);
        sessions.appendLog(sessionId, '[connect] 连接失败，请查看上方 ktctl 输出');
      }
      if (msg.state === 'stopped') {
        if (connectSessionId === sessionId) {
          sessions.remove(sessionId);
          connectSessionId = null;
          restartRegistry.clearConnect();
        }
      }
    }
    if (msg.event === 'error') {
      sessions.appendLog(sessionId, `[connect] 错误：${msg.message}`);
    }
  });
}

async function launchConnectHelper(sessionId: string, params: ConnectParams): Promise<void> {
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
  bindConnectHelperMessages(sessionId);
  helperClient.send(buildConnectMessage(ktctlPath, elevatedParams, getElevatedKtHome()));
}

async function stopConnectSession(): Promise<void> {
  await disconnectConnectHelper();
  if (connectSessionId) {
    sessions.remove(connectSessionId);
    connectSessionId = null;
  }
  restartRegistry.clearConnect();
}

async function startConnectSession(params: ConnectParams): Promise<string> {
  const session = sessions.create({
    type: 'connect',
    target: params.namespace,
    namespace: params.namespace,
    command: `ktctl connect --namespace ${params.namespace}`,
  });
  connectSessionId = session.id;
  restartRegistry.setConnect(params);
  await saveConfig({ connectDnsNamespaces: params.dnsNamespaces });
  sessions.markStarting(session.id);
  sessions.appendLog(
    session.id,
    `[connect] 正在连接集群网络（${params.namespace}）…`,
  );
  await launchConnectHelper(session.id, params);
  return session.id;
}

async function restartConnectSession(params: ConnectParams): Promise<void> {
  const existingId = connectSessionId;
  if (existingId && sessions.get(existingId)) {
    sessions.appendLog(
      existingId,
      '[auto-recovery] 健康检查连续 2 次异常，正在自动重连…',
    );
    sessions.markStarting(existingId);
    await disconnectConnectHelper();
    await launchConnectHelper(existingId, params);
    return;
  }
  await startConnectSession(params);
}

function initHealthMonitor(): void {
  const recovery = new SessionRecovery({
    registry: restartRegistry,
    sessions,
    ktctl: ktctlService,
    recoverConnect: restartConnectSession,
    appendLog: (id, line) => sessions.appendLog(id, line),
  });

  healthMonitor = new HealthMonitor({
    intervalMs: 10_000,
    getConnectSession: () =>
      connectSessionId ? sessions.get(connectSessionId) : undefined,
    isHelperRunning,
    k8s,
    listActiveSessions: () => sessions.list().filter((s) => s.state !== 'stopped'),
    ktctl: ktctlService,
    recovery,
    onChanged: () => broadcastHealth(),
  });
  healthMonitor.start();
}

function createWindow(): void {
  const iconPath = resolveAppIconPath();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    ...(iconPath ? { icon: iconPath } : {}),
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
  mainWindow.on('close', (e) => {
    if (isQuitting) return;
    e.preventDefault();
    mainWindow?.hide();
  });
}

function focusMainWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function requestQuit(): void {
  const running = sessions.list().filter((s) => s.state === 'running');
  if (running.length > 0) {
    focusMainWindow();
    mainWindow?.webContents.send('app:confirmExit', running.length);
    return;
  }
  isQuitting = true;
  app.quit();
}

function registerIpc(): void {
  ipcMain.handle('config:get', () => loadConfig());
  ipcMain.handle('config:save', async (_e, cfg) => {
    const prev = loadConfig();
    const merged = await saveConfig(cfg);
    if (
      cfg.stainExtensionPaths &&
      JSON.stringify(prev.stainExtensionPaths) !== JSON.stringify(merged.stainExtensionPaths)
    ) {
      resetPreparedStainSessions();
    }
    return merged;
  });
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

  ipcMain.handle('update:getStatus', () =>
    getAppUpdater()?.getStatus() ?? INITIAL_UPDATE_STATUS(app.getVersion()),
  );
  ipcMain.handle('update:check', async () => {
    const updater = getAppUpdater();
    if (!updater) return INITIAL_UPDATE_STATUS(app.getVersion());
    return updater.checkForUpdates();
  });
  ipcMain.handle('update:install', () => {
    const running = sessions.list().filter((s) => s.state === 'running');
    if (running.length > 0) {
      return { ok: false as const, reason: 'sessions' as const, count: running.length };
    }
    isQuitting = true;
    getAppUpdater()?.installUpdate();
    return { ok: true as const };
  });

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

  ipcMain.handle('health:getSnapshot', () => healthMonitor?.getSnapshot() ?? { connect: null, sessions: {} });
  ipcMain.handle('health:forceCheck', async () => {
    if (!healthMonitor) return { connect: null, sessions: {} };
    const snapshot = await healthMonitor.forceCheck();
    broadcastHealth();
    return snapshot;
  });
  ipcMain.handle('health:checkConnect', async () => {
    const snapshot = healthMonitor
      ? await healthMonitor.forceCheck()
      : { connect: null, sessions: {} };
    return snapshot.connect ?? {
      level: 'unknown',
      ok: false,
      message: '尚未检测',
      details: [],
      checkedAt: new Date().toISOString(),
    };
  });
  ipcMain.handle('health:checkSession', async (_e, id: string) => {
    const snapshot = healthMonitor
      ? await healthMonitor.forceCheck()
      : { connect: null, sessions: {} };
    return (
      snapshot.sessions[id] ?? {
        level: 'unknown',
        ok: false,
        message: '尚未检测',
        details: [],
        checkedAt: new Date().toISOString(),
      }
    );
  });
  ipcMain.handle('health:checkSessionsByType', async (_e, type: SessionType) => {
    const snapshot = healthMonitor
      ? await healthMonitor.forceCheck()
      : { connect: null, sessions: {} };
    const list = sessions.list().filter((s) => s.type === type && s.state !== 'stopped');
    const out: Record<string, import('@kt-virtual-env/shared').HealthCheckResult> = {};
    for (const s of list) {
      if (snapshot.sessions[s.id]) out[s.id] = snapshot.sessions[s.id]!;
    }
    return out;
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

  ipcMain.handle('connect:start', async (_e, params: ConnectParams) => startConnectSession(params));

  ipcMain.handle('connect:stop', async () => {
    await stopConnectSession();
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
      await stopConnectSession();
      return;
    }
    restartRegistry.delete(id);
    await ktctlService.stopSession(id);
  });
  ipcMain.handle('sessions:stopAll', async () => {
    await ktctlService.stopAll();
    await stopConnectSession();
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
  ipcMain.handle('stain:installFromStore', async (_e, input: string) => {
    const installed = await installExtensionFromChromeWebStore(input);
    const cfg = loadConfig();
    const paths = cfg.stainExtensionPaths.includes(installed.path)
      ? cfg.stainExtensionPaths
      : [...cfg.stainExtensionPaths, installed.path];
    await saveConfig({ stainExtensionPaths: paths });
    resetPreparedStainSessions();
    return { ...installed, paths };
  });
  ipcMain.handle('stain:installFromCrxFile', async (_e, extensionIdHint?: string) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Chrome 扩展', extensions: ['crx', 'zip'] }],
      title: '选择 CRX 或 ZIP 扩展包',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    if (!filePath) return null;
    const installed = await installExtensionFromCrxFile(filePath, extensionIdHint);
    const cfg = loadConfig();
    const paths = cfg.stainExtensionPaths.includes(installed.path)
      ? cfg.stainExtensionPaths
      : [...cfg.stainExtensionPaths, installed.path];
    await saveConfig({ stainExtensionPaths: paths });
    resetPreparedStainSessions();
    return { ...installed, paths };
  });
  ipcMain.handle('stain:listLocalChromeExtensions', () => listLocalChromeExtensions());
  ipcMain.handle('stain:openChromeWebStore', () => shell.openExternal(CHROME_WEB_STORE_HOME));
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

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    focusMainWindow();
  });

  app.whenReady().then(() => {
    void ensureUserKtReady().catch((err: unknown) => {
      console.warn('~/.kt 权限修复失败，端口转发可能不可用:', err);
    });
    void ensureConfigReady().catch((err: unknown) => {
      console.warn('~/.kt-virtual-env 权限修复失败，配置保存可能不可用:', err);
    });
    registerIpc();
    initHealthMonitor();
    createWindow();
    initAppUpdater(broadcastUpdate);
    createAppTray({
      onShow: focusMainWindow,
      onQuit: requestQuit,
    });
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else focusMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    // 关闭窗口后保留托盘，Connect/Mesh/Forward 会话继续在后台运行
  });

  app.on('before-quit', (e) => {
    if (isQuitting) return;
    const running = sessions.list().filter((s) => s.state === 'running');
    if (running.length > 0) {
      e.preventDefault();
      focusMainWindow();
      mainWindow?.webContents.send('app:confirmExit', running.length);
    }
  });

  app.on('will-quit', () => {
    healthMonitor?.stop();
    getAppUpdater()?.stop();
    destroyAppTray();
  });

  ipcMain.handle('app:forceQuit', async (_e, action: 'stopAll' | 'cancel') => {
    if (action === 'stopAll') {
      isQuitting = true;
      await ktctlService.clean();
      await ktctlService.stopAll();
      helperClient?.send({ cmd: 'shutdown' });
      app.exit(0);
    }
  });
}
