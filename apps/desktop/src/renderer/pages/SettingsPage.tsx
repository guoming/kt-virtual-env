import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { requireKtveApi } from '../lib/api';
import { AppUpdatePanel } from '../components/AppUpdatePanel';
import { VersionCompareLine } from '../components/VersionCompareLine';
import { useAppStore } from '../stores/app-store';
import type { ConnectExcludeIpsResult, ConnectOptions, EnvironmentStatus } from '@kt-virtual-env/shared';
import { DEFAULT_CONNECT_OPTIONS, normalizeConnectOptions } from '@kt-virtual-env/shared';

function kubeconfigLabel(path: string): string {
  if (!path.trim()) return '未选择';
  const name = path.replace(/\\/g, '/').split('/').pop();
  return name || '已选择';
}

function CheckItem({
  title,
  description,
  check,
  latestVersion,
  action,
}: {
  title: string;
  description?: string;
  check: { ok: boolean; message: string; version?: string; hint?: string };
  latestVersion?: string;
  action?: ReactNode;
}) {
  return (
    <li className="rounded border bg-white px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={check.ok ? 'text-green-600' : 'text-amber-600'}>
              {check.ok ? '✓' : '○'}
            </span>
            <span className="font-medium">{title}</span>
            <span className="text-sm text-gray-600">{check.message}</span>
          </div>
          {description && (
            <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{description}</p>
          )}
          {check.version && (
            <VersionCompareLine current={check.version} latest={latestVersion} />
          )}
          {!check.ok && check.hint && (
            <p className="mt-2 text-xs text-amber-800">{check.hint}</p>
          )}
        </div>
        {action}
      </div>
    </li>
  );
}

