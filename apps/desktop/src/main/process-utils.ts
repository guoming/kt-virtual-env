import net from 'node:net';

export function isProcessAlive(pid: number | undefined): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    // 提权 Helper 启动的 ktctl 属 root，普通用户 kill(0) 会 EPERM，但进程仍存活
    if (err.code === 'EPERM') return true;
    return false;
  }
}

export function isLocalPortOpen(
  port: number,
  host = '127.0.0.1',
  timeoutMs = 2000,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (open: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.once('timeout', () => done(false));
  });
}
