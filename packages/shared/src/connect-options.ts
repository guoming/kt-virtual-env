// [AI-GEN] scope:connect-options, model:auto, reviewed:false
export type ConnectMode = 'tun2socks' | 'sshuttle';

export interface ConnectOptions {
  /** 输出 port-forward / socks 重连等调试日志 */
  debug: boolean;
  /** 心跳时间戳使用本机时间，避免集群时钟偏差触发 clean */
  useLocalTime: boolean;
  /** port-forward 建立/重连等待秒数（ktctl 全局参数，默认 10） */
  portForwardTimeout: number;
  /** 启用后 connect 时自动排除本机网段（值由接口检测） */
  excludeIpsEnabled: boolean;
  /** 隧道模式：tun2socks（默认）或 sshuttle */
  mode: ConnectMode;
}

/** connect 启动时注入的运行时参数（不持久化） */
export type ConnectLaunchOptions = ConnectOptions & {
  excludeIps?: string;
};

type LegacyConnectOptions = Partial<ConnectOptions> & {
  /** @deprecated 旧版手动填写，迁移为 excludeIpsEnabled */
  excludeIps?: string;
};

export const DEFAULT_CONNECT_OPTIONS: ConnectOptions = {
  debug: false,
  useLocalTime: false,
  portForwardTimeout: 10,
  excludeIpsEnabled: false,
  mode: 'tun2socks',
};

export function normalizeConnectOptions(input?: LegacyConnectOptions): ConnectOptions {
  const rawTimeout = input?.portForwardTimeout ?? DEFAULT_CONNECT_OPTIONS.portForwardTimeout;
  const portForwardTimeout = Number(rawTimeout);
  const excludeIpsEnabled =
    input?.excludeIpsEnabled ?? Boolean(input?.excludeIps?.trim());
  return {
    debug: Boolean(input?.debug),
    useLocalTime: Boolean(input?.useLocalTime),
    portForwardTimeout:
      Number.isFinite(portForwardTimeout) && portForwardTimeout >= 1
        ? Math.min(300, Math.round(portForwardTimeout))
        : DEFAULT_CONNECT_OPTIONS.portForwardTimeout,
    excludeIpsEnabled,
    mode: input?.mode === 'sshuttle' ? 'sshuttle' : 'tun2socks',
  };
}

/** 会话日志用：仅列出非默认的 ktctl 参数 */
export function formatConnectOptionsForLog(options: ConnectLaunchOptions): string {
  const flags: string[] = [];
  if (options.debug) flags.push('--debug');
  if (options.useLocalTime) flags.push('--useLocalTime');
  if (options.mode !== 'tun2socks') flags.push(`--mode ${options.mode}`);
  if (options.excludeIpsEnabled) {
    if (options.excludeIps) {
      flags.push(`--excludeIps ${options.excludeIps}`);
    } else {
      flags.push('--excludeIps (已启用，未检测到本机网段)');
    }
  }
  if (options.portForwardTimeout !== DEFAULT_CONNECT_OPTIONS.portForwardTimeout) {
    flags.push(`--portForwardTimeout ${options.portForwardTimeout}`);
  }
  return flags.length > 0 ? flags.join(' ') : '默认参数';
}
// [/AI-GEN]
