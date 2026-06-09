import type { MeshProfile, Session } from '@kt-virtual-env/shared';
import { meshServiceKey, forwardServiceKey } from '@kt-virtual-env/shared';
import type { ServiceListTab } from '../components/ServiceListTabs';

export interface ForwardServiceRow {
  name: string;
  namespace: string;
  port: number;
}

export function meshProfileActiveKey(row: MeshProfile): string {
  return `${row.namespace}/${row.appName}/${row.virtualEnv}`;
}

export function meshSessionActiveKey(session: Session, meshUserId: string): string {
  return `${session.namespace}/${session.target}/${clusterVirtualEnvFromMeshSession(session, meshUserId)}`;
}

export function meshProfileKey(row: MeshProfile): string {
  return meshServiceKey(row.namespace, row.deploymentName);
}

export function forwardRowKey(row: ForwardServiceRow): string {
  return forwardServiceKey(row.namespace, row.name);
}

export function clusterVirtualEnvFromMeshSession(
  session: Session,
  meshUserId: string,
): string {
  const v = session.virtualEnv ?? '';
  const suffix = meshUserId ? `.${meshUserId}` : '';
  if (suffix && v.endsWith(suffix)) return v.slice(0, -suffix.length);
  return v;
}

export function meshProfileFromSession(session: Session, meshUserId: string): MeshProfile {
  return {
    deploymentName: session.target,
    namespace: session.namespace,
    virtualEnv: clusterVirtualEnvFromMeshSession(session, meshUserId),
    env: clusterVirtualEnvFromMeshSession(session, meshUserId).split('.')[0] ?? '',
    appName: session.target,
    containerPort: session.remotePort ?? 80,
    suggestedLocalPort: session.localPort ?? 8001,
  };
}

export function filterMeshProfilesForTab(
  tab: ServiceListTab,
  searchResults: MeshProfile[],
  catalog: MeshProfile[],
  favorites: Set<string>,
  activeMeshes: Session[],
  meshUserId: string,
): MeshProfile[] {
  if (tab === 'all') return searchResults;

  if (tab === 'favorites') {
    return catalog.filter((p) => favorites.has(meshProfileKey(p)));
  }

  const activeKeys = new Set(
    activeMeshes.map((s) => meshSessionActiveKey(s, meshUserId)),
  );
  const fromCatalog = catalog.filter((p) => activeKeys.has(meshProfileActiveKey(p)));
  const orphans = activeMeshes
    .filter(
      (s) => !catalog.some((p) => meshProfileActiveKey(p) === meshSessionActiveKey(s, meshUserId)),
    )
    .map((s) => meshProfileFromSession(s, meshUserId));
  return [...fromCatalog, ...orphans];
}

export function filterForwardRowsForTab(
  tab: ServiceListTab,
  searchResults: ForwardServiceRow[],
  catalog: ForwardServiceRow[],
  favorites: Set<string>,
  activeForwards: Session[],
): ForwardServiceRow[] {
  if (tab === 'all') return searchResults;

  if (tab === 'favorites') {
    return catalog.filter((r) => favorites.has(forwardRowKey(r)));
  }

  const activeKeys = new Set(
    activeForwards.map((s) => forwardServiceKey(s.namespace, s.target)),
  );
  const fromCatalog = catalog.filter((r) => activeKeys.has(forwardRowKey(r)));
  const covered = new Set(fromCatalog.map(forwardRowKey));
  const orphans = activeForwards
    .filter((s) => !covered.has(forwardServiceKey(s.namespace, s.target)))
    .map((s) => ({
      name: s.target,
      namespace: s.namespace,
      port: s.remotePort ?? 80,
    }));
  return [...fromCatalog, ...orphans];
}

export function countFavoriteMeshInCatalog(
  catalog: MeshProfile[],
  favorites: Set<string>,
): number {
  return catalog.filter((p) => favorites.has(meshProfileKey(p))).length;
}

export function countFavoriteForwardInCatalog(
  catalog: ForwardServiceRow[],
  favorites: Set<string>,
): number {
  return catalog.filter((r) => favorites.has(forwardRowKey(r))).length;
}
