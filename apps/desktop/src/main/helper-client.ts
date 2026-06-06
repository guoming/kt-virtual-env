import net from 'node:net';
import type { ConnectParams, HelperInbound, HelperOutbound } from '@kt-virtual-env/shared';
import { getHelperSocketPath } from './helper-socket.js';

const SOCKET = getHelperSocketPath();

export class HelperClient {
  private conn?: net.Socket;
  private buffer = '';

  async connect(timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Helper 连接超时')), timeoutMs);
      this.conn = net.createConnection(SOCKET, () => {
        clearTimeout(timer);
        resolve();
      });
      this.conn.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
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
    return SOCKET;
  }
}

export function buildConnectMessage(
  ktctlPath: string,
  params: ConnectParams,
  ktHome: string,
): HelperInbound {
  return { cmd: 'connect', params, ktctlPath, ktHome };
}
