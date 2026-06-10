import type { MeshProfile } from './types.js';

export interface MeshCommand {
  args: string[];
  display: string;
  meshVersion: string;
}

/** 集群 virtual-env 追加个人标识，如 dev.v1 + guoming → dev.v1.guoming */
export function buildMeshVersion(baseVirtualEnv: string, userId: string): string {
  const id = userId.trim();
  if (!id) {
    throw new Error('个人标识不能为空');
  }
  if (id.includes('.')) {
    throw new Error('个人标识不能包含点号');
  }
  return `${baseVirtualEnv}.${id}`;
}

/** ktctl mesh 目标名：多版本 Deployment 共用同一 Service 名 */
export function meshTargetName(profile: MeshProfile): string {
  const name = profile.appName.trim();
  return name || profile.deploymentName;
}

export function buildMeshCommand(
  profile: MeshProfile,
  localPort: number,
  userId: string,
  versionMarkBaseVirtualEnv = profile.virtualEnv,
): MeshCommand {
  const meshVersion = buildMeshVersion(versionMarkBaseVirtualEnv, userId);
  const selector = [
    `app.kubernetes.io/env=${profile.env}`,
    `app.kubernetes.io/name=${profile.appName}`,
    `virtual-env=${profile.virtualEnv}`,
  ].join(',');

  const target = meshTargetName(profile);
  const args = [
    'mesh',
    target,
    '--namespace',
    profile.namespace,
    '--versionMark',
    `virtual-env:${meshVersion}`,
    '-l',
    selector,
    '--expose',
    `${localPort}:${profile.containerPort}`,
    '--mode',
    'manual',
    '--useShadowDeployment',
    '--podCreationTimeout',
    '120',
  ];

  const display = `ktctl ${args.join(' ')}`;
  return { args, display, meshVersion };
}
