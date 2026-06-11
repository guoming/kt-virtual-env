import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseDeployments } from '@kt-virtual-env/k8s-discovery';
import type { MeshProfile, NamespaceConnectAccess } from '@kt-virtual-env/shared';
import { getBundledBinary } from './binary-resolver.js';
import { CONNECT_BASELINE_CHECKS, parseAuthCanI } from './k8s-auth.js';
import { filterMeshProfiles } from './mesh-profile-filter.js';

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

  async searchMeshProfiles(
    virtualEnvQuery: string,
    namespace?: string,
    deployQuery?: string,
  ): Promise<MeshProfile[]> {
    const all = await this.listMeshProfiles();
    return filterMeshProfiles(all, virtualEnvQuery, namespace, deployQuery);
  }

  async listNamespaces(prefixes: string[] = ['app-', 'infr-']): Promise<string[]> {
    const kubectl = getBundledBinary('kubectl');
    const { stdout } = await execFileAsync(
      kubectl,
      this.kubectlArgs(['get', 'ns', '-o', 'jsonpath={.items[*].metadata.name}']),
    );
    return stdout.split(/\s+/).filter((n) => n && prefixes.some((p) => n.startsWith(p)));
  }

  private async authCanI(verb: string, resource: string, namespace: string): Promise<boolean> {
    try {
      const kubectl = getBundledBinary('kubectl');
      const { stdout } = await execFileAsync(
        kubectl,
        this.kubectlArgs(['auth', 'can-i', verb, resource, '-n', namespace]),
        { timeout: 5000 },
      );
      return parseAuthCanI(stdout);
    } catch {
      return false;
    }
  }

  async checkConnectNamespaceAccess(namespace: string): Promise<NamespaceConnectAccess> {
    for (const check of CONNECT_BASELINE_CHECKS) {
      const allowed = await this.authCanI(check.verb, check.resource, namespace);
      if (!allowed) {
        return {
          name: namespace,
          canConnect: false,
          reason: `缺少「${check.label}」权限`,
        };
      }
    }
    return { name: namespace, canConnect: true };
  }

  async listConnectNamespaceAccess(
    prefixes: string[] = ['app-', 'infr-'],
  ): Promise<NamespaceConnectAccess[]> {
    const namespaces = await this.listNamespaces(prefixes);
    return Promise.all(namespaces.map((name) => this.checkConnectNamespaceAccess(name)));
  }

  async listConnectNamespaces(prefixes: string[] = ['app-', 'infr-']): Promise<string[]> {
    const rows = await this.listConnectNamespaceAccess(prefixes);
    return rows.filter((row) => row.canConnect).map((row) => row.name);
  }

  async listServices(namespace: string): Promise<Array<{ name: string; port: number }>> {
    const rows = await this.searchServices('', namespace);
    return rows.map(({ name, port }) => ({ name, port }));
  }

  async searchServices(
    query: string,
    namespace?: string,
  ): Promise<Array<{ name: string; namespace: string; port: number }>> {
    const namespaces = namespace ? [namespace] : await this.listNamespaces();
    const q = query.trim().toLowerCase();
    const results: Array<{ name: string; namespace: string; port: number }> = [];

    for (const ns of namespaces) {
      const kubectl = getBundledBinary('kubectl');
      const { stdout } = await execFileAsync(
        kubectl,
        this.kubectlArgs(['get', 'svc', '-n', ns, '-o', 'json']),
      );
      const json = JSON.parse(stdout) as {
        items: Array<{ metadata: { name: string }; spec: { ports?: Array<{ port: number }> } }>;
      };
      for (const s of json.items) {
        const name = s.metadata.name;
        const port = s.spec.ports?.[0]?.port ?? 80;
        const match =
          !q ||
          name.toLowerCase().includes(q) ||
          ns.toLowerCase().includes(q);
        if (match) {
          results.push({ name, namespace: ns, port });
        }
      }
    }

    return results.sort(
      (a, b) => a.namespace.localeCompare(b.namespace) || a.name.localeCompare(b.name),
    );
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
