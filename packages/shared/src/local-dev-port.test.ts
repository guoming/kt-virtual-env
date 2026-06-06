import { describe, expect, it } from 'vitest';
import type { MeshProfile } from './types.js';
import {
  classifyDevRuntime,
  deriveServiceName,
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
  it('detects java and node', () => {
    expect(classifyDevRuntime('java')).toBe('java');
    expect(classifyDevRuntime('node')).toBe('node');
    expect(classifyDevRuntime('dotnet')).toBe('dotnet');
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
