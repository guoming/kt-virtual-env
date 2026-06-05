import { contextBridge, ipcRenderer } from 'electron';
import type { ConnectParams, ForwardParams, MeshProfile, Session } from '@zt-virtual-env/shared';

export interface ZtveApi {
  config: {
    get: () => Promise<ReturnType<typeof ipcRenderer.invoke>>;
    save: (cfg: unknown) => Promise<unknown>;
  };
  app: {
    versions: () => Promise<{ app: string; ktctl: string; kubectl: string }>;
    onConfirmExit: (cb: (count: number) => void) => () => void;
    forceQuit: (action: 'stopAll' | 'cancel') => Promise<void>;
  };
  k8s: {
    listProfiles: () => Promise<MeshProfile[]>;
    listNamespaces: () => Promise<string[]>;
    listServices: (ns: string) => Promise<Array<{ name: string; port: number }>>;
    listContexts: () => Promise<string[]>;
    testConnection: () => Promise<{ ok: boolean; message: string }>;
  };
  mesh: { start: (profileKey: string, localPort: number) => Promise<string> };
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
}

const api: ZtveApi = {
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    save: (cfg) => ipcRenderer.invoke('config:save', cfg),
  },
  app: {
    versions: () => ipcRenderer.invoke('app:versions'),
    onConfirmExit: (cb) => {
      const handler = (_: unknown, count: number) => cb(count);
      ipcRenderer.on('app:confirmExit', handler);
      return () => ipcRenderer.removeListener('app:confirmExit', handler);
    },
    forceQuit: (action) => ipcRenderer.invoke('app:forceQuit', action),
  },
  k8s: {
    listProfiles: () => ipcRenderer.invoke('k8s:listProfiles'),
    listNamespaces: () => ipcRenderer.invoke('k8s:listNamespaces'),
    listServices: (ns) => ipcRenderer.invoke('k8s:listServices', ns),
    listContexts: () => ipcRenderer.invoke('k8s:listContexts'),
    testConnection: () => ipcRenderer.invoke('k8s:testConnection'),
  },
  mesh: { start: (profileKey, localPort) => ipcRenderer.invoke('mesh:start', profileKey, localPort) },
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
};

contextBridge.exposeInMainWorld('ztve', api);
