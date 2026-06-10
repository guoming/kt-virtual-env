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
    get: () => Promise<unknown>;
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
    searchProfiles: (
      virtualEnvQuery: string,
      ns?: string,
      deployQuery?: string,
    ) => Promise<MeshProfile[]>;
    listNamespaces: () => Promise<string[]>;
    listServices: (ns: string) => Promise<Array<{ name: string; port: number }>>;
    searchServices: (
      query: string,
      ns?: string,
    ) => Promise<Array<{ name: string; namespace: string; port: number }>>;
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
    open: (url: string, virtualEnv: string) => Promise<{ id: string; warning?: string }>;
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
