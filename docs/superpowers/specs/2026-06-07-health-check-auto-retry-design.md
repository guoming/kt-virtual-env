# Connect / Forward / Mesh 健康检查重试与自动恢复 — 设计规格

> 日期：2026-06-07  
> 状态：已评审  
> 项目：zt-virtual-env 桌面工具（Electron）

## 1. 背景与目标

### 1.1 现状

应用已为 Connect、Forward、Mesh 提供健康检查（`health-check.ts`），Renderer 每 10s 轮询一次（`use-health-polling.ts`）：

| 类型 | 检查项 | 问题 |
|------|--------|------|
| Forward / Mesh | ktctl 进程存活 + 本地端口 TCP 探测 | 单次探测、无重试；无自动恢复 |
| Connect | 集群连通、Helper、connect PID、DNS | 单次探测、无重试；无自动恢复 |

端口探测使用 `isLocalPortOpen`（超时 2s，无重试）。检查失败仅更新 UI 状态，不采取任何恢复动作。

### 1.2 目标

为 Connect、Forward、Mesh 增加两层机制：

1. **探测层重试（防抖）**：单次轮询内对可重试项最多 5 次、间隔 1s，任一次成功即该项通过。
2. **会话层自动恢复**：连续 2 次轮询结果为 **非 healthy**（含 degraded）时，自动 stop + restart 对应会话。

### 1.3 已确认决策

| 维度 | 决策 |
|------|------|
| 范围 | Connect + Forward + Mesh |
| 探测重试 | 5 次，间隔 1s，任一次成功即通过 |
| 自动恢复触发 | 连续 2 次 **非 healthy**（degraded + unhealthy） |
| 恢复策略 | 立即 stop + restart，**无冷却上限**，**不可关闭** |
| 架构 | 主进程 `HealthMonitor` 后台监控 + Renderer 读缓存（方案 3） |

---

## 2. 架构

### 2.1 组件

```
┌──────────────────────────────────────────────────────────┐
│ Main Process                                              │
│                                                           │
│  HealthMonitor (10s interval)                            │
│    ├─ runConnectCheck()    ──► checkConnectHealth + retry │
│    ├─ runSessionChecks()   ──► checkSessionHealth + retry │
│    ├─ FailureTracker       ──► 连续失败计数               │
│    ├─ SessionRecovery      ──► stop + restart              │
│    └─ HealthSnapshotCache  ──► 最新结果                    │
│                                                           │
│  RestartSpecRegistry       ──► Mesh/Forward 重启参数       │
└──────────────────────────────────────────────────────────┘
          │ IPC: health:getSnapshot / health:forceCheck
          │ IPC: health:changed (push)
          ▼
┌──────────────────────────────────────────────────────────┐
│ Renderer                                                  │
│  useHealthPolling → 读缓存 + 订阅 health:changed          │
│  HealthStatusPanel → 展示 recovering / 恢复次数          │
└──────────────────────────────────────────────────────────┘
```

### 2.2 新增模块

| 文件 | 职责 |
|------|------|
| `apps/desktop/src/main/probe-retry.ts` | 通用重试包装 `retryUntilPass` |
| `apps/desktop/src/main/health-monitor.ts` | 定时调度、失败计数、触发恢复、缓存 |
| `apps/desktop/src/main/session-recovery.ts` | 按 session 类型执行 restart |
| `apps/desktop/src/main/restart-spec-registry.ts` | 存储 Mesh/Forward/Connect 重启所需参数 |

### 2.3 改造模块

| 文件 | 变更 |
|------|------|
| `health-check.ts` | 子项检查接入 `retryUntilPass`；可选接收 `onRetry` 回调 |
| `index.ts` | 启动 `HealthMonitor`；注册新 IPC |
| `ktctl-service.ts` | 启动 session 时写入 `RestartSpecRegistry` |
| `preload/index.ts` | 暴露 `health.getSnapshot`、`health.forceCheck`、`health.onChanged` |
| `hooks/use-health-polling.ts` | 改读主进程缓存，移除 Renderer 侧 interval |
| `packages/shared/src/health.ts` | 扩展 `HealthCheckResult` 字段 |

---

## 3. 探测层设计

### 3.1 `retryUntilPass`

```typescript
interface RetryOptions {
  attempts?: number;      // 默认 5
  intervalMs?: number;    // 默认 1000
  onAttempt?: (n: number) => void;
}

async function retryUntilPass(
  fn: () => Promise<boolean>,
  options?: RetryOptions,
): Promise<boolean>
```

- 最多 `attempts` 次调用 `fn()`，每次间隔 `intervalMs`。
- 任一次返回 `true` 即整体通过。
- 全部失败返回 `false`。

### 3.2 Forward / Mesh（`checkSessionHealth`）

| 检查项 | 重试 |
|--------|------|
| 进程存活 `ktctl.isProcessRunning` | 5×1s |
| 本地端口 `isLocalPortOpen` | 5×1s（仅当 `session.localPort` 存在） |

level 判定规则不变：

- **healthy**：进程 OK 且（端口 OK 或无端口）
- **degraded**：进程或端口其一 OK
- **unhealthy**：两者均失败

### 3.3 Connect（`checkConnectHealth`）

Connect 无本地端口；对以下可重试项应用 5×1s：

| 检查项 | 重试 |
|--------|------|
| `k8s.testConnection()` | 5×1s |
| connect PID（`readPidFromKtDir`） | 5×1s |
| DNS 解析（`probeClusterDns`） | 5×1s |

Helper 运行状态为即时进程检查，不重试。

### 3.4 不计入自动恢复的状态

以下 `level` **不递增** FailureTracker，**不触发**恢复：

- `unknown`（未运行、启动中、会话不存在）
- 轮询时 session 处于 `starting` / `pending` / 内部 `recovering`

