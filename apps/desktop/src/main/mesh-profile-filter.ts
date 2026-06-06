import type { MeshProfile } from '@kt-virtual-env/shared';

// [AI-GEN] scope:mesh-profile-filter, model:auto, reviewed:false
export function filterMeshProfiles(
  profiles: MeshProfile[],
  virtualEnvQuery: string,
  namespace?: string,
  deployQuery?: string,
): MeshProfile[] {
  const ve = virtualEnvQuery.trim().toLowerCase();
  const dep = (deployQuery ?? '').trim().toLowerCase();
  return profiles
    .filter((p) => {
      if (namespace && p.namespace !== namespace) return false;
      if (ve) {
        const hitVe =
          p.virtualEnv.toLowerCase().includes(ve) ||
          p.env.toLowerCase().includes(ve);
        if (!hitVe) return false;
      }
      if (dep) {
        const hitDep =
          p.deploymentName.toLowerCase().includes(dep) ||
          p.appName.toLowerCase().includes(dep) ||
          p.namespace.toLowerCase().includes(dep);
        if (!hitDep) return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        a.namespace.localeCompare(b.namespace) ||
        a.deploymentName.localeCompare(b.deploymentName),
    );
}
// [/AI-GEN]
