import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

/** 按用户名生成稳定端口，避免多用户冲突 */
function helperTcpPort(): number {
  const user = os.userInfo().username;
  let hash = 0;
  for (let i = 0; i < user.length; i += 1) {
    hash = (hash * 31 + user.charCodeAt(i)) >>> 0;
  }
  return 49152 + (hash % 16383);
}

/** Helper 以 root 运行时 UserHomeDir 会变，须用 /tmp + uid 固定路径 */
export function getHelperSocketPath(): string {
  if (process.platform === 'win32') {
    // 管理员 Helper 与普通用户 Electron 无法共用 Unix socket，改用本机 TCP
    return `tcp:127.0.0.1:${helperTcpPort()}`;
  }
  const uid = typeof process.getuid === 'function' ? process.getuid() : undefined;
  if (uid !== undefined) {
    return path.join(os.tmpdir(), `kt-virtual-env-helper-${uid}.sock`);
  }
  return path.join(os.tmpdir(), 'kt-virtual-env-helper.sock');
}

export function connectHelperSocket(timeoutMs: number): Promise<net.Socket> {
  const endpoint = getHelperSocketPath();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Helper 连接超时')), timeoutMs);
    const onReady = (conn: net.Socket) => {
      clearTimeout(timer);
      resolve(conn);
    };
    const onError = (err: Error) => {
      clearTimeout(timer);
      reject(err);
    };
    if (endpoint.startsWith('tcp:')) {
      const [host, portRaw] = endpoint.slice(4).split(':');
      const port = Number(portRaw);
      if (!host || !Number.isFinite(port)) {
        clearTimeout(timer);
        reject(new Error(`无效的 Helper TCP 地址: ${endpoint}`));
        return;
      }
      const conn = net.createConnection({ host, port }, () => onReady(conn));
      conn.on('error', onError);
      return;
    }
    const conn = net.createConnection(endpoint, () => onReady(conn));
    conn.on('error', onError);
  });
}

export function isTcpHelperEndpoint(endpoint = getHelperSocketPath()): boolean {
  return endpoint.startsWith('tcp:');
}
