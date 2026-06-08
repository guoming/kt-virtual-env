import type { UpdatePhase } from '@kt-virtual-env/shared';

export type VersionLatestState = 'idle' | 'checking' | 'ready' | 'failed';

export function mapUpdatePhase(phase: UpdatePhase): VersionLatestState {
  switch (phase) {
    case 'checking':
      return 'checking';
    case 'error':
      return 'failed';
    case 'not-available':
    case 'available':
    case 'downloading':
    case 'downloaded':
      return 'ready';
    default:
      return 'idle';
  }
}
