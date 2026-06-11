// [AI-GEN] scope:kubectl-error, model:auto, reviewed:false
/** 将 kubectl 原始错误转为用户可读提示 */
export function formatKubectlError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const detail = extractKubectlDetail(raw);

  if (/i\/o timeout|unable to connect to the server|dial tcp|connection refused|no route to host/i.test(detail)) {
    const target = detail.match(/dial tcp ([^\s:]+(?::\d+)?)/i)?.[1]
      ?? detail.match(/server:\s*([^\s]+)/i)?.[1]
      ?? 'API Server';
    return `无法连接集群 ${target}，请确认已接入内网或 VPN`;
  }

  if (/context .* does not exist|current-context is not set/i.test(detail)) {
    return 'kubeconfig 上下文无效，请在配置页重新选择集群';
  }

  if (/Unauthorized|Forbidden|authentication/i.test(detail)) {
    return '集群认证失败，请检查 kubeconfig 凭证是否过期';
  }

  return detail.length > 240 ? `${detail.slice(0, 240)}…` : detail;
}

function extractKubectlDetail(raw: string): string {
  const markers = ['Unable to connect', 'error:', 'Error from server', 'dial tcp', 'context '];
  for (const marker of markers) {
    const idx = raw.indexOf(marker);
    if (idx >= 0) {
      return raw.slice(idx).trim();
    }
  }
  const commandIdx = raw.indexOf('Command failed:');
  if (commandIdx >= 0) {
    return raw.slice(commandIdx + 'Command failed:'.length).trim();
  }
  return raw.trim();
}

export function isKubectlReachabilityError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error);
  const detail = extractKubectlDetail(raw);
  return /i\/o timeout|unable to connect to the server|dial tcp|connection refused|no route to host/i.test(
    detail,
  );
}
// [/AI-GEN]
