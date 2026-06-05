export type SessionType = 'connect' | 'forward' | 'mesh';
export type SessionState = 'pending' | 'starting' | 'running' | 'failed' | 'stopped';

export interface Session {
  id: string;
  type: SessionType;
  target: string;
  namespace: string;
  localPort?: number;
  remotePort?: number;
  virtualEnv?: string;
  pid?: number;
  state: SessionState;
  startedAt: string;
  logs: string[];
  command: string;
}

export interface MeshProfile {
  deploymentName: string;
  namespace: string;
  virtualEnv: string;
  env: string;
  appName: string;
  containerPort: number;
  suggestedLocalPort: number;
}

export interface ConnectParams {
  namespace: string;
  dnsNamespaces: string[];
  kubeconfig: string;
  context: string;
}

export interface ForwardParams {
  service: string;
  namespace: string;
  localPort: number;
  remotePort: number;
  kubeconfig: string;
  context: string;
}

export type HelperInbound =
  | { cmd: 'ping' }
  | { cmd: 'connect'; params: ConnectParams; ktctlPath: string }
  | { cmd: 'disconnect' }
  | { cmd: 'shutdown' };

export type HelperOutbound =
  | { event: 'log'; line: string }
  | { event: 'status'; state: SessionState }
  | { event: 'error'; code: string; message: string }
  | { event: 'pong'; version: string };
