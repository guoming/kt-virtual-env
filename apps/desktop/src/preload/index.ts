import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppUpdateStatus,
  ConnectParams,
  EnvironmentStatus,
  ForwardParams,
  HealthCheckResult,
  HealthSnapshot,
  LocalDevPort,
  MeshProfile,
  Session,
  SessionType,
} from '@kt-virtual-env/shared';

export interface KtveApi {
  config: {
    get: () => Promise<ReturnType<typeof ipcRenderer.invoke>>;
    save: (cfg: unknown) => Promise<unknown>;
    pickKubeconfig: () => Promise<string | null>;
  };
  app: {
    versions: () => Promise<{ app: string; ktctl: string; kubectl: string }>;
    checkEnvironment: () => Promise<EnvironmentStatus>;
    onConfirmExit: (cb: (count: number) => void) => () => void;
    forceQuit: (action: 'stopAll' | 'cancel') => Promise<void>;
  };
  update: {
    getStatus: () => Promise<AppUpdateStatus>;
    check: () => Promise<AppUpdateStatus>;
    install: () => Promise<
      { ok: true } | { ok: false; reason: 'sessions'; count: number }
    >;
    onChanged: (cb: (status: AppUpdateStatus) => void) => () => void;
  };
  k8s: {
    listProfiles: () => Promise<MeshProfile[]>;
    listNamespaces: () => Promise<string[]>;
    listServices: (ns: string) => Promise<Array<{ name: string; port: number }>>;
    searchProfiles: (
      virtualEnvQuery: string,
      ns?: string,
      deployQuery?: string,
    ) => Promise<MeshProfile[]>;
    listContexts: () => Promise<string[]>;
    testConnection: () => Promise<{ ok: boolean; message: string }>;
  };
  mesh: {
    start: (
      profile: MeshProfile,
      localPort: number,
      userId?: string,
      versionMarkBaseVirtualEnv?: string,
    ) => Promise<string>;
  };
  forward: { start: (params: ForwardParams) => Promise<string> };
  connect: {
    start: (params: ConnectParams) => Promise<string>;
    stop: () => Promise<void>;
  };
  helper: {
    status: () => Promise<{ running: boolean }>;
    authorize: () => Promise<{ running: boolean }>;
  };
  sessions: {
    list: () => Promise<Session[]>;
    stop: (id: string) => Promise<void>;
    stopAll: () => Promise<void>;
    onUpdate: (cb: (sessions: Session[]) => void) => () => void;
  };
  ktctl: {
    recover: (target: string, ns: string) => Promise<void>;
    clean: () => Promise<void>;
  };
  shell: { openExternal: (url: string) => Promise<void> };
  stain: {
    open: (
      url: string,
      virtualEnv: string,
    ) => Promise<{ id: string; warning?: string }>;
    pickExtensionDir: () => Promise<string | null>;
    installFromStore: (input: string) => Promise<{
      id: string;
      name: string;
      version: string;
      path: string;
      paths: string[];
    }>;
    installFromCrxFile: (extensionIdHint?: string) => Promise<{
      id: string;
      name: string;
      version: string;
      path: string;
      paths: string[];
    } | null>;
    listLocalChromeExtensions: () => Promise<
      Array<{ id: string; name: string; version: string; path: string }>
    >;
    openChromeWebStore: () => Promise<void>;
    list: () => Promise<Array<{ id: string; url: string; virtualEnv: string; title: string }>>;
    close: (id: string) => Promise<void>;
    closeAll: () => Promise<void>;
    focus: (id: string) => Promise<void>;
    toggleDevTools: (id: string) => Promise<void>;
  };
  health: {
    getSnapshot: () => Promise<HealthSnapshot>;
    forceCheck: () => Promise<HealthSnapshot>;
    onChanged: (cb: (snapshot: HealthSnapshot) => void) => () => void;
    checkConnect: () => Promise<HealthCheckResult>;
    checkSession: (id: string) => Promise<HealthCheckResult>;
    checkSessionsByType: (type: SessionType) => Promise<Record<string, HealthCheckResult>>;
  };
  system: {
    pickLocalPort: (reserved: number[], preferred: number) => Promise<number>;
    listLocalDevPorts: () => Promise<LocalDevPort[]>;
    pickMeshLocalPort: (profile: MeshProfile, reserved: number[]) => Promise<LocalDevPort>;
    validateMeshLocalPort: (port: number) => Promise<void>;
  };
}

