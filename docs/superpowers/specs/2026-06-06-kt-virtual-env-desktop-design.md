# kt-virtual-env 桌面工具设计规格

> 日期：2026-06-06  
> 状态：待评审  
> 平台：macOS + Windows  
> 技术栈：Electron + 原生特权 Helper + 内嵌 ktctl/kubectl

## 1. 背景与目标

团队通过 Kubernetes + Istio 实现多套虚拟环境，开发者本地联调依赖 `ktctl` 命令行工具，存在以下痛点：

1. **安装繁琐**：ktctl、kubectl 需手动安装配置，Windows 体验差
2. **反复提权**：`connect` 等操作需要管理员权限，频繁输入密码
3. **参数复杂**：`mesh` 需手写 namespace、labels、`virtual-env`、selector 等
4. **会话难管**：多个 connect/forward/mesh 后台运行，缺乏统一视图

### 目标

开发跨平台桌面工具，提供与 ktctl 等价的三项核心能力：

| 能力 | 说明 |
|------|------|
| **Connect** | 打通本地与 K8s 容器网络，解析集群 Service DNS |
| **Forward** | 将集群某 Service 端口转发到本地 |
| **Mesh** | 将某虚拟环境流量导向本地服务进行调试 |

### 已确认决策

| 维度 | 决策 |
|------|------|
| ktctl 来源 | 官方 [kt-connect](https://github.com/alibaba/kt-connect) Release，版本锁定 `0.3.7` |
| kubectl | 与 ktctl 一并捆绑进安装包，绝对路径调用 |
| 提权方案 | 特权 Helper，启动/Connect 时授权一次，后续免输密码 |
| 技术栈 | Electron（主进程 + React 渲染进程） |
| Mesh 配置 | 全自动发现带 `virtual-env` 标签的工作负载 |
| MVP 范围 | Connect + Forward + Mesh 全包含，含会话管理、日志、recover/clean |

---

## 2. 整体架构

### 2.1 方案选型

采用 **Electron + 原生特权 Helper + 内嵌 CLI**（方案 1）：

- forward/mesh 由 Electron 主进程直接调用内嵌 ktctl（无需提权）
- connect 由特权 Helper 调用内嵌 ktctl（需改 hosts/路由）
- 保留官方 ktctl 行为，与现有命令行流程一致

不采用：每次 connect 临时提权（无法解决反复输密码）；v1 自研网络层（成本高、行为不一致）。

### 2.2 进程模型

```
┌─────────────────────────────────────────┐
│  Electron App (普通权限)                  │
│  ├─ Renderer: React UI                   │
│  ├─ Main: 进程编排 / IPC / 配置持久化      │
│  └─ 内嵌 kubectl（发现）+ ktctl（forward/mesh）│
│         │ connect 走 IPC ↓               │
└─────────┼───────────────────────────────┘
          ▼
┌─────────────────────────────────────────┐
│  Privileged Helper (Go 小二进制)          │
│  一次授权后常驻，执行 ktctl connect       │
└─────────────────────────────────────────┘
```

### 2.3 捆绑二进制

```
resources/bin/
  darwin-arm64/ktctl, kubectl
  darwin-x64/ktctl, kubectl
  win-x64/ktctl.exe, kubectl.exe
```

主进程按 `process.platform` + `process.arch` 解析绝对路径，不依赖系统 PATH。

### 2.4 能力执行策略

| 能力 | 执行方 | 是否提权 |
|------|--------|----------|
| Connect | Helper → `ktctl connect --dnsMode hosts:<ns>` | 是（一次） |
| Forward | Main → `ktctl forward <svc> <local:remote> -n <ns>` | 否（本地端口 >1024） |
| Mesh | Main → `ktctl mesh`，参数由自动发现生成 | 否 |

Connect 命名空间预设：扫描 `app-*` / `infr-*`（与现有 zt-ktctl 流程一致），UI 可勾选缩小范围。

---

## 3. UI 设计

### 3.1 布局

单窗口三栏：顶栏（context、Helper 状态）+ 左侧导航 + 主工作区 + 右侧会话/日志面板。

导航项：联调首页、网络连接、端口转发、流量 Mesh、会话管理、设置。

### 3.2 联调首页（默认落地页）

- 列表：`kubectl get deploy -A -l virtual-env`
- 展示：服务名、命名空间、virtual-env、env、容器端口、建议本地端口
- 操作：搜索过滤 → 点选 → 改本地端口 → 「开始 Mesh」
- 环境检查卡片：kubectl/集群/ktctl 状态、Helper 授权状态、Connect 状态

### 3.3 网络连接（Connect）

- 选择基准命名空间 + DNS 解析范围（勾选 app-/infr- 命名空间）
- 首次 Connect 三步向导：安装 Helper → 管理员授权 → 建立隧道
- 状态：未连接 / 已连接 + 运行时长

### 3.4 端口转发（Forward）

- 命名空间 + Service 下拉（`kubectl get svc`）
- 自动带出远端端口，用户填本地端口
- 支持多条 forward 并存；快捷「浏览器打开」「复制 URL」

### 3.5 流量 Mesh（高级表单）

与首页相同能力，暴露全部参数（selector、versionMark、expose 等），底部命令预览可复制。

### 3.6 会话管理

集中展示 connect/forward/mesh 会话；操作：停止选中、全部停止、recover、clean。危险操作二次确认。

### 3.7 设置

集群（kubeconfig、context）、二进制版本、Helper 管理、高级默认值、诊断日志导出。

### 3.8 典型用户路径

| 路径 | 步骤 | 是否需要 Connect/Helper |
|------|------|-------------------------|
| A 只调试本服务 | 首页选负载 → Mesh | 否 |
| B Mesh + 访问集群下游 | Connect → Mesh | 是 |
| C 只访问集群管理页 | Forward | 否 |

---

## 4. 数据流与 IPC

### 4.1 Helper IPC 协议

JSON Lines over Unix Socket（macOS）/ Named Pipe（Windows）。

| 消息 | 方向 | 说明 |
|------|------|------|
| `ping` | Main → Helper | 健康检查 |
| `connect` | Main → Helper | namespace、dnsMode、kubeconfig、context |
| `disconnect` | Main → Helper | 停止 connect |
| `shutdown` | Main → Helper | 应用退出 |
| `log` | Helper → Main | stdout/stderr 流 |
| `status` | Helper → Main | starting/running/failed/stopped |
| `error` | Helper → Main | 结构化错误 |

安全：仅 127.0.0.1；命令白名单；ktctl 路径写死，禁止任意 shell。

### 4.2 Mesh 自动发现

```
kubectl get deploy -A -l virtual-env -o json
  → 解析 labels: virtual-env, app.kubernetes.io/env, app.kubernetes.io/name
  → 关联 Service 端口
  → 生成 MeshProfile（缓存 TTL 30s）
  → 组装 mesh 命令:
      ktctl mesh <name>
        --namespace <ns>
        --versionMark "virtual-env:<virtual-env>"
        -l "app.kubernetes.io/env=<env>,app.kubernetes.io/name=<name>,virtual-env=<virtual-env>"
        --expose "<local>:<container>"
        --mode manual --useShadowDeployment
        --podCreationTimeout 120
```

### 4.3 Session 状态机

`pending → starting → running | failed → stopped`

Session 字段：id、type、target、namespace、ports、virtualEnv、pid、state、startedAt、logs（环形缓冲 2000 行）、command（脱敏展示）。

应用退出：若有 running 会话，弹窗选择「全部停止并 recover / 保持后台 / 取消」。

---

## 5. 错误处理

| 层级 | 检测时机 | 典型错误 | UI 处理 |
|------|----------|----------|---------|
| L0 环境 | 启动 | 二进制缺失、无 kubeconfig | 阻断页 |
| L1 集群 | 操作前 | context 不可达、RBAC 403 | Toast + 检查指引 |
| L2 参数 | 提交前 | 端口占用、Service 不存在 | 表单 inline |
| L3 运行时 | 子进程 | Shadow Pod 超时、镜像拉取失败 | 日志高亮 + 排查建议 |
| L4 Helper | IPC | 未授权、Helper 崩溃 | 顶栏红灯 + 重新授权 |

诊断日志：`~/.kt-virtual-env/logs/`；设置页支持导出诊断包（日志 + 脱敏配置）。

配置持久化：`~/.kt-virtual-env/config.json`（kubeconfig 路径、context、最近命名空间、Connect DNS 勾选记忆）。

---

## 6. 项目结构

```
kt-virtual-env/
├── apps/desktop/              # Electron 主应用
│   ├── src/main/              # 主进程
│   ├── src/preload/
│   └── src/renderer/          # React UI
├── packages/
│   ├── shared/                # 类型、错误码、Session 模型
│   └── k8s-discovery/         # MeshProfile 生成
├── native/privileged-helper/  # Go Helper
├── resources/bin/             # ktctl 0.3.7 + kubectl
├── scripts/fetch-binaries.sh
└── docs/superpowers/specs/
```

Renderer：React + TypeScript + Tailwind；Zustand 状态；contextBridge 类型安全 IPC。

---

## 7. 打包与发布

| 平台 | 产物 |
|------|------|
| macOS arm64/x64 | .dmg |
| Windows x64 | NSIS .exe |

electron-builder `extraResources` 打入平台二进制。体积预估约 190MB/平台。

CI 流程：fetch-binaries（SHA256 校验）→ build helper → build desktop → electron-builder →（可选）签名公证。

版本锁定：ktctl 0.3.7、kubectl 1.28.x（参数化）、Electron 固定版本。关于页展示全部组件版本。

---

## 8. 测试策略

| 类型 | 范围 |
|------|------|
| 单元 | MeshProfile 解析、命令组装、端口检测、错误码映射 |
| 集成 | mock kubectl/ktctl 输出，Main 进程编排 |
| E2E 手动 | 真实集群：Connect DNS、Forward 访问、Mesh 流量、recover/clean |
| 跨平台 | macOS arm64 + Windows x64 各一遍 |

---

## 9. 非功能需求

### 9.1 性能

- 工作负载列表刷新 < 5s（典型集群 200+ deploy）
- 日志 UI 渲染：2000 行环形缓冲，不卡顿
- Helper IPC 延迟 < 50ms（本地 socket）

### 9.2 安全

- 不存储集群凭证（读用户 kubeconfig，不落盘 token）
- 诊断导出脱敏：kubeconfig 仅保留 context 名，不导出证书/密钥
- Helper 最小权限：仅 connect 相关操作

### 9.3 可用性

- 首次使用：从安装到完成首次 Mesh < 5 分钟（集群就绪前提下）
- 所有长时间操作有进度/日志反馈，无静默等待
- 中文 UI（v1）

### 9.4 兼容性

- macOS 12+（Monterey 及以上），arm64 + x64
- Windows 10/11 x64
- 集群：Kubernetes 1.22+，现有 Istio 虚拟环境标签规范

---

## 10. v1 边界（明确不做）

| 不做 | 原因 | 后续版本 |
|------|------|----------|
| Linux 桌面支持 | 用户范围外 | v2 评估 |
| 自动更新（app + 二进制） | 需内网更新服务 | v1.1 |
| 多集群同时连接 | 复杂度高 | v1.1 |
| 替代 kubectl 的完整 K8s 管理 | 超出联调工具定位 | 不做 |
| 自研网络隧道 | v1 封装 ktctl | 长期评估 |
| ktctl exchange / preview | 非当前痛点 | 按需 |
| 团队定制 zt-ktctl 分支 | 已确认用官方 0.3.7 | 若官方不满足再评估 |
| 完全零管理员权限的 Connect | 系统限制，无法透明 DNS | 提供 mesh/forward 免提权路径 |
| 云同步配置 | 无需求 | 不做 |

---

## 11. 后续 Roadmap

| 版本 | 内容 |
|------|------|
| **v1.0** | Connect + Forward + Mesh + 会话管理 + Helper 提权 + 自动发现 |
| **v1.1** | 内网自动更新；多 forward 模板；最近联调历史 |
| **v1.2** | IDE 插件联动（如 VS Code 一键 Mesh）；托盘常驻 |
| **v2.0** | Linux 支持；多集群 profile 切换 |

---

## 12. 与现有 zt-ktctl Skill 的关系

现有 `zt-ktctl` Cursor Skill 面向 AI Agent 命令行编排，本桌面工具：

- **复用相同命令语义**（connect/forward/mesh 参数、标签规范、命名空间约定）
- **不替代 Skill**：Agent 场景仍可直接调 ktctl；桌面工具面向普通开发者自助操作
- Skill 参考文档（`references/connect.md` 等）作为命令组装的权威来源
- 桌面工具内置「命令预览」与 Skill 生成的命令应一致，便于对照排查

---

## 13. 风险与缓解

| 风险 | 缓解 |
|------|------|
| macOS Helper 签名/公证复杂 | v1 可先内部分发 unsigned；文档说明允许步骤 |
| kt-connect 项目停更（官方 0.3.7） | 版本锁定 + 行为集成测试；长期评估 fork |
| 集群 RBAC 不足 | 启动前 RBAC 预检，明确缺失权限列表 |
| Electron 包体大 | 接受 ~190MB；内网分发 |
| Shadow 镜像拉取失败 | 错误提示 + 集群侧检查指引 |

---

## 14. 验收标准（v1）

1. 安装后无需手动安装 ktctl/kubectl，应用内可完成全部操作
2. Connect 首次授权后，同日内重复 Connect 不再要求输入密码
3. 联调首页可列出带 `virtual-env` 的 Deployment，点选后一键 Mesh 成功
4. Forward 可将指定 Service 映射到本地并在浏览器访问
5. 会话面板可查看日志、停止会话、执行 recover/clean
6. macOS arm64 + Windows x64 各通过 E2E 手动清单
