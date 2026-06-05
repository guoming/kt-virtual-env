import { create } from 'zustand';
import type { MeshProfile, Session } from '@zt-virtual-env/shared';

export type PageId = 'home' | 'connect' | 'forward' | 'mesh' | 'sessions' | 'settings';

interface AppState {
  page: PageId;
  sessions: Session[];
  profiles: MeshProfile[];
  helperRunning: boolean;
  clusterOk: boolean;
  setPage: (page: PageId) => void;
  setSessions: (sessions: Session[]) => void;
  setProfiles: (profiles: MeshProfile[]) => void;
  setHelperRunning: (v: boolean) => void;
  setClusterOk: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  page: 'home',
  sessions: [],
  profiles: [],
  helperRunning: false,
  clusterOk: false,
  setPage: (page) => set({ page }),
  setSessions: (sessions) => set({ sessions }),
  setProfiles: (profiles) => set({ profiles }),
  setHelperRunning: (helperRunning) => set({ helperRunning }),
  setClusterOk: (clusterOk) => set({ clusterOk }),
}));

export function profileKey(p: MeshProfile): string {
  return `${p.namespace}/${p.deploymentName}`;
}
