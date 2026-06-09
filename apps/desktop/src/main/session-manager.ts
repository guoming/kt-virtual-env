import { randomUUID } from 'node:crypto';
import type { Session, SessionType } from '@kt-virtual-env/shared';

const MAX_LOGS = 2000;

export class SessionManager {
  private sessions = new Map<string, Session>();
  private listeners: Array<(sessions: Session[]) => void> = [];

  onChange(listener: (sessions: Session[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    const list = this.list();
    for (const l of this.listeners) {
      l(list);
    }
  }

  create(input: {
    type: SessionType;
    target: string;
    namespace: string;
    command: string;
    localPort?: number;
    remotePort?: number;
    virtualEnv?: string;
  }): Session {
    const session: Session = {
      id: randomUUID(),
      state: 'pending',
      startedAt: new Date().toISOString(),
      logs: [],
      ...input,
    };
    this.sessions.set(session.id, session);
    this.notify();
    return session;
  }

  list(): Session[] {
    return [...this.sessions.values()];
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  markStarting(id: string): void {
    this.patch(id, { state: 'starting' });
  }

  markRunning(id: string, pid: number): void {
    this.patch(id, { state: 'running', pid, runningAt: new Date().toISOString() });
  }

  markFailed(id: string): void {
    this.patch(id, { state: 'failed' });
  }

  markStopped(id: string): void {
    this.patch(id, { state: 'stopped' });
  }

  remove(id: string): void {
    if (this.sessions.delete(id)) {
      this.notify();
    }
  }

  appendLog(id: string, line: string): void {
    const s = this.sessions.get(id);
    if (!s) return;
    for (const chunk of line.split(/\r?\n/)) {
      if (chunk) s.logs.push(chunk);
    }
    if (s.logs.length > MAX_LOGS) {
      s.logs.splice(0, s.logs.length - MAX_LOGS);
    }
    this.notify();
  }

  private patch(id: string, partial: Partial<Session>): void {
    const s = this.sessions.get(id);
    if (s) {
      Object.assign(s, partial);
      this.notify();
    }
  }
}
