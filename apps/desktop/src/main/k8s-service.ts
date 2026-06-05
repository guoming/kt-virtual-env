import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseDeployments } from '@zt-virtual-env/k8s-discovery';
import type { MeshProfile } from '@zt-virtual-env/shared';
import { getBundledBinary } from './binary-resolver.js';

const execFileAsync = promisify(execFile);

export class K8sService {
  constructor(
    private kubeconfig: string,
    private context: string,
  ) {}

  private kubectlArgs(args: string[]): string[] {
    const base = ['--kubeconfig', this.kubeconfig];
    if (this.context) {
      base.push('--context', this.context);
    }
    return [...base, ...args];
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const kubectl = getBundledBinary('kubectl');
      await execFileAsync(kubectl, this.kubectlArgs(['cluster-info']), { timeout: 10_000 });
      return { ok: true, message: '集群连接正常' };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }

  async listMeshProfiles(): Promise<MeshProfile[]> {
    const kubectl = getBundledBinary('kubectl');
    const { stdout } = await execFileAsync(
      kubectl,
      this.kubectlArgs(['get', 'deploy', '-A', '-l', 'virtual-env', '-o', 'json']),
      { maxBuffer: 10 * 1024 * 1024 },
    );
    return parseDeployments(JSON.parse(stdout));
  }

  async listNamespaces(prefixes: string[] = ['app-', 'infr-']): Promise<string[]> {
    const kubectl = getBundledBinary('kubectl');
    const { stdout } = await execFileAsync(
      kubectl,
      this.kubectlArgs(['get', 'ns', '-o', 'jsonpath={.items[*].metadata.name}']),
    );
    return stdout.split(/\s+/).filter((n) => n && prefixes.some((p) => n.startsWith(p)));
  }

  async listServices(namespace: string): Promise<Array<{ name: string; port: number }>> {
    const kubectl = getBundledBinary('kubectl');
    const { stdout } = await execFileAsync(
      kubectl,
      this.kubectlArgs(['get', 'svc', '-n', namespace, '-o', 'json']),
    );
    const json = JSON.parse(stdout) as {
      items: Array<{ metadata: { name: string }; spec: { ports?: Array<{ port: number }> } }>;
    };
    return json.items.map((s) => ({
      name: s.metadata.name,
      port: s.spec.ports?.[0]?.port ?? 80,
    }));
  }

  async listContexts(): Promise<string[]> {
    const kubectl = getBundledBinary('kubectl');
    const { stdout } = await execFileAsync(
      kubectl,
      ['config', 'get-contexts', '-o', 'name', '--kubeconfig', this.kubeconfig],
    );
    return stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  }
}
