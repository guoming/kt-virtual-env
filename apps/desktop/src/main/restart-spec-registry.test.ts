import { describe, it, expect } from 'vitest';
import { RestartSpecRegistry } from './restart-spec-registry.js';

describe('RestartSpecRegistry', () => {
  it('stores and retrieves connect spec', () => {
    const reg = new RestartSpecRegistry();
    const params = {
      namespace: 'app-x',
      dnsNamespaces: ['app-x'],
      kubeconfig: '/k',
      context: '',
    };
    reg.setConnect(params);
    expect(reg.getConnect()).toEqual(params);
    reg.clearConnect();
    expect(reg.getConnect()).toBeUndefined();
  });

  it('clears forward spec on delete', () => {
    const reg = new RestartSpecRegistry();
    reg.setForward('id-1', {
      service: 'svc',
      namespace: 'ns',
      localPort: 8080,
      remotePort: 80,
      kubeconfig: '/k',
      context: '',
    });
    reg.delete('id-1');
    expect(reg.getForward('id-1')).toBeUndefined();
  });
});