---

## 4. 自动恢复层设计

### 4.1 FailureTracker

以 `connect`（固定 key）和各 `sessionId` 为 key，维护 `consecutiveFailures: number`。

```
每次轮询结束：
  if level === 'healthy':
    consecutiveFailures = 0
  else if level in ('degraded', 'unhealthy'):
    consecutiveFailures++
    if consecutiveFailures >= 2:
      await sessionRecovery.recover(key)
      consecutiveFailures = 0
```

### 4.2 恢复动作

| 类型 | 流程 | 参数来源 |
|------|------|----------|
| **connect** | `connect:stop` → 确保 Helper → `connect:start` | `RestartSpecRegistry.get('connect')` |
| **forward** | `ktctlService.stopSession(id)` → `startForward(params)` | `RestartSpecRegistry.get(sessionId)` |
| **mesh** | `ktctlService.stopSession(id)` → `startMesh(profile, port, userId)` | `RestartSpecRegistry.get(sessionId)` |

Connect 启动时写入 registry：

```typescript
{ type: 'connect', params: ConnectParams }
```

Forward 启动时：

```typescript
{ type: 'forward', params: ForwardParams }
```

Mesh 启动时：

```typescript
{ type: 'mesh', profile: MeshProfile, localPort: number, userId: string }
```

### 4.3 并发与状态

- 每个 key 同一时刻最多一个恢复流程（`recoveringKeys: Set<string>`）。
- 恢复开始：会话日志追加 `[auto-recovery] 健康检查连续 2 次异常，正在自动重启（第 N 次）…`
- 恢复期间跳过该 key 的健康轮询与计数。
- 用户手动 `sessions:stop` / `connect:stop`：清除 FailureTracker 条目与 RestartSpecRegistry 条目。
- **无冷却上限**：根因未消除时会持续重启，直至恢复或用户手动停止。

### 4.4 Mesh 重启参数

`MeshProfile` 字段较多（deploymentName、namespace、virtualEnv、env、appName、containerPort 等），Session 对象不足以重建命令。在 `KtctlService.startMesh` 时向 `RestartSpecRegistry` 写入完整参数；恢复时使用 registry 而非解析 `session.command`。

---

## 5. IPC 与 UI

### 5.1 新增 IPC

| 通道 | 方向 | 说明 |
|------|------|------|
| `health:getSnapshot` | Renderer → Main | 返回 `{ connect: HealthCheckResult \| null, sessions: Record<string, HealthCheckResult> }` |
| `health:forceCheck` | Renderer → Main | 立即触发一轮检测，返回 snapshot |
| `health:changed` | Main → Renderer | snapshot 变更时 push |

移除或保留但改为委托：`health:checkConnect`、`health:checkSession`、`health:checkSessionsByType` 可改为读缓存（兼容旧调用）或标记 deprecated 后统一走 snapshot。

### 5.2 `HealthCheckResult` 扩展

```typescript
export interface HealthCheckResult {
  level: HealthLevel;
  ok: boolean;
  message: string;
  details: string[];
  checkedAt: string;
  /** 主进程自动恢复进行中 */
  recovering?: boolean;
  /** 本会话累计自动恢复次数 */
  autoRecoveryCount?: number;
}
```

### 5.3 UI 变更

- `useHealthPolling` / `useSessionsHealthPolling`：挂载时 `getSnapshot` + 监听 `health:changed`；「检测」按钮调用 `forceCheck`。
- `HealthStatusPanel`：`recovering === true` 时 message 显示「自动恢复中…」；details 可展示 `[auto-recovery]` 相关行。
- 轮询间隔仍 10s（主进程控制），Renderer 不再独立 `setInterval`。

---

## 6. 错误处理

| 场景 | 行为 |
|------|------|
| 恢复过程中 stop 失败 | 记录日志，下轮继续累积失败 |
| 恢复过程中 start 失败 | session 变 `failed`，FailureTracker 重置；下轮若仍 running 再计 |
| Helper 未运行（Connect 恢复） | 先 `launchHelperElevated`，再 reconnect |
| 应用退出 | `HealthMonitor.stop()` 清定时器 |
| Registry 无重启参数 | 跳过恢复，日志警告，不崩溃 |

---

## 7. 测试策略

| 层级 | 内容 |
|------|------|
| 单元 | `retryUntilPass`：第 3 次成功、全失败、attempts/interval 配置 |
| 单元 | `FailureTracker`：healthy 重置、degraded 计数、2 次触发、unknown 不计 |
| 单元 | `SessionRecovery`：mock stop/start 调用顺序与参数 |
| 集成 | mock 端口始终失败 → 2 轮后触发 restart |
| 手动 | Kill 本地服务端口、断网 Connect、观察日志与 UI |

---

## 8. 非目标（YAGNI）

- 设置页开关（已确认不可关闭）
- 冷却上限与熔断
- Connect 额外本地端口探测（Connect 本身无 localPort）
- 通知中心 / 系统托盘告警

---

## 9. 文件变更清单

**Create**

- `apps/desktop/src/main/probe-retry.ts`
- `apps/desktop/src/main/probe-retry.test.ts`
- `apps/desktop/src/main/health-monitor.ts`
- `apps/desktop/src/main/health-monitor.test.ts`
- `apps/desktop/src/main/session-recovery.ts`
- `apps/desktop/src/main/session-recovery.test.ts`
- `apps/desktop/src/main/restart-spec-registry.ts`

**Modify**

- `packages/shared/src/health.ts`
- `apps/desktop/src/main/health-check.ts`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/ktctl-service.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/hooks/use-health-polling.ts`
- `apps/desktop/src/renderer/components/HealthStatusPanel.tsx`
- `apps/desktop/src/renderer/lib/ktve-api.ts`