const api: KtveApi = {
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    save: (cfg) => ipcRenderer.invoke('config:save', cfg),
    pickKubeconfig: () => ipcRenderer.invoke('config:pickKubeconfig'),
  },
  app: {
    versions: () => ipcRenderer.invoke('app:versions'),
    checkEnvironment: () => ipcRenderer.invoke('app:checkEnvironment'),
    onConfirmExit: (cb) => {
      const handler = (_: unknown, count: number) => cb(count);
      ipcRenderer.on('app:confirmExit', handler);
      return () => ipcRenderer.removeListener('app:confirmExit', handler);
    },
    forceQuit: (action) => ipcRenderer.invoke('app:forceQuit', action),
  },
  update: {
    getStatus: () => ipcRenderer.invoke('update:getStatus'),
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    onChanged: (cb) => {
      const handler = (_: unknown, status: AppUpdateStatus) => cb(status);
      ipcRenderer.on('update:changed', handler);
      return () => ipcRenderer.removeListener('update:changed', handler);
    },
  },
  k8s: {
    listProfiles: () => ipcRenderer.invoke('k8s:listProfiles'),
    listNamespaces: () => ipcRenderer.invoke('k8s:listNamespaces'),
    listServices: (ns) => ipcRenderer.invoke('k8s:listServices', ns),
    searchServices: (query, ns) => ipcRenderer.invoke('k8s:searchServices', query, ns),
    searchProfiles: (virtualEnvQuery, ns, deployQuery) =>
      ipcRenderer.invoke('k8s:searchProfiles', virtualEnvQuery, ns, deployQuery),
    listContexts: () => ipcRenderer.invoke('k8s:listContexts'),
    testConnection: () => ipcRenderer.invoke('k8s:testConnection'),
  },
  mesh: {
    start: (profile, localPort, userId, versionMarkBaseVirtualEnv) =>
      ipcRenderer.invoke('mesh:start', profile, localPort, userId, versionMarkBaseVirtualEnv),
  },
  forward: { start: (params) => ipcRenderer.invoke('forward:start', params) },
  connect: {
    start: (params) => ipcRenderer.invoke('connect:start', params),
    stop: () => ipcRenderer.invoke('connect:stop'),
  },
  helper: {
    status: () => ipcRenderer.invoke('helper:status'),
    authorize: () => ipcRenderer.invoke('helper:authorize'),
  },
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    stop: (id) => ipcRenderer.invoke('sessions:stop', id),
    stopAll: () => ipcRenderer.invoke('sessions:stopAll'),
    onUpdate: (cb) => {
      const handler = (_: unknown, list: Session[]) => cb(list);
      ipcRenderer.on('sessions:update', handler);
      return () => ipcRenderer.removeListener('sessions:update', handler);
    },
  },
  ktctl: {
    recover: (target, ns) => ipcRenderer.invoke('ktctl:recover', target, ns),
    clean: () => ipcRenderer.invoke('ktctl:clean'),
  },
  shell: { openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url) },
  stain: {
    open: (url, virtualEnv) => ipcRenderer.invoke('stain:open', url, virtualEnv),
    pickExtensionDir: () => ipcRenderer.invoke('stain:pickExtensionDir'),
    installFromStore: (input) => ipcRenderer.invoke('stain:installFromStore', input),
    installFromCrxFile: (extensionIdHint) =>
      ipcRenderer.invoke('stain:installFromCrxFile', extensionIdHint),
    listLocalChromeExtensions: () => ipcRenderer.invoke('stain:listLocalChromeExtensions'),
    openChromeWebStore: () => ipcRenderer.invoke('stain:openChromeWebStore'),
    list: () => ipcRenderer.invoke('stain:list'),
    close: (id) => ipcRenderer.invoke('stain:close', id),
    closeAll: () => ipcRenderer.invoke('stain:closeAll'),
    focus: (id) => ipcRenderer.invoke('stain:focus', id),
    toggleDevTools: (id) => ipcRenderer.invoke('stain:toggleDevTools', id),
  },
  health: {
    getSnapshot: () => ipcRenderer.invoke('health:getSnapshot'),
    forceCheck: () => ipcRenderer.invoke('health:forceCheck'),
    onChanged: (cb) => {
      const handler = (_: unknown, snapshot: HealthSnapshot) => cb(snapshot);
      ipcRenderer.on('health:changed', handler);
      return () => ipcRenderer.removeListener('health:changed', handler);
    },
    checkConnect: () => ipcRenderer.invoke('health:checkConnect'),
    checkSession: (id) => ipcRenderer.invoke('health:checkSession', id),
    checkSessionsByType: (type) => ipcRenderer.invoke('health:checkSessionsByType', type),
  },
  system: {
    pickLocalPort: (reserved, preferred) =>
      ipcRenderer.invoke('system:pickLocalPort', reserved, preferred),
    listLocalDevPorts: () => ipcRenderer.invoke('system:listLocalDevPorts'),
    pickMeshLocalPort: (profile, reserved) =>
      ipcRenderer.invoke('system:pickMeshLocalPort', profile, reserved),
    validateMeshLocalPort: (port) => ipcRenderer.invoke('system:validateMeshLocalPort', port),
  },
};

contextBridge.exposeInMainWorld('ktve', api);
