import type { ConnectParams, ForwardParams, MeshProfile } from '@kt-virtual-env/shared';

export type MeshRestartSpec = {
  type: 'mesh';
  profile: MeshProfile;
  localPort: number;
  userId: string;
};

export type ForwardRestartSpec = { type: 'forward'; params: ForwardParams };

export type SessionRestartSpec = MeshRestartSpec | ForwardRestartSpec;

export class RestartSpecRegistry {
  private connectSpec: ConnectParams | undefined;
  private sessions = new Map<string, SessionRestartSpec>();

  setConnect(params: ConnectParams): void {
    this.connectSpec = params;
  }

  getConnect(): ConnectParams | undefined {
    return this.connectSpec;
  }

  clearConnect(): void {
    this.connectSpec = undefined;
  }

  setForward(id: string, params: ForwardParams): void {
    this.sessions.set(id, { type: 'forward', params });
  }

  getForward(id: string): ForwardParams | undefined {
    const spec = this.sessions.get(id);
    return spec?.type === 'forward' ? spec.params : undefined;
  }

  setMesh(id: string, profile: MeshProfile, localPort: number, userId: string): void {
    this.sessions.set(id, { type: 'mesh', profile, localPort, userId });
  }

  getSession(id: string): SessionRestartSpec | undefined {
    return this.sessions.get(id);
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }
}
