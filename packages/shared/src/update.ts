export type UpdatePhase =
  | 'idle'
  | 'unsupported'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface AppUpdateStatus {
  phase: UpdatePhase;
  currentVersion: string;
  latestVersion?: string;
  downloadPercent?: number;
  message?: string;
}

export const INITIAL_UPDATE_STATUS = (currentVersion: string): AppUpdateStatus => ({
  phase: 'idle',
  currentVersion,
});
