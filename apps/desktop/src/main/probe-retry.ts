// [AI-GEN] scope:probe-retry, model:auto, reviewed:false
export interface RetryOptions {
  attempts?: number;
  intervalMs?: number;
  onAttempt?: (attempt: number) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryUntilPass(
  fn: () => Promise<boolean>,
  options: RetryOptions = {},
): Promise<boolean> {
  const attempts = options.attempts ?? 5;
  const intervalMs = options.intervalMs ?? 1000;
  for (let i = 1; i <= attempts; i++) {
    options.onAttempt?.(i);
    if (await fn()) return true;
    if (i < attempts) await sleep(intervalMs);
  }
  return false;
}
// [/AI-GEN]
