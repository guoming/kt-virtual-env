import type { ConnectParams, HelperInbound, HelperOutbound } from '@kt-virtual-env/shared';
import { connectHelperSocket, getHelperSocketPath } from './helper-socket.js';
import { getBundledKubectlBinDir } from './windows-spawn.js';

export class HelperClient {
  private conn?: import('node:net').Socket;
  private buffer = '';

  async connect(timeoutMs = 5000): Promise<void> {
    this.conn = await connectHelperSocket(timeoutMs);
  }

  send(msg: HelperInbound): void {
    this.conn?.write(`${JSON.stringify(msg)}\n`);
  }

  onMessage(handler: (msg: HelperOutbound) => void): void {
    this.conn?.on('data', (chunk) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) {
          handler(JSON.parse(line) as HelperOutbound);
        }
      }
    });
  }

  close(): void {
    this.conn?.destroy();
    this.conn = undefined;
  }

  static socketPath(): string {
    return getHelperSocketPath();
  }
}

export function buildConnectMessage(
  ktctlPath: string,
  params: ConnectParams,
  ktHome: string,
): HelperInbound {
  const msg: HelperInbound = { cmd: 'connect', params, ktctlPath, ktHome };
  if (process.platform === 'win32') {
    return { ...msg, kubectlBinDir: getBundledKubectlBinDir() };
  }
  return msg;
}
