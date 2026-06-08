import { buildHealthResult } from '@kt-virtual-env/shared';
import type {
  EnvironmentStatus,
  HealthCheckResult,
  LocalDevPort,
  MeshProfile,
  Session,
} from '@kt-virtual-env/shared';

export const MOCK_USER_ID = 'developer';
export const MOCK_CONTEXT = 'demo-cluster@admin';
export const MOCK_KUBECONFIG = '/Users/demo/.kube/demo-kubeconfig.yaml';

export const MOCK_NAMESPACES = [
  'app-demo',
  'app-sample',
  'app-web',
  'app-api',
  'app-auth',
  'app-billing',
  'infr-sample',
  'infr-mock',
];

export const MOCK_LOGS = [
  '11:06AM INF Using cluster context demo-cluster@admin',
  '11:06AM INF KtConnect 0.3.7',
  '11:06AM INF Fetching cluster info...',
  '11:06AM INF Successfully connected to cluster',
  '11:06AM INF Creating shadow pod for demo-api-server',
  '11:06AM INF Waiting for pod demo-api-server ready',
  '11:06AM INF Forwarding port 8080 -> 8080',
];

export const MOCK_SESSIONS: Session[] = [
  {
    id: 'docs-connect',
    type: 'connect',
    target: 'connect',
    namespace: 'app-demo',
    state: 'running',
    startedAt: '2026-06-06T03:06:00.000Z',
    logs: MOCK_LOGS,
    command: 'ktctl connect -n app-demo',
  },
  {
    id: 'docs-forward',
    type: 'forward',
    target: 'sample-gateway',
    namespace: 'infr-sample',
    localPort: 8000,
    remotePort: 8080,
    state: 'running',
    startedAt: '2026-06-06T03:06:10.000Z',
    logs: MOCK_LOGS,
    command: 'ktctl forward sample-gateway.infr-sample 8080:8000',
  },
  {
    id: 'docs-mesh',
    type: 'mesh',
    target: 'demo-api-server',
    namespace: 'app-demo',
    virtualEnv: 'dev.v1.developer',
    localPort: 8080,
    state: 'running',
    startedAt: '2026-06-06T03:06:20.000Z',
    logs: MOCK_LOGS,
    command: 'ktctl mesh demo-api-server -n app-demo --version dev.v1.developer',
  },
];

export const MOCK_CONFIG = {
  kubeconfig: MOCK_KUBECONFIG,
  context: MOCK_CONTEXT,
  meshUserId: MOCK_USER_ID,
  stainUrlHistory: ['http://localhost:3000/'],
  lastStainVirtualEnv: 'dev.v1.developer',
  lastStainBaseVirtualEnv: 'dev.v1',
  stainDevTools: true,
  stainExtensionPaths: [] as string[],
  favoriteMeshKeys: ['app-demo/demo-api-server'],
  favoriteForwardKeys: [] as string[],
};

export const MOCK_ENVIRONMENT: EnvironmentStatus = {
  appVersion: '0.1.5',
  appLatestVersion: '0.1.5',
  bundledKtctlVersion: '0.3.7',
  bundledKubectlVersion: '1.28.15',
  helper: {
    ok: true,
    running: true,
    message: '已授权，可进行网络连接',
  },
  ktctl: {
    ok: true,
    message: '已就绪',
    version: 'ktctl version 0.3.7',
  },
  kubectl: {
    ok: true,
    message: '已就绪',
    version: 'Client Version: v1.28.15',
  },
};

export const MOCK_LOCAL_DEV_PORTS: LocalDevPort[] = [
  {
    port: 8080,
    host: '127.0.0.1',
    runtime: 'java',
    processName: 'java',
    serviceName: 'DemoApiApplication',
    pid: 10001,
  },
  {
    port: 3000,
    host: '127.0.0.1',
    runtime: 'node',
    processName: 'node',
    serviceName: 'demo-app',
    pid: 10002,
  },
  {
    port: 3001,
    host: '127.0.0.1',
    runtime: 'node',
    processName: 'node',
    serviceName: 'demo-admin',
    pid: 10003,
  },
];

const MESH_ROWS: Array<[string, string, string, string, number]> = [
  ['app-demo', 'demo-web-ui', 'demo-web-ui', 'dev', 80],
  ['app-demo', 'demo-api-server', 'demo-api-server', 'dev.v1', 8080],
  ['app-sample', 'sample-gateway', 'sample-gateway', 'dev.v1', 8080],
  ['app-web', 'demo-admin-ui', 'demo-admin-ui', 'dev.v2', 80],
  ['app-api', 'demo-order-api', 'demo-order-api', 'dev.v2', 8080],
  ['app-auth', 'demo-auth-server', 'demo-auth-server', 'dev.v3', 8080],
  ['app-billing', 'demo-billing-api', 'demo-billing-api', 'dev.v4', 8080],
  ['app-demo', 'demo-worker', 'demo-worker', 'dev.v5', 8080],
  ['app-sample', 'sample-worker', 'sample-worker', 'dev.v6', 8080],
  ['app-web', 'demo-portal-ui', 'demo-portal-ui', 'dev.v7', 80],
  ['app-api', 'demo-catalog-api', 'demo-catalog-api', 'dev.v8', 8080],
  ['app-auth', 'demo-session-api', 'demo-session-api', 'dev.v9', 8080],
];

export const MOCK_MESH_PROFILES: MeshProfile[] = MESH_ROWS.map(
  ([namespace, deploymentName, appName, virtualEnv, containerPort]) => ({
    namespace,
    deploymentName,
    appName,
    virtualEnv,
    env: virtualEnv.split('.')[0] ?? 'dev',
    containerPort,
    suggestedLocalPort: containerPort === 80 ? 8080 : containerPort,
  }),
);

export const MOCK_FORWARD_SERVICES = [
  { name: 'sample-gateway', namespace: 'infr-sample', port: 8080 },
  { name: 'demo-redis', namespace: 'infr-mock', port: 6379 },
  { name: 'demo-mysql', namespace: 'infr-mock', port: 3306 },
  { name: 'demo-api-server', namespace: 'app-demo', port: 8080 },
];

export const MOCK_CONTEXTS = [MOCK_CONTEXT, 'demo-cluster@readonly', 'staging-cluster@admin'];

export const MOCK_CONNECT_HEALTH: HealthCheckResult = buildHealthResult('healthy', '集群网络正常', [
  '✓ 集群连接正常',
  '✓ 组网 Helper 已运行',
  '✓ ktctl connect 进程运行中',
  '✓ 集群 DNS 可解析：demo-api-server',
]);

export const MOCK_FORWARD_HEALTH: Record<string, HealthCheckResult> = {
  'docs-forward': buildHealthResult('healthy', '端口转发运行正常', [
    '✓ 端口转发 sample-gateway 运行正常',
  ]),
};

export const MOCK_MESH_HEALTH: Record<string, HealthCheckResult> = {
  'docs-mesh': buildHealthResult('healthy', '流量转发运行正常', [
    '✓ 流量转发 demo-api-server 运行正常',
  ]),
};
