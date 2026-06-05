import type { MeshProfile } from '@zt-virtual-env/shared';
import { suggestLocalPort } from './suggest-port.js';

interface DeployList {
  items: Array<{
    metadata: {
      name: string;
      namespace: string;
      labels?: Record<string, string>;
    };
    spec: {
      template: {
        spec: {
          containers: Array<{
            ports?: Array<{ containerPort: number }>;
          }>;
        };
      };
    };
  }>;
}

export function parseDeployments(json: DeployList): MeshProfile[] {
  return json.items
    .filter((d) => d.metadata.labels?.['virtual-env'])
    .map((d) => {
      const labels = d.metadata.labels ?? {};
      const containerPort =
        d.spec.template.spec.containers[0]?.ports?.[0]?.containerPort ?? 80;
      const appName = labels['app.kubernetes.io/name'] ?? d.metadata.name;
      return {
        deploymentName: d.metadata.name,
        namespace: d.metadata.namespace,
        virtualEnv: labels['virtual-env']!,
        env: labels['app.kubernetes.io/env'] ?? 'dev',
        appName,
        containerPort,
        suggestedLocalPort: suggestLocalPort(containerPort),
      };
    });
}
