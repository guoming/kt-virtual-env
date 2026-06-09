import os from 'node:os';

/** macOS/Linux 用 uid；Windows 用用户名，保证提权 Helper 与主进程路径一致 */
export function runtimeUserKey(): string {
  if (typeof process.getuid === 'function') {
    return String(process.getuid());
  }
  return os.userInfo().username.replace(/[^\w.-]/g, '_');
}
