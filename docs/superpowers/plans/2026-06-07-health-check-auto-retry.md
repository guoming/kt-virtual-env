# 健康检查重试与自动恢复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Connect / Forward / Mesh 增加探测层 5×1s 重试，并在连续 2 次非 healthy 时由主进程自动 stop + restart 会话。

**Architecture:** 主进程 `HealthMonitor` 每 10s 调度带重试的健康检查，用 `FailureTracker` 计数，`SessionRecovery` 读取 `RestartSpecRegistry` 中的启动参数执行恢复；Renderer 通过 IPC snapshot + push 展示状态，不再独立轮询。

**Tech Stack:** Electron main process, TypeScript, Vitest, `@kt-virtual-env/shared`

**Spec:** `docs/superpowers/specs/2026-06-07-health-check-auto-retry-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `probe-retry.ts` | 通用 `retryUntilPass` |
| `restart-spec-registry.ts` | 存储 connect/forward/mesh 重启参数 |
| `session-recovery.ts` | 按类型 stop + restart |
| `health-monitor.ts` | 定时检测、计数、触发恢复、缓存、IPC push |
| `health-check.ts` | 子项检查接入 retry |
| `index.ts` | 启动 monitor、注册 IPC、connect/forward/mesh 写入 registry |
| `ktctl-service.ts` | start 时写入 forward/mesh registry |
| `packages/shared/src/health.ts` | 扩展 result 字段 |
| `use-health-polling.ts` | 读 snapshot + 订阅 |
| `HealthStatusPanel.tsx` | recovering UI |

---

### Task 1: 扩展 HealthCheckResult 类型

**Files:**
- Modify: `packages/shared/src/health.ts`
- Test: `packages/shared/src/health.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared/src/health.test.ts
import { describe, it, expect } from 'vitest';
import { buildHealthResult } from './health.js';