export function SettingsPage() {
  const setHelperRunning = useAppStore((s) => s.setHelperRunning);
  const [kubeconfig, setKubeconfig] = useState('');
  const [context, setContext] = useState('');
  const [meshUserId, setMeshUserId] = useState('');
  const [connectOptions, setConnectOptions] = useState<ConnectOptions>(DEFAULT_CONNECT_OPTIONS);
  const [excludeIpsPreview, setExcludeIpsPreview] = useState<ConnectExcludeIpsResult | null>(
    null,
  );
  const [excludeIpsLoading, setExcludeIpsLoading] = useState(false);
  const [contexts, setContexts] = useState<string[]>([]);
  const [env, setEnv] = useState<EnvironmentStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [envMessage, setEnvMessage] = useState('');

  const runEnvironmentCheck = useCallback(async () => {
    setChecking(true);
    try {
      const status = await requireKtveApi().app.checkEnvironment();
      setEnv(status);
      setHelperRunning(status.helper.running);
      setEnvMessage('');
    } catch (e) {
      setEnvMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  }, [setHelperRunning]);

  const refreshExcludeIpsPreview = useCallback(async () => {
    setExcludeIpsLoading(true);
    try {
      const result = await requireKtveApi().k8s.getConnectExcludeIps();
      setExcludeIpsPreview(result);
    } catch (e) {
      setExcludeIpsPreview({
        ok: false,
        cidrs: [],
        excludeIps: '',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setExcludeIpsLoading(false);
    }
  }, []);

  useEffect(() => {
    void requireKtveApi().config.get().then((cfg) => {
      const c = cfg as {
        kubeconfig: string;
        context: string;
        meshUserId?: string;
        connectOptions?: Partial<ConnectOptions>;
      };
      setKubeconfig(c.kubeconfig);
      setContext(c.context);
      setMeshUserId(c.meshUserId ?? '');
      setConnectOptions(normalizeConnectOptions(c.connectOptions));
    });
    void requireKtveApi().k8s.listContexts().then(setContexts);
    void runEnvironmentCheck();
    void refreshExcludeIpsPreview();
  }, [runEnvironmentCheck, refreshExcludeIpsPreview]);

  const authorizeHelper = async () => {
    setAuthorizing(true);
    setEnvMessage('');
    try {
      const result = await requireKtveApi().helper.authorize();
      setHelperRunning(result.running);
      if (result.running) {
        setEnvMessage('组网授权成功，可进行网络连接');
      } else {
        setEnvMessage('组网授权未完成，请在系统弹窗中确认管理员权限后重新检测');
      }
      await runEnvironmentCheck();
    } catch (e) {
      setEnvMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setAuthorizing(false);
    }
  };

  const save = async () => {
    await requireKtveApi().config.save({
      kubeconfig,
      context,
      meshUserId: meshUserId.trim(),
      connectOptions: normalizeConnectOptions(connectOptions),
    });
    setConnectOptions(normalizeConnectOptions(connectOptions));
    setEnvMessage('配置已保存');
  };

  const patchConnectOptions = (partial: Partial<ConnectOptions>) => {
    setConnectOptions((prev) => normalizeConnectOptions({ ...prev, ...partial }));
  };

  const envReady = env?.helper.running && env?.ktctl.ok && env?.kubectl.ok;

  return (
    <div className="space-y-4">
      <AppUpdatePanel />

      <div className="rounded-lg border bg-gray-50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-medium">环境检测</h3>
            <p className="text-xs text-gray-500">
              联调前请完成环境检测。仅「网络连接」需要组网授权；流量转发、端口转发、流量染色无需管理员权限。
            </p>
          </div>
          <button
            className="rounded border bg-white px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
            disabled={checking}
            onClick={() => void runEnvironmentCheck()}
          >
            {checking ? '检测中…' : '重新检测'}
          </button>
        </div>

        <ul className="space-y-2 text-sm">
          <CheckItem
            title="组网授权"
            description="网络连接（Connect）需修改本机路由与集群 DNS 解析。macOS 首次授权会安装系统服务并常驻后台，崩溃后自动重启，无需重复输入密码；Windows 每次授权需确认管理员权限。"
            check={
              env?.helper ?? { ok: false, message: checking ? '检测中…' : '未检测' }
            }
            action={
              <button
                className="shrink-0 rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:opacity-50"
                disabled={authorizing || env?.helper.message === '组件未安装'}
                onClick={() => void authorizeHelper()}
              >
                {authorizing ? '授权中…' : env?.helper.running ? '重新授权' : '授权组网'}
              </button>
            }
          />
          <CheckItem
            title="ktctl"
            check={env?.ktctl ?? { ok: false, message: '未检测' }}
            latestVersion={env?.bundledKtctlVersion}
          />
          <CheckItem
            title="kubectl"
            check={env?.kubectl ?? { ok: false, message: '未检测' }}
            latestVersion={env?.bundledKubectlVersion}
          />
        </ul>

        <div
          className={`mt-3 rounded px-3 py-2 text-sm ${
            envReady
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {envReady
            ? '环境检测通过，可继续进行网络连接与流量转发。'
            : '环境未就绪：请按上方提示安装工具或完成组网授权后重新检测。'}
        </div>
      </div>

      <h3 className="text-base font-medium">集群与个人配置</h3>

      <div>
        <label className="text-sm">个人标识</label>
        <input
          className="mt-1 w-full rounded border px-2 py-1 text-sm"
          placeholder="如 developer（英文/数字/下划线，勿含点号）"
          value={meshUserId}
          onChange={(e) => setMeshUserId(e.target.value)}
        />
        <p className="mt-1 text-xs text-gray-500">
          用于流量转发与流量染色，x-virtual-env 格式为 dev.v1.developer。
        </p>
      </div>

      <div>
        <label className="text-sm">kubeconfig</label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-700">{kubeconfigLabel(kubeconfig)}</span>
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
            onClick={() => {
              void requireKtveApi()
                .config.pickKubeconfig()
                .then((picked) => {
                  if (picked) setKubeconfig(picked);
                });
            }}
          >
            选择文件
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          示例 kubeconfig 文件名：demo-kubeconfig.yaml
        </p>
      </div>

      <div>
        <label className="text-sm">Context</label>
        <select
          className="mt-1 w-full rounded border px-2 py-1 text-sm"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          disabled={!env?.kubectl.ok}
        >
          <option value="">（默认）</option>
          {contexts.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {!env?.kubectl.ok && (
          <p className="mt-1 text-xs text-amber-700">kubectl 就绪后可加载 Context 列表</p>
        )}
      </div>

      <div className="rounded-lg border bg-gray-50 p-4">
        <h3 className="text-base font-medium">网络连接高级选项</h3>
        <p className="mt-1 text-xs text-gray-500">
          对应 ktctl connect 参数，保存后在下一次「连接集群网络」或「重试」时生效。
        </p>

        <div className="mt-4 space-y-4 text-sm">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={connectOptions.debug}
              onChange={(e) => patchConnectOptions({ debug: e.target.checked })}
            />
            <span>
              <span className="font-medium">调试日志</span>
              <span className="ml-1 text-gray-500">(--debug)</span>
              <p className="mt-0.5 text-xs text-gray-500">
                输出 port-forward / socks 重连日志，排查间歇断线。
              </p>
            </span>
          </label>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={connectOptions.useLocalTime}
              onChange={(e) => patchConnectOptions({ useLocalTime: e.target.checked })}
            />
            <span>
              <span className="font-medium">本机时间心跳</span>
              <span className="ml-1 text-gray-500">(--useLocalTime)</span>
              <p className="mt-0.5 text-xs text-gray-500">
                心跳时间戳使用本机时间，集群与本机时钟偏差大时可避免误触发 clean。
              </p>
            </span>
          </label>

          <div>
            <label className="font-medium">
              Port-forward 超时（秒）
              <span className="ml-1 font-normal text-gray-500">(--portForwardTimeout)</span>
            </label>
            <input
              type="number"
              min={1}
              max={300}
              className="mt-1 w-32 rounded border px-2 py-1 text-sm"
              value={connectOptions.portForwardTimeout}
              onChange={(e) =>
                patchConnectOptions({ portForwardTimeout: Number(e.target.value) })
              }
            />
            <p className="mt-1 text-xs text-gray-500">
              默认 10。网络慢或 API 延迟高时可设为 30 等更大值。
            </p>
          </div>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={connectOptions.excludeIpsEnabled}
              onChange={(e) => patchConnectOptions({ excludeIpsEnabled: e.target.checked })}
            />
            <span className="min-w-0 flex-1">
              <span className="font-medium">排除本机网段</span>
              <span className="ml-1 text-gray-500">(--excludeIps)</span>
              <p className="mt-0.5 text-xs text-gray-500">
                开启后 connect 时自动检测本机 IPv4 网段并排除，避免与集群路由或 VPN 冲突。
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded border bg-white px-2 py-0.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                  disabled={excludeIpsLoading}
                  onClick={() => void refreshExcludeIpsPreview()}
                >
                  {excludeIpsLoading ? '检测中…' : '重新检测本机网段'}
                </button>
                {excludeIpsPreview && (
                  <span
                    className={`text-xs ${excludeIpsPreview.ok ? 'text-gray-600' : 'text-amber-700'}`}
                  >
                    {excludeIpsPreview.ok
                      ? excludeIpsPreview.excludeIps
                      : excludeIpsPreview.message}
                  </span>
                )}
              </div>
            </span>
          </label>

          <div>
            <label className="font-medium">
              隧道模式
              <span className="ml-1 font-normal text-gray-500">(--mode)</span>
            </label>
            <select
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              value={connectOptions.mode}
              onChange={(e) =>
                patchConnectOptions({ mode: e.target.value as ConnectOptions['mode'] })
              }
            >
              <option value="tun2socks">tun2socks（默认，TUN 设备 + SOCKS）</option>
              <option value="sshuttle">sshuttle（SSH VPN，macOS / Linux）</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              休眠唤醒后 tun2socks 路由异常时，可尝试 sshuttle（Windows 不支持）。
            </p>
          </div>
        </div>
      </div>

      <button
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
        onClick={() => void save()}
      >
        保存配置
      </button>

      {envMessage && (
        <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          {envMessage}
        </p>
      )}
    </div>
  );
}
