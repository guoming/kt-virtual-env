import { isLocalPortOpen } from './process-utils.js';

const RANGE_START = 8000;
const RANGE_END = 8999;

// [AI-GEN] scope:port-picker, model:auto, reviewed:false
export function buildPortCandidates(
  preferred: number,
  rangeStart = RANGE_START,
  rangeEnd = RANGE_END,
): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  const add = (p: number) => {
    if (p > 0 && p <= 65535 && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  };
  add(preferred);
  for (let p = rangeStart; p <= rangeEnd; p++) {
    add(p);
  }
  return out;
}

/** 从首选端口起，跳过已占用端口，探测本机 TCP 监听得到可用端口 */
export async function pickAvailableLocalPort(
  reserved: number[],
  preferred: number,
): Promise<number> {
  const taken = new Set(reserved);
  for (const port of buildPortCandidates(preferred)) {
    if (taken.has(port)) continue;
    const listening = await isLocalPortOpen(port);
    if (!listening) return port;
    taken.add(port);
  }
  throw new Error(`未找到可用本地端口（${RANGE_START}-${RANGE_END}）`);
}
// [/AI-GEN]