describe('buildHealthResult', () => {
  it('includes optional recovery fields when provided', () => {
    const r = buildHealthResult('degraded', '部分异常', ['detail'], {
      recovering: true,
      autoRecoveryCount: 2,
    });
    expect(r.recovering).toBe(true);
    expect(r.autoRecoveryCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kt-virtual-env/desktop exec vitest run ../../packages/shared/src/health.test.ts`
Expected: FAIL — extra argument not accepted

- [ ] **Step 3: Extend buildHealthResult**

```typescript
// packages/shared/src/health.ts — add to interface + builder
export interface HealthCheckResult {
  level: HealthLevel;
  ok: boolean;
  message: string;
  details: string[];
  checkedAt: string;
  recovering?: boolean;
  autoRecoveryCount?: number;
}

export function buildHealthResult(
  level: HealthLevel,
  message: string,
  details: string[] = [],
  extras?: Pick<HealthCheckResult, 'recovering' | 'autoRecoveryCount'>,
): HealthCheckResult {
  return {
    level,
    ok: level === 'healthy',
    message,
    details,
    checkedAt: new Date().toISOString(),
    ...extras,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kt-virtual-env/desktop exec vitest run ../../packages/shared/src/health.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/health.ts packages/shared/src/health.test.ts
git commit -m "feat(shared): extend HealthCheckResult with recovery fields [ai-assisted: auto, 90%]"
```

---

### Task 2: probe-retry 模块

**Files:**
- Create: `apps/desktop/src/main/probe-retry.ts`
- Create: `apps/desktop/src/main/probe-retry.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/desktop/src/main/probe-retry.test.ts
import { describe, it, expect, vi } from 'vitest';
import { retryUntilPass } from './probe-retry.js';

describe('retryUntilPass', () => {
  it('returns true on first success', async () => {
    const fn = vi.fn().mockResolvedValue(true);
    expect(await retryUntilPass(fn)).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries until success', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    expect(await retryUntilPass(fn, { attempts: 5, intervalMs: 1 })).toBe(true);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('returns false after all attempts fail', async () => {
    const fn = vi.fn().mockResolvedValue(false);
    expect(await retryUntilPass(fn, { attempts: 3, intervalMs: 1 })).toBe(false);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm --filter @kt-virtual-env/desktop exec vitest run src/main/probe-retry.test.ts`

- [ ] **Step 3: Implement**

```typescript
// apps/desktop/src/main/probe-retry.ts
export interface RetryOptions {
  attempts?: number;
  intervalMs?: number;
  onAttempt?: (attempt: number) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function retryUntilPass(
  fn: () => Promise<boolean>,
  options: RetryOptions = {},
): Promise<boolean> {
  const attempts = options.attempts ?? 5;
  const intervalMs = options.intervalMs ?? 1000;
  for (let i = 1; i <= attempts; i++) {
    options.onAttempt?.(i);
    if (await fn()) return true;
    if (i < attempts) await sleep(intervalMs);
  }
  return false;
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/probe-retry.ts apps/desktop/src/main/probe-retry.test.ts
git commit -m "feat(desktop): add probe retry helper [ai-assisted: auto, 90%]"
```

---

### Task 3: RestartSpecRegistry

**Files:**
- Create: `apps/desktop/src/main/restart-spec-registry.ts`
- Create: `apps/desktop/src/main/restart-spec-registry.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { RestartSpecRegistry } from './restart-spec-registry.js';

describe('RestartSpecRegistry', () => {
  it('stores and retrieves connect spec', () => {
    const reg = new RestartSpecRegistry();
    const params = { namespace: 'app-x', dnsNamespaces: ['app-x'], kubeconfig: '/k', context: '' };
    reg.setConnect(params);
    expect(reg.getConnect()).toEqual(params);
  });

  it('clears forward spec on delete', () => {
    const reg = new RestartSpecRegistry();
    reg.setForward('id-1', { service: 'svc', namespace: 'ns', localPort: 8080, remotePort: 80, kubeconfig: '/k', context: '' });
    reg.delete('id-1');
    expect(reg.getForward('id-1')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
// apps/desktop/src/main/restart-spec-registry.ts
import type { ConnectParams, ForwardParams, MeshProfile } from '@kt-virtual-env/shared';

export type MeshRestartSpec = {
  type: 'mesh';
  profile: MeshProfile;
  localPort: number;
  userId: string;
};

export type ForwardRestartSpec = { type: 'forward'; params: ForwardParams };
export type SessionRestartSpec = MeshRestartSpec | ForwardRestartSpec;

export class RestartSpecRegistry {
  private connectSpec: ConnectParams | undefined;
  private sessions = new Map<string, SessionRestartSpec>();

  setConnect(params: ConnectParams): void {
    this.connectSpec = params;
  }

  getConnect(): ConnectParams | undefined {
    return this.connectSpec;
  }

  setForward(id: string, params: ForwardParams): void {
    this.sessions.set(id, { type: 'forward', params });
  }

  setMesh(id: string, profile: MeshProfile, localPort: number, userId: string): void {
    this.sessions.set(id, { type: 'mesh', profile, localPort, userId });
  }

  getSession(id: string): SessionRestartSpec | undefined {
    return this.sessions.get(id);
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }

  clearConnect(): void {
    this.connectSpec = undefined;
  }
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

---

### Task 4: health-check 接入 retry

**Files:**
- Modify: `apps/desktop/src/main/health-check.ts`
- Create: `apps/desktop/src/main/health-check.test.ts`

- [ ] **Step 1: Write test for retried port check**

Mock `isLocalPortOpen` to fail twice then succeed; verify result is healthy when process ok.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Refactor checkSessionHealth**

```typescript
// 在 processOk 检查处：
const processOk = await retryUntilPass(
  async () => ktctl.isProcessRunning(session.id),
  { attempts: 5, intervalMs: 1000 },
);

// 在 portOk 检查处：
if (session.localPort) {
  portOk = await retryUntilPass(
    () => isLocalPortOpen(session.localPort!),
    { attempts: 5, intervalMs: 1000 },
  );
}
```

对 `checkConnectHealth` 中 `k8s.testConnection()`、connect PID、DNS 同样包装 `retryUntilPass`。Helper 检查保持单次。

- [ ] **Step 4: Run health-check tests — PASS**

- [ ] **Step 5: Commit**

---

### Task 5: FailureTracker + SessionRecovery

**Files:**
- Create: `apps/desktop/src/main/session-recovery.ts`
- Create: `apps/desktop/src/main/session-recovery.test.ts`

- [ ] **Step 1: Write FailureTracker test**

```typescript
describe('FailureTracker', () => {
  it('triggers recovery after 2 non-healthy results', () => {
    const tracker = new FailureTracker();
    expect(tracker.record('s1', 'healthy')).toBe(false);
    expect(tracker.record('s1', 'degraded')).toBe(false);
    expect(tracker.record('s1', 'unhealthy')).toBe(true);
    expect(tracker.record('s1', 'healthy')).toBe(false);
    expect(tracker.get('s1')).toBe(0);
  });

  it('ignores unknown level', () => {
    const tracker = new FailureTracker();
    expect(tracker.record('s1', 'unknown')).toBe(false);
    expect(tracker.get('s1')).toBe(0);
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement SessionRecovery**

```typescript
// session-recovery.ts — 核心接口
export class FailureTracker {
  private counts = new Map<string, number>();
  record(key: string, level: HealthLevel): boolean {
    if (level === 'healthy') { this.counts.set(key, 0); return false; }
    if (level === 'unknown') return false;
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    if (next >= 2) { this.counts.set(key, 0); return true; }
    return false;
  }
  reset(key: string): void { this.counts.delete(key); }
  get(key: string): number { return this.counts.get(key) ?? 0; }
}

export interface RecoveryDeps {
  registry: RestartSpecRegistry;
  sessions: SessionManager;
  ktctl: KtctlService;
  recoverConnect: (params: ConnectParams) => Promise<void>;
  appendLog: (id: string, line: string) => void;
}

export class SessionRecovery {
  private recovering = new Set<string>();
  private recoveryCounts = new Map<string, number>();

  constructor(private deps: RecoveryDeps) {}

  isRecovering(key: string): boolean {
    return this.recovering.has(key);
  }

  getRecoveryCount(key: string): number {
    return this.recoveryCounts.get(key) ?? 0;
  }

  async recoverConnect(): Promise<void> {
    const key = 'connect';
    if (this.recovering.has(key)) return;
    const params = this.deps.registry.getConnect();
    if (!params) return;
    this.recovering.add(key);
    const n = (this.recoveryCounts.get(key) ?? 0) + 1;
    this.recoveryCounts.set(key, n);
    try {
      await this.deps.recoverConnect(params);
    } finally {
      this.recovering.delete(key);
    }
  }

  async recoverSession(sessionId: string): Promise<void> {
    if (this.recovering.has(sessionId)) return;
    const spec = this.deps.registry.getSession(sessionId);
    const session = this.deps.sessions.get(sessionId);
    if (!spec || !session) return;
    this.recovering.add(sessionId);
    const n = (this.recoveryCounts.get(sessionId) ?? 0) + 1;
    this.recoveryCounts.set(sessionId, n);
    this.deps.appendLog(sessionId, `[auto-recovery] 健康检查连续 2 次异常，正在自动重启（第 ${n} 次）…`);
    try {
      await this.deps.ktctl.stopSession(sessionId);
      if (spec.type === 'forward') {
        this.deps.ktctl.startForward(spec.params);
      } else {
        this.deps.ktctl.startMesh(spec.profile, spec.localPort, spec.userId);
      }
    } finally {
      this.recovering.delete(sessionId);
    }
  }
}
```

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

---

### Task 6: HealthMonitor

**Files:**
- Create: `apps/desktop/src/main/health-monitor.ts`
- Create: `apps/desktop/src/main/health-monitor.test.ts`

- [ ] **Step 1: Write test — tracker triggers recovery on 2nd degraded**

Mock check functions returning degraded twice; assert `recoverSession` called once.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement HealthMonitor**

```typescript
export interface HealthSnapshot {
  connect: HealthCheckResult | null;
  sessions: Record<string, HealthCheckResult>;
}

export class HealthMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private snapshot: HealthSnapshot = { connect: null, sessions: {} };
  private tracker = new FailureTracker();

  constructor(
    private deps: {
      intervalMs: number;
      getConnectSession: () => Session | undefined;
      isHelperRunning: () => Promise<boolean>;
      k8s: () => K8sService;
      listActiveSessions: () => Session[];
      ktctl: KtctlService;
      recovery: SessionRecovery;
      onChanged: (snapshot: HealthSnapshot) => void;
    },
  ) {}

  start(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.deps.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getSnapshot(): HealthSnapshot {
    return this.snapshot;
  }

  async forceCheck(): Promise<HealthSnapshot> {
    await this.tick();
    return this.snapshot;
  }

  private async tick(): Promise<void> {
    // connect check — skip if recovering
    if (!this.deps.recovery.isRecovering('connect')) {
      const connectSession = this.deps.getConnectSession();
      const result = await checkConnectHealth(
        connectSession,
        await this.deps.isHelperRunning(),
        this.deps.k8s(),
      );
      const enriched = this.enrich('connect', result);
      this.snapshot.connect = enriched;
      if (this.tracker.record('connect', enriched.level)) {
        await this.deps.recovery.recoverConnect();
      }
    }

    const sessions = this.deps.listActiveSessions().filter(
      (s) => s.type !== 'connect' && s.state === 'running',
    );
    const nextSessions: Record<string, HealthCheckResult> = {};
    await Promise.all(
      sessions.map(async (s) => {
        if (this.deps.recovery.isRecovering(s.id)) return;
        const result = await checkSessionHealth(s, this.deps.ktctl);
        const enriched = this.enrich(s.id, result);
        nextSessions[s.id] = enriched;
        if (this.tracker.record(s.id, enriched.level)) {
          await this.deps.recovery.recoverSession(s.id);
        }
      }),
    );
    this.snapshot.sessions = nextSessions;
    this.deps.onChanged(this.snapshot);
  }

  private enrich(key: string, result: HealthCheckResult): HealthCheckResult {
    return buildHealthResult(result.level, result.message, result.details, {
      recovering: this.deps.recovery.isRecovering(key),
      autoRecoveryCount: this.deps.recovery.getRecoveryCount(key) || undefined,
    });
  }
}
```

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

---

### Task 7: 集成 index.ts + ktctl-service + registry 写入

**Files:**
- Modify: `apps/desktop/src/main/index.ts`
- Modify: `apps/desktop/src/main/ktctl-service.ts`

- [ ] **Step 1: ktctl-service 接受 registry 并在 start 时写入**

```typescript
// KtctlService constructor 增加 registry: RestartSpecRegistry
// startForward 末尾:
this.registry.setForward(session.id, { ...params from args });

// startMesh 末尾:
this.registry.setMesh(session.id, profile, localPort, userId);

// stopSession 末尾:
this.registry.delete(id);
```

- [ ] **Step 2: index.ts 初始化 monitor**

```typescript
const restartRegistry = new RestartSpecRegistry();
const ktctlService = new KtctlService(sessions, restartRegistry);

// connect:start 成功创建 session 后:
restartRegistry.setConnect(params);

// connect:stop / connect session stop:
restartRegistry.clearConnect();

// app.whenReady 后:
const healthMonitor = new HealthMonitor({ intervalMs: 10_000, ... });
healthMonitor.start();

// IPC:
ipcMain.handle('health:getSnapshot', () => healthMonitor.getSnapshot());
ipcMain.handle('health:forceCheck', () => healthMonitor.forceCheck());
// health:checkConnect 等改为读 snapshot 或 delegate forceCheck
```

- [ ] **Step 3: 实现 recoverConnect 回调**

复用现有 `connect:stop` + `connect:start` 逻辑，提取为 `async function restartConnect(params: ConnectParams)` 供 SessionRecovery 调用。

- [ ] **Step 4: 手动 smoke — 启动 app 无报错**

Run: `pnpm --filter @kt-virtual-env/desktop dev`

- [ ] **Step 5: Commit**

---

### Task 8: Preload + Renderer 改造

**Files:**
- Modify: `apps/desktop/src/preload/index.ts`
- Modify: `apps/desktop/src/renderer/lib/ktve-api.ts`
- Modify: `apps/desktop/src/renderer/hooks/use-health-polling.ts`
- Modify: `apps/desktop/src/renderer/components/HealthStatusPanel.tsx`
- Modify: `apps/desktop/src/renderer/docs/create-mock-api.ts`

- [ ] **Step 1: Preload 暴露新 API**

```typescript
health: {
  getSnapshot: () => ipcRenderer.invoke('health:getSnapshot'),
  forceCheck: () => ipcRenderer.invoke('health:forceCheck'),
  onChanged: (cb) => {
    const handler = (_e, snapshot) => cb(snapshot);
    ipcRenderer.on('health:changed', handler);
    return () => ipcRenderer.removeListener('health:changed', handler);
  },
  // 保留 checkConnect 等 — 内部调 forceCheck 取子集
}
```

- [ ] **Step 2: 改造 useHealthPolling**

```typescript
export function useHealthPolling(
  select: (snapshot: HealthSnapshot) => HealthCheckResult | null,
  enabled: boolean,
) {
  // mount: getSnapshot + onChanged
  // 移除 setInterval
  // refresh → forceCheck
}
```

ConnectPage: `select = (s) => s.connect`
ForwardPage: `select = (s) => summarizeHealth(...)`

- [ ] **Step 3: HealthStatusPanel recovering 文案**

```tsx
{result?.recovering && (
  <p className="text-xs text-amber-800">自动恢复中…（已恢复 {result.autoRecoveryCount ?? 0} 次）</p>
)}
```

- [ ] **Step 4: 更新 mock API**

- [ ] **Step 5: Run vitest + dev smoke**

Run: `pnpm --filter @kt-virtual-env/desktop exec vitest run`
Run: `pnpm --filter @kt-virtual-env/desktop dev`

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(desktop): wire health monitor to renderer IPC [ai-assisted: auto, 85%]"
```

---

### Task 9: 端到端手动验证

**Files:**
- Modify: `docs/e2e-manual-checklist.md`

- [ ] **Step 1: 追加 checklist 条目**

```markdown
- [ ] Forward 本地端口不可达时，健康检查重试后仍失败，约 20s 后自动重启
- [ ] Mesh 停止本地 Java 进程后，连续 2 次 degraded 触发自动 mesh 重启
- [ ] Connect 断网后连续 2 次异常触发自动重连，会话日志含 [auto-recovery]
- [ ] 切换页面后自动恢复仍生效（主进程后台监控）
```

- [ ] **Step 2: 手动执行并勾选**

- [ ] **Step 3: Commit**

```bash
git add docs/e2e-manual-checklist.md
git commit -m "docs: add health auto-recovery e2e checklist items [ai-assisted: auto, 80%]"
```

---

## Spec Coverage Checklist

| Spec 要求 | Task |
|-----------|------|
| 5×1s 探测重试 | Task 2, 4 |
| 连续 2 次非 healthy 恢复 | Task 5, 6 |
| 无冷却、不可关闭 | Task 5 (无 cooldown 逻辑) |
| Connect/Forward/Mesh 全覆盖 | Task 5, 7 |
| RestartSpecRegistry | Task 3, 7 |
| 主进程 HealthMonitor | Task 6, 7 |
| IPC snapshot + push | Task 7, 8 |
| UI recovering 展示 | Task 8 |
| 测试 | Task 1–6, 9 |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-07-health-check-auto-retry.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — 每个 Task 派发独立 subagent，任务间 review
2. **Inline Execution** — 本会话按 Task 顺序直接实现，checkpoint Review

Which approach?
