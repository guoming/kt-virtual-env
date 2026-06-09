import { describe, expect, it } from 'vitest';
import type { MeshProfile } from './types.js';
import {
  classifyDevRuntime,
  deriveServiceName,
  filterLocalDevPorts,
  listOfflineFavoritePorts,
  sortLocalDevPortsByFavorites,
  suggestMeshPortFromDiscovery,
  type LocalDevPort,
} from './local-dev-port.js';

const profile: MeshProfile = {
  deploymentName: 'ark-server',
  namespace: 'app-ark',
  virtualEnv: 'dev.v1',
  env: 'dev',
  appName: 'ark-server',
  containerPort: 8080,
  suggestedLocalPort: 8080,
};

describe('classifyDevRuntime', () => {
  it('detects common dev runtimes from process name', () => {
    expect(classifyDevRuntime('java')).toBe('java');
    expect(classifyDevRuntime('node')).toBe('node');
    expect(classifyDevRuntime('dotnet')).toBe('dotnet');
    expect(classifyDevRuntime('com.docke')).toBe('docker');
    expect(classifyDevRuntime('docker-pr')).toBe('docker');
    expect(classifyDevRuntime('OrbStack')).toBe('docker');
    expect(classifyDevRuntime('php')).toBe('php');
    expect(classifyDevRuntime('php-fpm')).toBe('php');
  });

  it('detects go and docker from command line', () => {
    expect(classifyDevRuntime('main', 'go run ./cmd/api')).toBe('go');
    expect(classifyDevRuntime('docker-pr', 'docker-proxy -proto tcp -host-ip 0.0.0.0')).toBe(
      'docker',
    );
  });
});

describe('deriveServiceName', () => {
  it('extracts jar and project names', () => {
    expect(
      deriveServiceName(
        'java',
        'java',
        'java -jar target/ark-buddy-admin-server.jar --spring.profiles.active=dev',
      ),
    ).toBe('ark-buddy-admin-server');
    expect(
      deriveServiceName('node', 'node', 'node /Users/dev/ark-portal/server.js'),
    ).toBe('ark-portal');
    expect(
      deriveServiceName('node', 'node', 'node /Users/dev/ark-portal/dist/index.js'),
    ).toBe('ark-portal');
    expect(
      deriveServiceName('dotnet', 'dotnet', 'dotnet exec MyService.Api.dll'),
    ).toBe('MyService.Api');
    expect(
      deriveServiceName('php', 'php', 'php artisan serve --port=8000'),
    ).toBe('laravel');
    expect(deriveServiceName('go', 'go', 'go run ./cmd/gateway/main.go')).toBe('gateway');
  });
});

describe('suggestMeshPortFromDiscovery', () => {
  const ports: LocalDevPort[] = [
    {
      port: 3000,
      host: '127.0.0.1',
      runtime: 'node',
      processName: 'node',
      serviceName: 'vite',
      pid: 1,
    },
    {
      port: 8080,
      host: '127.0.0.1',
      runtime: 'java',
      processName: 'java',
      serviceName: 'ark-server',
      pid: 2,
    },
  ];

  it('prefers container port match', () => {
    const hit = suggestMeshPortFromDiscovery(profile, ports, []);
    expect(hit?.port).toBe(8080);
    expect(hit?.runtime).toBe('java');
  });
});

describe('sortLocalDevPortsByFavorites', () => {
  const ports: LocalDevPort[] = [
    {
      port: 3000,
      host: '127.0.0.1',
      runtime: 'node',
      processName: 'node',
      serviceName: 'web',
      pid: 1,
    },
    {
      port: 8080,
      host: '127.0.0.1',
      runtime: 'java',
      processName: 'java',
      serviceName: 'api',
      pid: 2,
    },
    {
      port: 8888,
      host: '127.0.0.1',
      runtime: 'java',
      processName: 'java',
      serviceName: 'goods',
      pid: 3,
    },
  ];

  it('puts favorite ports first then sorts by number', () => {
    const sorted = sortLocalDevPortsByFavorites(ports, [8888, 3000]);
    expect(sorted.map((p) => p.port)).toEqual([3000, 8888, 8080]);
  });
});

describe('filterLocalDevPorts', () => {
  const ports: LocalDevPort[] = [
    {
      port: 8080,
      host: '127.0.0.1',
      runtime: 'java',
      processName: 'java',
      serviceName: 'GoodsApp',
      pid: 1,
    },
    {
      port: 8888,
      host: '127.0.0.1',
      runtime: 'java',
      processName: 'java',
      serviceName: 'OrderApp',
      pid: 2,
    },
    {
      port: 3000,
      host: '127.0.0.1',
      runtime: 'node',
      processName: 'node',
      serviceName: 'portal-web',
      pid: 3,
    },
  ];

  it('filters by port prefix', () => {
    expect(filterLocalDevPorts(ports, '8').map((p) => p.port)).toEqual([8080, 8888]);
    expect(filterLocalDevPorts(ports, '808').map((p) => p.port)).toEqual([8080]);
    expect(filterLocalDevPorts(ports, '888').map((p) => p.port)).toEqual([8888]);
  });

  it('filters by service name', () => {
    expect(filterLocalDevPorts(ports, 'goods').map((p) => p.port)).toEqual([8080]);
    expect(filterLocalDevPorts(ports, 'portal').map((p) => p.port)).toEqual([3000]);
  });

  it('filters by runtime label', () => {
    expect(filterLocalDevPorts(ports, 'node').map((p) => p.port)).toEqual([3000]);
    expect(filterLocalDevPorts(ports, 'java').map((p) => p.port)).toEqual([8080, 8888]);
    expect(filterLocalDevPorts(ports, 'c#').map((p) => p.port)).toEqual([]);
  });
});

describe('listOfflineFavoritePorts', () => {
  it('returns favorites not in current scan', () => {
    const discovered: LocalDevPort[] = [
      {
        port: 8080,
        host: '127.0.0.1',
        runtime: 'java',
        processName: 'java',
        serviceName: 'api',
        pid: 1,
      },
    ];
    expect(listOfflineFavoritePorts(discovered, [8080, 8888, 3306])).toEqual([3306, 8888]);
  });
});
