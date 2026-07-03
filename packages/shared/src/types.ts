import type { ConnectLaunchOptions } from './connect-options.js';

export type SessionType = 'connect' | 'forward' | 'mesh';
export type SessionState = 'pending' | 'starting' | 'running' | 'failed' | 'stopped';

export type { ConnectLaunchOptions, ConnectMode, ConnectOptions } from './connect-options.js';

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
  /** 进入 running 状态的时间（用于 connect 健康检查宽限期） */
  runningAt?: string;
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
  /** ktctl connect 高级参数；未指定时由主进程从应用配置注入 */
  options?: ConnectLaunchOptions;
}

/** Connect 基准命名空间权限探测结果 */
export interface NamespaceConnectAccess {
  name: string;
  canConnect: boolean;
  reason?: string;
}

/** 本机网段检测，供 connect --excludeIps 使用 */
export interface ConnectExcludeIpsResult {
  ok: boolean;
  cidrs: string[];
  excludeIps: string;
  message: string;
}

export interface ComponentCheck {
  ok: boolean;
  path?: string;
  version?: string;
  message: string;
  hint?: string;
}

export interface EnvironmentStatus {
  appVersion: string;
  appLatestVersion?: string;
  bundledKtctlVersion: string;
  bundledKubectlVersion: string;
  helper: ComponentCheck & { running: boolean };
  ktctl: ComponentCheck;
  kubectl: ComponentCheck;
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
  | { cmd: 'connect'; params: ConnectParams; ktctlPath: string; ktHome: string; kubectlBinDir?: string }
  | { cmd: 'disconnect' }
  | { cmd: 'shutdown' };

export type HelperOutbound =
  | { event: 'log'; line: string }
  | { event: 'status'; state: SessionState }
  | { event: 'error'; code: string; message: string }
  | { event: 'pong'; version: string };
