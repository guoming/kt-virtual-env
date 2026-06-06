import { create } from 'zustand';
import type { MeshProfile, Session } from '@kt-virtual-env/shared';

export type PageId = 'home' | 'stain' | 'connect' | 'forward' | 'settings';

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
  page: 'settings',
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
