// [AI-GEN] scope:local-exclude-ips, model:auto, reviewed:false
import os from 'node:os';
import type { ConnectExcludeIpsResult } from '@kt-virtual-env/shared';

function isIpv4Family(family: string | number): boolean {
  return family === 'IPv4' || family === 4;
}

function ipv4ToLong(ip: string): number {
  const parts = ip.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
    return 0;
  }
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function longToIpv4(value: number): string {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ].join('.');
}

function netmaskToPrefix(netmask: string): number | undefined {
  const mask = ipv4ToLong(netmask);
  if (mask === 0) return undefined;
  let prefix = 0;
  for (let bit = 31; bit >= 0; bit -= 1) {
    if ((mask >>> bit) & 1) {
      prefix += 1;
    } else {
      break;
    }
  }
  const expected = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return mask === expected ? prefix : undefined;
}

function toNetworkCidr(address: string, netmask: string): string | undefined {
  const prefix = netmaskToPrefix(netmask);
  if (prefix === undefined) return undefined;
  const network = ipv4ToLong(address) & ipv4ToLong(netmask);
  return `${longToIpv4(network)}/${prefix}`;
}

function isLinkLocalCidr(cidr: string): boolean {
  return cidr.startsWith('169.254.');
}

/** 扫描本机非 internal IPv4 网卡，生成 excludeIps 候选 CIDR */
export function detectLocalExcludeIps(): ConnectExcludeIpsResult {
  const cidrs = new Set<string>();

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const info of entries ?? []) {
      if (!isIpv4Family(info.family) || info.internal) continue;
      const cidr = toNetworkCidr(info.address, info.netmask);
      if (!cidr || isLinkLocalCidr(cidr)) continue;
      cidrs.add(cidr);
    }
  }

  const sorted = [...cidrs].sort();
  if (sorted.length === 0) {
    return {
      ok: false,
      cidrs: [],
      excludeIps: '',
      message: '未检测到可用的本机 IPv4 网段',
    };
  }

  return {
    ok: true,
    cidrs: sorted,
    excludeIps: sorted.join(','),
    message: `检测到 ${sorted.length} 个本机网段`,
  };
}
// [/AI-GEN]
