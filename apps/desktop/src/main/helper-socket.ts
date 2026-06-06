import os from 'node:os';
import path from 'node:path';

/** Helper 以 root 运行时 UserHomeDir 会变，须用 /tmp + uid 固定路径 */
export function getHelperSocketPath(): string {
  const uid = typeof process.getuid === 'function' ? process.getuid() : undefined;
  if (uid !== undefined) {
    return path.join(os.tmpdir(), `kt-virtual-env-helper-${uid}.sock`);
  }
  return path.join(os.tmpdir(), 'kt-virtual-env-helper.sock');
}
