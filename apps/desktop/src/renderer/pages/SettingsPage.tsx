import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { requireKtveApi } from '../lib/api';
import { APP_NAME, APP_SLOGAN } from '../lib/branding';
import { useAppStore } from '../stores/app-store';
import type { EnvironmentStatus } from '@kt-virtual-env/shared';

function kubeconfigLabel(path: string): string {
  if (!path.trim()) return '未选择';
  const name = path.replace(/\\/g, '/').split('/').pop();
  return name || '已选择';
}

function CheckItem({
  title,
  description,
  check,
  action,
}: {
  title: string;
  description?: string;
  check: { ok: boolean; message: string; version?: string; hint?: string };
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
            <p className="mt-1 font-mono text-xs text-gray-500">{check.version}</p>
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
    } catch (e) {
      setEnvMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  }, [setHelperRunning]);

  useEffect(() => {
    void requireKtveApi().config.get().then((cfg) => {
      setKubeconfig(cfg.kubeconfig as string);
      setContext(cfg.context as string);
      setMeshUserId((cfg.meshUserId as string) ?? '');
    });
    void requireKtveApi().k8s.listContexts().then(setContexts);
    void runEnvironmentCheck();
  }, [runEnvironmentCheck]);

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
    await requireKtveApi().config.save({ kubeconfig, context, meshUserId: meshUserId.trim() });
    setEnvMessage('配置已保存');
  };

  const envReady = env?.helper.running && env?.ktctl.ok && env?.kubectl.ok;

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <h2 className="text-lg font-semibold">{APP_NAME}</h2>
        <p className="text-sm text-gray-500">{APP_SLOGAN}</p>
      </div>

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
            description="网络连接（Connect）需修改本机路由与集群 DNS 解析，须一次性授予管理员权限。授权后后台常驻，避免每次连接重复输入密码。"
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
          <CheckItem title="ktctl" check={env?.ktctl ?? { ok: false, message: '未检测' }} />
          <CheckItem title="kubectl" check={env?.kubectl ?? { ok: false, message: '未检测' }} />
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

        {env && (
          <p className="mt-2 text-xs text-gray-500">应用版本：{env.appVersion}</p>
        )}
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
