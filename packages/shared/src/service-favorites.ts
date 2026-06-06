// [AI-GEN] scope:service-favorites, model:auto, reviewed:false
export function meshServiceKey(namespace: string, deploymentName: string): string {
  return `${namespace}/${deploymentName}`;
}

export function forwardServiceKey(namespace: string, serviceName: string): string {
  return `${namespace}/${serviceName}`;
}

export function parseServiceKey(key: string): { namespace: string; name: string } | null {
  const idx = key.indexOf('/');
  if (idx <= 0) return null;
  return { namespace: key.slice(0, idx), name: key.slice(idx + 1) };
}
// [/AI-GEN]
