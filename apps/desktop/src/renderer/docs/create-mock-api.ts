import type { AppUpdateStatus } from '@kt-virtual-env/shared';
import type { KtveApi } from '../lib/ktve-api';
import {
  MOCK_CONFIG,
  MOCK_CONNECT_HEALTH,
  MOCK_CONTEXTS,
  MOCK_ENVIRONMENT,
  MOCK_FORWARD_HEALTH,
  MOCK_FORWARD_SERVICES,
  MOCK_LOCAL_DEV_PORTS,
  MOCK_MESH_HEALTH,
  MOCK_MESH_PROFILES,
  MOCK_NAMESPACES,
  MOCK_SESSIONS,
} from './mock-data';

function noopUnsub(): () => void {
  return () => {};
}

function filterProfiles(virtualEnvQuery: string, ns?: string, deployQuery?: string) {
  const ve = virtualEnvQuery.trim().toLowerCase();
  const deploy = deployQuery?.trim().toLowerCase() ?? '';
  return MOCK_MESH_PROFILES.filter((profile) => {
    if (ns && profile.namespace !== ns) return false;
    if (ve && !profile.virtualEnv.toLowerCase().includes(ve)) return false;
    if (
      deploy &&
      !profile.deploymentName.toLowerCase().includes(deploy) &&
      !profile.appName.toLowerCase().includes(deploy)
    ) {
      return false;
    }
    return true;
  });
}

function filterServices(query: string, ns?: string) {
  const q = query.trim().toLowerCase();
  return MOCK_FORWARD_SERVICES.filter((service) => {
    if (ns && service.namespace !== ns) return false;
    if (!q) return true;
    return (
      service.name.toLowerCase().includes(q) ||
      service.namespace.toLowerCase().includes(q)
    );
  });
}

const MOCK_UPDATE_STATUS: AppUpdateStatus = {
  phase: 'unsupported',
  currentVersion: '0.1.5',
  latestVersion: '0.1.5',
  message: '文档预览模式',
};

// [AI-GEN] scope:create-mock-api, model:auto, reviewed:false
export function createMockApi(): KtveApi {
  let config = { ...MOCK_CONFIG };

  return {
    config: {
      get: async () => ({ ...config }),
      save: async (next) => {
        config = { ...config, ...(next as typeof config) };
        return config;
      },
      pickKubeconfig: async () => MOCK_CONFIG.kubeconfig,
    },
    app: {
      versions: async () => ({ app: '0.1.5', ktctl: '0.3.7', kubectl: 'v1.28.15' }),
      checkEnvironment: async () => MOCK_ENVIRONMENT,
      onConfirmExit: () => noopUnsub(),
      forceQuit: async () => {},
    },
    update: {
      getStatus: async () => MOCK_UPDATE_STATUS,
      check: async () => MOCK_UPDATE_STATUS,
      install: async () => ({ ok: true as const }),
      onChanged: () => noopUnsub(),
    },
    k8s: {
      listProfiles: async () => MOCK_MESH_PROFILES,
      searchProfiles: async (virtualEnvQuery, ns, deployQuery) =>
        filterProfiles(virtualEnvQuery, ns, deployQuery),
      listNamespaces: async () => MOCK_NAMESPACES,
      listServices: async (namespace) =>
        MOCK_FORWARD_SERVICES.filter((service) => service.namespace === namespace),
      searchServices: async (query, ns) => filterServices(query, ns),
      listContexts: async () => MOCK_CONTEXTS,
      testConnection: async () => ({ ok: true, message: '集群连接正常' }),
    },
    mesh: {
      start: async () => 'docs-mesh',
    },
    forward: {
      start: async () => 'docs-forward',
    },
    connect: {
      start: async () => 'docs-connect',
      stop: async () => {},
    },
    helper: {
      status: async () => ({ running: true }),
      authorize: async () => ({ running: true }),
    },
    sessions: {
      list: async () => MOCK_SESSIONS,
      stop: async () => {},
      stopAll: async () => {},
      onUpdate: (cb) => {
        cb(MOCK_SESSIONS);
        return noopUnsub();
      },
    },
    ktctl: {
      recover: async () => {},
      clean: async () => {},
    },
    shell: {
      openExternal: async () => {},
    },
    stain: {
      open: async (url, virtualEnv) => ({ id: 'docs-stain', url, virtualEnv }),
      pickExtensionDir: async () => null,
      list: async () => [],
      close: async () => {},
      closeAll: async () => {},
      focus: async () => {},
      toggleDevTools: async () => {},
    },
    health: {
      getSnapshot: async () => ({
        connect: MOCK_CONNECT_HEALTH,
        sessions: { ...MOCK_FORWARD_HEALTH, ...MOCK_MESH_HEALTH },
      }),
      forceCheck: async () => ({
        connect: MOCK_CONNECT_HEALTH,
        sessions: { ...MOCK_FORWARD_HEALTH, ...MOCK_MESH_HEALTH },
      }),
      onChanged: () => noopUnsub(),
      checkConnect: async () => MOCK_CONNECT_HEALTH,
      checkSession: async (id) =>
        MOCK_FORWARD_HEALTH[id] ?? MOCK_MESH_HEALTH[id] ?? MOCK_CONNECT_HEALTH,
      checkSessionsByType: async (type) => {
        if (type === 'forward') return MOCK_FORWARD_HEALTH;
        if (type === 'mesh') return MOCK_MESH_HEALTH;
        return {};
      },
    },
    system: {
      pickLocalPort: async (_reserved, preferred) => preferred,
      listLocalDevPorts: async () => MOCK_LOCAL_DEV_PORTS,
      pickMeshLocalPort: async (profile) => ({
        port: profile.suggestedLocalPort,
        host: '127.0.0.1',
        runtime: 'java',
        processName: 'java',
        serviceName: 'DemoApiApplication',
        pid: 10001,
      }),
      validateMeshLocalPort: async () => {},
    },
  };
}
// [/AI-GEN]
