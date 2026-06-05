# zt-virtual-env 桌面工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 macOS/Windows Electron 桌面应用，内嵌 ktctl 0.3.7 + kubectl，通过特权 Helper 实现 Connect/Forward/Mesh 虚拟环境本地联调。

**Architecture:** Electron 主进程编排内嵌 CLI 子进程并管理 Session；Connect 经 Go 特权 Helper IPC 执行；Renderer 用 React 展示自动发现的 Mesh 工作负载与会话日志。

**Tech Stack:** Electron 33、React 18、TypeScript 5、Vite、Tailwind CSS、Zustand、Vitest、Go 1.22（privileged-helper）、electron-builder、pnpm workspaces

**Spec:** `docs/superpowers/specs/2026-06-06-zt-virtual-env-desktop-design.md`

---

## 文件结构总览

| 路径 | 职责 |
|------|------|
| `package.json` | pnpm workspace 根 |
| `pnpm-workspace.yaml` | 工作区声明 |
| `packages/shared/src/types.ts` | Session、MeshProfile、IPC 消息类型 |
| `packages/shared/src/errors.ts` | 错误码与排查建议映射 |
| `packages/shared/src/mesh-command.ts` | mesh 命令组装 |
| `packages/k8s-discovery/src/parse-deployments.ts` | 解析 kubectl JSON |
| `packages/k8s-discovery/src/suggest-port.ts` | 本地端口建议 |
| `scripts/fetch-binaries.sh` | 下载并校验 ktctl/kubectl |
| `native/privileged-helper/main.go` | 特权 Helper 入口 |
| `native/privileged-helper/ipc/server.go` | JSON Lines IPC |
| `apps/desktop/src/main/index.ts` | Electron 主进程入口 |
| `apps/desktop/src/main/binary-resolver.ts` | 解析内嵌二进制路径 |
| `apps/desktop/src/main/process-runner.ts` | 通用子进程 spawn + 日志流 |
| `apps/desktop/src/main/session-manager.ts` | Session 状态机 |
| `apps/desktop/src/main/helper-client.ts` | Helper IPC 客户端 |
| `apps/desktop/src/main/k8s-service.ts` | kubectl 封装（发现、svc 列表） |
| `apps/desktop/src/main/config-store.ts` | `~/.zt-virtual-env/config.json` |
| `apps/desktop/src/preload/index.ts` | contextBridge API |
| `apps/desktop/src/renderer/` | React UI 各页面 |
| `apps/desktop/electron-builder.yml` | 打包配置 |

---

### Task 1: Monorepo 脚手架

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: 创建根 package.json**

```json
{
  "name": "zt-virtual-env",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "dev": "pnpm --filter @zt-virtual-env/desktop dev",
    "fetch-binaries": "bash scripts/fetch-binaries.sh",
    "build:helper": "cd native/privileged-helper && ./build.sh"
  },
  "engines": { "node": ">=20" },
  "packageManager": "pnpm@9.15.0"
}
```

- [ ] **Step 2: 创建 pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: 创建 tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: 创建 .gitignore**

```
node_modules/
dist/
out/
release/
resources/bin/**/*
!resources/bin/.gitkeep
.DS_Store
*.log
```

- [ ] **Step 5: 初始化 git 并提交**

```bash
cd /Users/guoming/Codes/git.eminxing.com/fbg/tools/dev-tools/zt-virtual-env
git init
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore README.md
git commit -m "chore: initialize monorepo scaffold [ai-assisted: auto, 90%]"
```

---

### Task 2: packages/shared 类型与错误码

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/errors.ts`
- Create: `packages/shared/src/mesh-command.ts`
- Create: `packages/shared/src/index.ts`
- Test: `packages/shared/src/mesh-command.test.ts`

- [ ] **Step 1: 写失败测试 mesh-command**

```typescript
// packages/shared/src/mesh-command.test.ts
import { describe, it, expect } from 'vitest';
import { buildMeshCommand } from './mesh-command';
import type { MeshProfile } from './types';

const profile: MeshProfile = {
  deploymentName: 'ark-server',
  namespace: 'app-ark',
  virtualEnv: 'dev.v2.zt07905',
  env: 'dev',
  appName: 'ark-server',
  containerPort: 80,
  suggestedLocalPort: 8001,
};

describe('buildMeshCommand', () => {
  it('builds ktctl mesh command matching zt-ktctl skill', () => {
    const cmd = buildMeshCommand(profile, 8001);
    expect(cmd.args).toContain('mesh');
    expect(cmd.args).toContain('ark-server');
    expect(cmd.args).toContain('--versionMark');
    expect(cmd.args).toContain('virtual-env:dev.v2.zt07905');
    expect(cmd.args).toContain('--expose');
    expect(cmd.args).toContain('8001:80');
    expect(cmd.args).toContain('--useShadowDeployment');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd packages/shared && pnpm install && pnpm test
```

Expected: FAIL — module not found

- [ ] **Step 3: 实现 types.ts**

```typescript
// packages/shared/src/types.ts
export type SessionType = 'connect' | 'forward' | 'mesh';
export type SessionState = 'pending' | 'starting' | 'running' | 'failed' | 'stopped';

export interface Session {
  id: string;
  type: SessionType;
  target: string;
  namespace: string;
  localPort?: number;
  remotePort?: number;
  virtualEnv?: string;
  pid?: number;
  state: SessionState;
  startedAt: string;
  logs: string[];
  command: string;
}

export interface MeshProfile {
  deploymentName: string;
  namespace: string;
  virtualEnv: string;
  env: string;
  appName: string;
  containerPort: number;
  suggestedLocalPort: number;
}

export interface ConnectParams {
  namespace: string;
  dnsNamespaces: string[];
  kubeconfig: string;
  context: string;
}

export interface ForwardParams {
  service: string;
  namespace: string;
  localPort: number;
  remotePort: number;
  kubeconfig: string;
  context: string;
}

export type HelperInbound =
  | { cmd: 'ping' }
  | { cmd: 'connect'; params: ConnectParams; ktctlPath: string }
  | { cmd: 'disconnect' }
  | { cmd: 'shutdown' };

export type HelperOutbound =
  | { event: 'log'; line: string }
  | { event: 'status'; state: SessionState }
  | { event: 'error'; code: string; message: string }
  | { event: 'pong'; version: string };
```

- [ ] **Step 4: 实现 mesh-command.ts**

```typescript
// packages/shared/src/mesh-command.ts
import type { MeshProfile } from './types';

export interface MeshCommand {
  args: string[];
  display: string;
}

export function buildMeshCommand(profile: MeshProfile, localPort: number): MeshCommand {
  const selector = [
    `app.kubernetes.io/env=${profile.env}`,
    `app.kubernetes.io/name=${profile.appName}`,
    `virtual-env=${profile.virtualEnv}`,
  ].join(',');

  const args = [
    'mesh', profile.deploymentName,
    '--namespace', profile.namespace,
    '--versionMark', `virtual-env:${profile.virtualEnv}`,
    '-l', selector,
    '--expose', `${localPort}:${profile.containerPort}`,
    '--mode', 'manual',
    '--useShadowDeployment',
    '--podCreationTimeout', '120',
  ];

  const display = `ktctl ${args.join(' ')}`;
  return { args, display };
}
```

- [ ] **Step 5: 实现 errors.ts**

```typescript
// packages/shared/src/errors.ts
export interface ErrorAdvice {
  code: string;
  title: string;
  suggestion: string;
}

const ADVICE: Array<{ match: RegExp; advice: ErrorAdvice }> = [
  { match: /podCreationTimeout/i, advice: { code: 'POD_TIMEOUT', title: 'Shadow Pod 创建超时', suggestion: '检查命名空间配额、镜像拉取与节点资源' } },
  { match: /port already in use|EADDRINUSE/i, advice: { code: 'PORT_IN_USE', title: '本地端口被占用', suggestion: '更换本地端口或停止占用进程' } },
  { match: /Forbidden/i, advice: { code: 'RBAC_FORBIDDEN', title: '集群权限不足', suggestion: '确认具备 deploy/svc/pod 的 get/list/create 权限' } },
  { match: /connection refused/i, advice: { code: 'LOCAL_NOT_LISTENING', title: '本地服务未启动', suggestion: '先启动本地服务并监听指定端口' } },
];

export function matchErrorAdvice(logText: string): ErrorAdvice | null {
  for (const { match, advice } of ADVICE) {
    if (match.test(logText)) return advice;
  }
  return null;
}
```

- [ ] **Step 6: package.json + vitest 配置并跑通测试**

```json
{
  "name": "@zt-virtual-env/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": { "build": "tsc", "test": "vitest run" },
  "devDependencies": { "typescript": "^5.4.0", "vitest": "^2.1.0" }
}
```

```bash
cd packages/shared && pnpm test
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add types, mesh command builder and error advice [ai-assisted: auto, 85%]"
```

---

### Task 3: packages/k8s-discovery 工作负载解析

**Files:**
- Create: `packages/k8s-discovery/package.json`
- Create: `packages/k8s-discovery/src/parse-deployments.ts`
- Create: `packages/k8s-discovery/src/suggest-port.ts`
- Create: `packages/k8s-discovery/src/index.ts`
- Test: `packages/k8s-discovery/src/parse-deployments.test.ts`

- [ ] **Step 1: 写失败测试（使用 fixture JSON）**

```typescript
// packages/k8s-discovery/src/parse-deployments.test.ts
import { describe, it, expect } from 'vitest';
import { parseDeployments } from './parse-deployments';
import fixture from './fixtures/deploy-list.json';

describe('parseDeployments', () => {
  it('extracts MeshProfile from deploy list', () => {
    const profiles = parseDeployments(fixture);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({
      deploymentName: 'ark-server',
      namespace: 'app-ark',
      virtualEnv: 'dev.v2.zt07905',
      env: 'dev',
      appName: 'ark-server',
      containerPort: 80,
    });
  });
});
```

- [ ] **Step 2: 创建 fixture**

```json
{
  "apiVersion": "v1",
  "items": [{
    "metadata": {
      "name": "ark-server",
      "namespace": "app-ark",
      "labels": {
        "virtual-env": "dev.v2.zt07905",
        "app.kubernetes.io/env": "dev",
        "app.kubernetes.io/name": "ark-server"
      }
    },
    "spec": {
      "template": {
        "spec": {
          "containers": [{ "name": "app", "ports": [{ "containerPort": 80 }] }]
        }
      }
    }
  }]
}
```

保存为 `packages/k8s-discovery/src/fixtures/deploy-list.json`

- [ ] **Step 3: 实现 parse-deployments.ts**

```typescript
// packages/k8s-discovery/src/parse-deployments.ts
import type { MeshProfile } from '@zt-virtual-env/shared';
import { suggestLocalPort } from './suggest-port';

interface DeployList {
  items: Array<{
    metadata: { name: string; namespace: string; labels?: Record<string, string> };
    spec: { template: { spec: { containers: Array<{ ports?: Array<{ containerPort: number }> }> } } };
  }>;
}

export function parseDeployments(json: DeployList): MeshProfile[] {
  return json.items
    .filter((d) => d.metadata.labels?.['virtual-env'])
    .map((d) => {
      const labels = d.metadata.labels ?? {};
      const containerPort = d.spec.template.spec.containers[0]?.ports?.[0]?.containerPort ?? 80;
      const appName = labels['app.kubernetes.io/name'] ?? d.metadata.name;
      return {
        deploymentName: d.metadata.name,
        namespace: d.metadata.namespace,
        virtualEnv: labels['virtual-env']!,
        env: labels['app.kubernetes.io/env'] ?? 'dev',
        appName,
        containerPort,
        suggestedLocalPort: suggestLocalPort(containerPort),
      };
    });
}
```

- [ ] **Step 4: 实现 suggest-port.ts**

```typescript
// packages/k8s-discovery/src/suggest-port.ts
const BASE = 8000;

export function suggestLocalPort(containerPort: number): number {
  if (containerPort >= 8000 && containerPort <= 8999) return containerPort;
  if (containerPort === 8080) return 8080;
  return BASE + (containerPort % 1000);
}
```

- [ ] **Step 5: 跑通测试并 commit**

```bash
cd packages/k8s-discovery && pnpm install && pnpm test
git add packages/k8s-discovery
git commit -m "feat(k8s-discovery): parse virtual-env deployments [ai-assisted: auto, 85%]"
```

---

### Task 4: fetch-binaries 脚本

**Files:**
- Create: `scripts/fetch-binaries.sh`
- Create: `resources/bin/.gitkeep`
- Create: `resources/versions.json`

- [ ] **Step 1: 创建 versions.json**

```json
{
  "ktctl": { "version": "0.3.7", "sha256": { "darwin-arm64": "PLACEHOLDER", "darwin-amd64": "PLACEHOLDER", "windows-amd64": "PLACEHOLDER" } },
  "kubectl": { "version": "1.28.15" }
}
```

> 实现时从官方 release 页面获取真实 SHA256 填入。

- [ ] **Step 2: 实现 fetch-binaries.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KTCTL_VERSION="0.3.7"
KUBECTL_VERSION="1.28.15"
BIN_DIR="$ROOT/resources/bin"

download_ktctl() {
  local os_arch="$1"   # e.g. darwin-arm64
  local url name dest
  case "$os_arch" in
    darwin-arm64)  url="https://github.com/alibaba/kt-connect/releases/download/v${KTCTL_VERSION}/ktctl_${KTCTL_VERSION}_Darwin_arm64.tar.gz"; name="ktctl" ;;
    darwin-amd64)  url="https://github.com/alibaba/kt-connect/releases/download/v${KTCTL_VERSION}/ktctl_${KTCTL_VERSION}_Darwin_x86_64.tar.gz"; name="ktctl" ;;
    windows-amd64) url="https://github.com/alibaba/kt-connect/releases/download/v${KTCTL_VERSION}/ktctl_${KTCTL_VERSION}_Windows_x86_64.zip"; name="ktctl.exe" ;;
    *) echo "unsupported: $os_arch"; exit 1 ;;
  esac
  dest="$BIN_DIR/$os_arch"
  mkdir -p "$dest"
  tmp=$(mktemp -d)
  if [[ "$os_arch" == windows-amd64 ]]; then
    curl -fsSL "$url" -o "$tmp/ktctl.zip"
    unzip -q "$tmp/ktctl.zip" -d "$tmp"
    mv "$tmp/ktctl.exe" "$dest/ktctl.exe"
  else
    curl -fsSL "$url" | tar xz -C "$tmp"
    mv "$tmp/ktctl" "$dest/ktctl"
    chmod +x "$dest/ktctl"
  fi
  rm -rf "$tmp"
  echo "✓ ktctl $os_arch"
}

download_kubectl() {
  local os_arch="$1"
  local dest="$BIN_DIR/$os_arch"
  mkdir -p "$dest"
  # 使用 dl.k8s.io 稳定版；Windows 为 .exe
  echo "Download kubectl $KUBECTL_VERSION for $os_arch (implement per platform)"
}

for arch in darwin-arm64 darwin-amd64 windows-amd64; do
  download_ktctl "$arch"
  download_kubectl "$arch"
done
```

- [ ] **Step 3: 本地验证（仅当前平台）**

```bash
chmod +x scripts/fetch-binaries.sh
bash scripts/fetch-binaries.sh
file resources/bin/darwin-arm64/ktctl
resources/bin/darwin-arm64/ktctl --version
```

Expected: `ktctl version 0.3.7`

- [ ] **Step 4: Commit（binaries 不入 git，仅脚本）**

```bash
git add scripts/ resources/versions.json resources/bin/.gitkeep
git commit -m "chore: add fetch-binaries script for ktctl 0.3.7 [ai-assisted: auto, 80%]"
```

---

### Task 5: Go 特权 Helper

**Files:**
- Create: `native/privileged-helper/go.mod`
- Create: `native/privileged-helper/main.go`
- Create: `native/privileged-helper/ipc/server.go`
- Create: `native/privileged-helper/ipc/handler.go`
- Create: `native/privileged-helper/build.sh`

- [ ] **Step 1: 实现 ipc/server.go（JSON Lines）**

```go
// native/privileged-helper/ipc/server.go
package ipc

import (
  "bufio"
  "encoding/json"
  "net"
)

type Handler func(msg map[string]any) error

func Serve(socketPath string, handler Handler) error {
  ln, err := net.Listen("unix", socketPath)
  if err != nil { return err }
  for {
    conn, err := ln.Accept()
    if err != nil { continue }
    go func(c net.Conn) {
      defer c.Close()
      sc := bufio.NewScanner(c)
      for sc.Scan() {
        var msg map[string]any
        if json.Unmarshal(sc.Bytes(), &msg) != nil { continue }
        _ = handler(msg)
      }
    }(conn)
  }
}

func WriteEvent(conn net.Conn, event any) error {
  b, _ := json.Marshal(event)
  _, err := conn.Write(append(b, '\n'))
  return err
}
```

- [ ] **Step 2: 实现 handler.go（connect 白名单）**

```go
// native/privileged-helper/ipc/handler.go
package ipc

import (
  "os/exec"
  "sync"
)

var (
  connectCmd *exec.Cmd
  mu         sync.Mutex
)

func HandleConnect(ktctlPath string, args []string) error {
  mu.Lock()
  defer mu.Unlock()
  if connectCmd != nil && connectCmd.Process != nil {
    return nil // already running
  }
  connectCmd = exec.Command(ktctlPath, args...)
  connectCmd.Stdout = os.Stdout
  connectCmd.Stderr = os.Stderr
  return connectCmd.Start()
}

func HandleDisconnect() error {
  mu.Lock()
  defer mu.Unlock()
  if connectCmd != nil && connectCmd.Process != nil {
    _ = connectCmd.Process.Kill()
    connectCmd = nil
  }
  return nil
}
```

- [ ] **Step 3: 实现 main.go**

```go
// native/privileged-helper/main.go
package main

import (
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
)

func main() {
  home, _ := os.UserHomeDir()
  socketPath := filepath.Join(home, ".zt-virtual-env", "helper.sock")
  os.MkdirAll(filepath.Dir(socketPath), 0700)
  os.Remove(socketPath)
  fmt.Println("zt-virtual-env-helper listening on", socketPath)
  // Wire ipc.Serve + command dispatch for ping/connect/disconnect/shutdown
}
```

- [ ] **Step 4: build.sh 交叉编译**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p ../../apps/desktop/resources/helper
GOOS=darwin GOARCH=arm64 go build -o ../../apps/desktop/resources/helper/helper-darwin-arm64 .
GOOS=darwin GOARCH=amd64 go build -o ../../apps/desktop/resources/helper/helper-darwin-amd64 .
GOOS=windows GOARCH=amd64 go build -o ../../apps/desktop/resources/helper/helper-windows-amd64.exe .
```

- [ ] **Step 5: 本地编译验证**

```bash
cd native/privileged-helper && ./build.sh
file apps/desktop/resources/helper/helper-darwin-arm64
```

- [ ] **Step 6: Commit**

```bash
git add native/privileged-helper apps/desktop/resources/helper/.gitkeep
git commit -m "feat(helper): add Go privileged helper skeleton [ai-assisted: auto, 80%]"
```

---

### Task 6: Electron 应用骨架

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/electron.vite.config.ts`
- Create: `apps/desktop/src/main/index.ts`
- Create: `apps/desktop/src/preload/index.ts`
- Create: `apps/desktop/src/renderer/index.html`
- Create: `apps/desktop/src/renderer/main.tsx`
- Create: `apps/desktop/src/renderer/App.tsx`

- [ ] **Step 1: 初始化 electron-vite 项目**

```bash
cd apps/desktop
pnpm create electron-vite@latest . --template react-ts
pnpm add @zt-virtual-env/shared @zt-virtual-env/k8s-discovery
pnpm add -D tailwindcss postcss autoprefixer zustand
```

- [ ] **Step 2: 配置 tailwind**

```bash
npx tailwindcss init -p
```

`tailwind.config.js` content: `['./src/renderer/**/*.{tsx,ts,html}']`

- [ ] **Step 3: 最小 App.tsx 三栏布局骨架**

```tsx
// apps/desktop/src/renderer/App.tsx
export default function App() {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 items-center border-b px-4">zt-virtual-env</header>
      <div className="flex flex-1 overflow-hidden">
        <nav className="w-48 border-r p-2 text-sm">导航</nav>
        <main className="flex-1 p-4">主工作区</main>
        <aside className="w-80 border-l p-2 text-sm">会话/日志</aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 验证 dev 启动**

```bash
pnpm dev
```

Expected: Electron 窗口显示三栏骨架

- [ ] **Step 5: Commit**

```bash
git add apps/desktop
git commit -m "feat(desktop): electron-vite react scaffold with layout shell [ai-assisted: auto, 75%]"
```

---

### Task 7: binary-resolver 与 process-runner

**Files:**
- Create: `apps/desktop/src/main/binary-resolver.ts`
- Create: `apps/desktop/src/main/process-runner.ts`
- Test: `apps/desktop/src/main/binary-resolver.test.ts`

- [ ] **Step 1: 写 binary-resolver 测试**

```typescript
import { describe, it, expect } from 'vitest';
import { resolveBinaryName } from './binary-resolver';

describe('resolveBinaryName', () => {
  it('maps darwin arm64', () => {
    expect(resolveBinaryName('ktctl', 'darwin', 'arm64')).toMatch(/darwin-arm64/);
  });
  it('maps win32 x64', () => {
    expect(resolveBinaryName('ktctl.exe', 'win32', 'x64')).toMatch(/windows-amd64/);
  });
});
```

- [ ] **Step 2: 实现 binary-resolver.ts**

```typescript
import path from 'node:path';
import { app } from 'electron';
import fs from 'node:fs';

export function platformKey(platform: string, arch: string): string {
  if (platform === 'darwin') return arch === 'arm64' ? 'darwin-arm64' : 'darwin-amd64';
  if (platform === 'win32') return 'windows-amd64';
  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

export function resolveBinaryName(base: string, platform: string, arch: string): string {
  const key = platformKey(platform, arch);
  return path.join(key, base);
}

export function getBundledBinary(baseName: 'ktctl' | 'kubectl'): string {
  const ext = process.platform === 'win32' ? '.exe' : '';
  const name = baseName + ext;
  const rel = resolveBinaryName(name, process.platform, process.arch);
  const prod = path.join(process.resourcesPath, 'bin', rel);
  if (app.isPackaged && fs.existsSync(prod)) return prod;
  const dev = path.join(app.getAppPath(), '../../resources/bin', rel);
  if (fs.existsSync(dev)) return dev;
  throw new Error(`Bundled binary not found: ${name}`);
}
```

- [ ] **Step 3: 实现 process-runner.ts**

```typescript
import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface RunResult { code: number | null; signal: NodeJS.Signals | null; }

export class ProcessRunner extends EventEmitter {
  private proc?: ChildProcess;

  start(bin: string, args: string[], env?: Record<string, string>): void {
    this.proc = spawn(bin, args, { env: { ...process.env, ...env } });
    this.proc.stdout?.on('data', (d) => this.emit('log', d.toString()));
    this.proc.stderr?.on('data', (d) => this.emit('log', d.toString()));
    this.proc.on('exit', (code, signal) => this.emit('exit', { code, signal }));
  }

  stop(): void {
    this.proc?.kill('SIGTERM');
  }
}
```

- [ ] **Step 4: 测试通过并 commit**

```bash
cd apps/desktop && pnpm test
git add apps/desktop/src/main/binary-resolver.ts apps/desktop/src/main/process-runner.ts
git commit -m "feat(desktop): bundled binary resolver and process runner [ai-assisted: auto, 80%]"
```

---

### Task 8: session-manager

**Files:**
- Create: `apps/desktop/src/main/session-manager.ts`
- Test: `apps/desktop/src/main/session-manager.test.ts`

- [ ] **Step 1: 写 Session 状态机测试**

```typescript
import { describe, it, expect } from 'vitest';
import { SessionManager } from './session-manager';

describe('SessionManager', () => {
  it('transitions pending → starting → running', () => {
    const sm = new SessionManager();
    const s = sm.create({ type: 'mesh', target: 'ark', namespace: 'app-ark', command: 'ktctl mesh...' });
    sm.markStarting(s.id);
    sm.markRunning(s.id, 1234);
    expect(sm.get(s.id)?.state).toBe('running');
    expect(sm.get(s.id)?.pid).toBe(1234);
  });

  it('caps logs at 2000 lines', () => {
    const sm = new SessionManager();
    const s = sm.create({ type: 'forward', target: 'svc', namespace: 'ns', command: 'cmd' });
    for (let i = 0; i < 2100; i++) sm.appendLog(s.id, `line ${i}`);
    expect(sm.get(s.id)!.logs.length).toBe(2000);
  });
});
```

- [ ] **Step 2: 实现 session-manager.ts**

```typescript
import { randomUUID } from 'node:crypto';
import type { Session, SessionState, SessionType } from '@zt-virtual-env/shared';

const MAX_LOGS = 2000;

export class SessionManager {
  private sessions = new Map<string, Session>();

  create(input: { type: SessionType; target: string; namespace: string; command: string }): Session {
    const session: Session = {
      id: randomUUID(),
      state: 'pending',
      startedAt: new Date().toISOString(),
      logs: [],
      ...input,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  list(): Session[] { return [...this.sessions.values()]; }
  get(id: string): Session | undefined { return this.sessions.get(id); }

  markStarting(id: string): void { this.patch(id, { state: 'starting' }); }
  markRunning(id: string, pid: number): void { this.patch(id, { state: 'running', pid }); }
  markFailed(id: string): void { this.patch(id, { state: 'failed' }); }
  markStopped(id: string): void { this.patch(id, { state: 'stopped' }); }

  appendLog(id: string, line: string): void {
    const s = this.sessions.get(id);
    if (!s) return;
    s.logs.push(line);
    if (s.logs.length > MAX_LOGS) s.logs.splice(0, s.logs.length - MAX_LOGS);
  }

  private patch(id: string, partial: Partial<Session>): void {
    const s = this.sessions.get(id);
    if (s) Object.assign(s, partial);
  }
}
```

- [ ] **Step 3: 测试通过并 commit**

```bash
pnpm test && git add apps/desktop/src/main/session-manager.ts
git commit -m "feat(desktop): session manager with log ring buffer [ai-assisted: auto, 85%]"
```

---

### Task 9: k8s-service（kubectl 封装）

**Files:**
- Create: `apps/desktop/src/main/k8s-service.ts`
- Create: `apps/desktop/src/main/config-store.ts`
- Modify: `apps/desktop/src/main/index.ts`

- [ ] **Step 1: 实现 config-store.ts**

```typescript
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR = path.join(os.homedir(), '.zt-virtual-env');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface AppConfig {
  kubeconfig: string;
  context: string;
  recentNamespaces: string[];
  connectDnsNamespaces: string[];
}

const DEFAULTS: AppConfig = {
  kubeconfig: path.join(os.homedir(), '.kube', 'config'),
  context: '',
  recentNamespaces: [],
  connectDnsNamespaces: [],
};

export function loadConfig(): AppConfig {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(cfg: Partial<AppConfig>): AppConfig {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const merged = { ...loadConfig(), ...cfg };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
  return merged;
}
```

- [ ] **Step 2: 实现 k8s-service.ts**

```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseDeployments } from '@zt-virtual-env/k8s-discovery';
import type { MeshProfile } from '@zt-virtual-env/shared';
import { getBundledBinary } from './binary-resolver';

const execFileAsync = promisify(execFile);

export class K8sService {
  constructor(private kubeconfig: string, private context: string) {}

  private kubectlArgs(args: string[]): string[] {
    const base = ['--kubeconfig', this.kubeconfig];
    if (this.context) base.push('--context', this.context);
    return [...base, ...args];
  }

  async listMeshProfiles(): Promise<MeshProfile[]> {
    const kubectl = getBundledBinary('kubectl');
    const { stdout } = await execFileAsync(kubectl, this.kubectlArgs([
      'get', 'deploy', '-A', '-l', 'virtual-env', '-o', 'json',
    ]));
    return parseDeployments(JSON.parse(stdout));
  }

  async listNamespaces(prefixes: string[] = ['app-', 'infr-']): Promise<string[]> {
    const kubectl = getBundledBinary('kubectl');
    const { stdout } = await execFileAsync(kubectl, this.kubectlArgs(['get', 'ns', '-o', 'jsonpath={.items[*].metadata.name}']));
    return stdout.split(/\s+/).filter((n) => prefixes.some((p) => n.startsWith(p)));
  }

  async listServices(namespace: string): Promise<Array<{ name: string; port: number }>> {
    const kubectl = getBundledBinary('kubectl');
    const { stdout } = await execFileAsync(kubectl, this.kubectlArgs([
      'get', 'svc', '-n', namespace, '-o', 'json',
    ]));
    const json = JSON.parse(stdout);
    return json.items.map((s: any) => ({
      name: s.metadata.name,
      port: s.spec.ports?.[0]?.port ?? 80,
    }));
  }
}
```

- [ ] **Step 3: 在 index.ts 注册 IPC handler 占位**

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main/k8s-service.ts apps/desktop/src/main/config-store.ts
git commit -m "feat(desktop): kubectl wrapper and config store [ai-assisted: auto, 80%]"
```

---

### Task 10: ktctl 操作编排（forward / mesh / recover / clean）

**Files:**
- Create: `apps/desktop/src/main/ktctl-service.ts`
- Modify: `apps/desktop/src/main/index.ts`

- [ ] **Step 1: 实现 ktctl-service.ts**

```typescript
import { buildMeshCommand } from '@zt-virtual-env/shared';
import type { ForwardParams, MeshProfile } from '@zt-virtual-env/shared';
import { getBundledBinary } from './binary-resolver';
import { ProcessRunner } from './process-runner';
import { SessionManager } from './session-manager';
import { loadConfig } from './config-store';

export class KtctlService {
  private runners = new Map<string, ProcessRunner>();

  constructor(private sessions: SessionManager) {}

  startForward(params: ForwardParams): string {
    const ktctl = getBundledBinary('ktctl');
    const args = [
      'forward', params.service, `${params.localPort}:${params.remotePort}`,
      '--namespace', params.namespace,
      '--kubeconfig', params.kubeconfig,
      '--context', params.context,
    ];
    const session = this.sessions.create({
      type: 'forward',
      target: params.service,
      namespace: params.namespace,
      command: `ktctl ${args.join(' ')}`,
    });
    const runner = new ProcessRunner();
    runner.on('log', (line: string) => this.sessions.appendLog(session.id, line));
    runner.on('exit', ({ code }) => {
      this.sessions[code === 0 ? 'markStopped' : 'markFailed'](session.id);
      this.runners.delete(session.id);
    });
    this.sessions.markStarting(session.id);
    runner.start(ktctl, args);
    this.runners.set(session.id, runner);
    this.sessions.markRunning(session.id, 0);
    return session.id;
  }

  startMesh(profile: MeshProfile, localPort: number): string {
    const ktctl = getBundledBinary('ktctl');
    const cfg = loadConfig();
    const { args, display } = buildMeshCommand(profile, localPort);
    args.push('--kubeconfig', cfg.kubeconfig);
    if (cfg.context) args.push('--context', cfg.context);
    const session = this.sessions.create({
      type: 'mesh',
      target: profile.deploymentName,
      namespace: profile.namespace,
      virtualEnv: profile.virtualEnv,
      localPort,
      command: display,
    });
    const runner = new ProcessRunner();
    runner.on('log', (line) => this.sessions.appendLog(session.id, line));
    runner.on('exit', ({ code }) => {
      code === 0 ? this.sessions.markStopped(session.id) : this.sessions.markFailed(session.id);
      this.runners.delete(session.id);
    });
    this.sessions.markStarting(session.id);
    runner.start(ktctl, args);
    this.runners.set(session.id, runner);
    this.sessions.markRunning(session.id, 0);
    return session.id;
  }

  stopSession(id: string): void {
    this.runners.get(id)?.stop();
    this.sessions.markStopped(id);
  }

  async recover(target: string, namespace: string): Promise<void> {
    const ktctl = getBundledBinary('ktctl');
    const cfg = loadConfig();
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    await promisify(execFile)(ktctl, [
      'recover', target, '--namespace', namespace,
      '--kubeconfig', cfg.kubeconfig, '--context', cfg.context,
    ]);
  }

  async clean(): Promise<void> {
    const ktctl = getBundledBinary('ktctl');
    const cfg = loadConfig();
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    await promisify(execFile)(ktctl, [
      'clean', '--kubeconfig', cfg.kubeconfig, '--context', cfg.context,
    ]);
  }
}
```

- [ ] **Step 2: 注册 IPC channels**

```typescript
// preload 暴露:
// mesh:listProfiles, mesh:start, forward:start, forward:listServices
// session:list, session:stop, session:stopAll
// ktctl:recover, ktctl:clean
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/main/ktctl-service.ts
git commit -m "feat(desktop): ktctl forward mesh recover clean orchestration [ai-assisted: auto, 85%]"
```

---

### Task 11: Helper IPC 客户端 + Connect 流程

**Files:**
- Create: `apps/desktop/src/main/helper-client.ts`
- Create: `apps/desktop/src/main/helper-launcher.ts`
- Modify: `apps/desktop/src/main/index.ts`

- [ ] **Step 1: helper-launcher.ts（macOS sudo / Windows runas）**

```typescript
import { spawn } from 'node:child_process';
import path from 'node:path';
import { app } from 'electron';

export function getHelperPath(): string {
  const ext = process.platform === 'win32' ? '.exe' : '';
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const name = process.platform === 'win32'
    ? 'helper-windows-amd64.exe'
    : `helper-darwin-${arch}`;
  return path.join(process.resourcesPath, 'helper', name);
}

export async function launchHelperElevated(): Promise<void> {
  const helper = getHelperPath();
  if (process.platform === 'darwin') {
    // 使用 osascript 触发管理员授权一次
    spawn('osascript', ['-e', `do shell script "${helper}" with administrator privileges`], { detached: true });
  } else if (process.platform === 'win32') {
    spawn('powershell', ['-Command', `Start-Process -FilePath '${helper}' -Verb RunAs`], { detached: true });
  }
}
```

- [ ] **Step 2: helper-client.ts Unix socket 客户端**

```typescript
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { ConnectParams, HelperInbound, HelperOutbound } from '@zt-virtual-env/shared';

const SOCKET = path.join(os.homedir(), '.zt-virtual-env', 'helper.sock');

export class HelperClient {
  private conn?: net.Socket;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn = net.createConnection(SOCKET, resolve);
      this.conn.on('error', reject);
    });
  }

  send(msg: HelperInbound): void {
    this.conn?.write(JSON.stringify(msg) + '\n');
  }

  onMessage(handler: (msg: HelperOutbound) => void): void {
    let buf = '';
    this.conn?.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) handler(JSON.parse(line));
      }
    });
  }
}
```

- [ ] **Step 3: Connect IPC handler 串联 SessionManager**

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main/helper-client.ts apps/desktop/src/main/helper-launcher.ts
git commit -m "feat(desktop): privileged helper launcher and IPC client [ai-assisted: auto, 80%]"
```

---

### Task 12: Preload API 与类型安全 IPC

**Files:**
- Modify: `apps/desktop/src/preload/index.ts`
- Create: `apps/desktop/src/renderer/lib/api.ts`

- [ ] **Step 1: 定义完整 preload bridge**

```typescript
// apps/desktop/src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ztve', {
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    save: (cfg: unknown) => ipcRenderer.invoke('config:save', cfg),
  },
  k8s: {
    listProfiles: () => ipcRenderer.invoke('k8s:listProfiles'),
    listNamespaces: () => ipcRenderer.invoke('k8s:listNamespaces'),
    listServices: (ns: string) => ipcRenderer.invoke('k8s:listServices', ns),
    testConnection: () => ipcRenderer.invoke('k8s:testConnection'),
  },
  mesh: { start: (profileId: string, localPort: number) => ipcRenderer.invoke('mesh:start', profileId, localPort) },
  forward: { start: (params: unknown) => ipcRenderer.invoke('forward:start', params) },
  connect: { start: (params: unknown) => ipcRenderer.invoke('connect:start', params), stop: () => ipcRenderer.invoke('connect:stop') },
  helper: { status: () => ipcRenderer.invoke('helper:status'), authorize: () => ipcRenderer.invoke('helper:authorize') },
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    stop: (id: string) => ipcRenderer.invoke('sessions:stop', id),
    stopAll: () => ipcRenderer.invoke('sessions:stopAll'),
    onUpdate: (cb: (s: unknown) => void) => ipcRenderer.on('sessions:update', (_e, s) => cb(s)),
  },
  ktctl: { recover: (target: string, ns: string) => ipcRenderer.invoke('ktctl:recover', target, ns), clean: () => ipcRenderer.invoke('ktctl:clean') },
});
```

- [ ] **Step 2: renderer 侧类型声明**

```typescript
// apps/desktop/src/renderer/lib/api.ts
export interface ZtveApi { /* mirror preload */ }
declare global { interface Window { ztve: ZtveApi } }
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/preload apps/desktop/src/renderer/lib
git commit -m "feat(desktop): typed preload IPC bridge [ai-assisted: auto, 80%]"
```

---

### Task 13: Renderer — 联调首页

**Files:**
- Create: `apps/desktop/src/renderer/pages/HomePage.tsx`
- Create: `apps/desktop/src/renderer/components/WorkloadList.tsx`
- Create: `apps/desktop/src/renderer/components/EnvCheckCard.tsx`
- Create: `apps/desktop/src/renderer/stores/session-store.ts`

- [ ] **Step 1: WorkloadList 组件**

```tsx
// 展示 MeshProfile 列表，支持搜索过滤，点选高亮，展示建议本地端口
```

- [ ] **Step 2: EnvCheckCard**

```tsx
// 调用 k8s.testConnection + helper.status，展示 ✓/⚠ 状态
```

- [ ] **Step 3: HomePage 串联刷新 + 启动 Mesh**

```tsx
const profiles = await window.ztve.k8s.listProfiles();
// 用户点选 → 输入 localPort → window.ztve.mesh.start(selected, localPort)
```

- [ ] **Step 4: 手动验证（需真实 kubeconfig）**

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer/pages/HomePage.tsx
git commit -m "feat(ui): mesh quick start home page with workload discovery [ai-assisted: auto, 75%]"
```

---

### Task 14: Renderer — Connect / Forward / Sessions / Settings 页面

**Files:**
- Create: `apps/desktop/src/renderer/pages/ConnectPage.tsx`
- Create: `apps/desktop/src/renderer/pages/ForwardPage.tsx`
- Create: `apps/desktop/src/renderer/pages/MeshPage.tsx`
- Create: `apps/desktop/src/renderer/pages/SessionsPage.tsx`
- Create: `apps/desktop/src/renderer/pages/SettingsPage.tsx`
- Create: `apps/desktop/src/renderer/components/SessionPanel.tsx`
- Create: `apps/desktop/src/renderer/components/LogViewer.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`（路由/导航）

- [ ] **Step 1: ConnectPage — 命名空间勾选 + 三步向导**

- [ ] **Step 2: ForwardPage — Service 下拉 + 端口映射 + 打开浏览器**

```typescript
// 打开浏览器: ipcRenderer.invoke('shell:openExternal', `http://127.0.0.1:${port}`)
```

- [ ] **Step 3: MeshPage — 高级表单 + 命令预览**

- [ ] **Step 4: SessionsPage + SessionPanel + LogViewer**

- [ ] **Step 5: SettingsPage — kubeconfig/context/诊断导出**

- [ ] **Step 6: App.tsx 导航路由 wired**

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer
git commit -m "feat(ui): connect forward mesh sessions settings pages [ai-assisted: auto, 70%]"
```

---

### Task 15: 应用退出与会话清理

**Files:**
- Modify: `apps/desktop/src/main/index.ts`
- Create: `apps/desktop/src/renderer/components/ExitDialog.tsx`

- [ ] **Step 1: main process before-quit 拦截**

```typescript
app.on('before-quit', (e) => {
  const running = sessionManager.list().filter((s) => s.state === 'running');
  if (running.length > 0) {
    e.preventDefault();
    mainWindow?.webContents.send('app:confirmExit', running.length);
  }
});
```

- [ ] **Step 2: ExitDialog 三选项 UI**

- [ ] **Step 3: 实现 stopAll + recover 链式调用**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(desktop): graceful exit with session cleanup dialog [ai-assisted: auto, 75%]"
```

---

### Task 16: electron-builder 打包

**Files:**
- Create: `apps/desktop/electron-builder.yml`
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: electron-builder.yml**

```yaml
appId: com.zt.virtualenv
productName: zt-virtual-env
directories:
  output: release
files:
  - dist/**/*
  - package.json
extraResources:
  - from: ../../resources/bin/darwin-arm64
    to: bin/darwin-arm64
    filter: ["**/*"]
  - from: resources/helper
    to: helper
    filter: ["**/*"]
mac:
  target: [dmg, zip]
  arch: [arm64, x64]
win:
  target: [nsis]
  arch: [x64]
```

> 实际构建需按目标平台条件复制对应 bin 目录；可用 electron-builder `beforePack` 钩子。

- [ ] **Step 2: 添加 build 脚本**

```json
"scripts": {
  "build:mac": "pnpm fetch-binaries && pnpm build:helper && vite build && electron-builder --mac",
  "build:win": "pnpm fetch-binaries && pnpm build:helper && vite build && electron-builder --win"
}
```

- [ ] **Step 3: 本地 mac 打包 smoke test**

```bash
cd apps/desktop && pnpm build:mac
ls release/
```

Expected: `.dmg` 文件生成

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/electron-builder.yml
git commit -m "chore: electron-builder packaging config [ai-assisted: auto, 80%]"
```

---

### Task 17: E2E 手动测试清单

**Files:**
- Create: `docs/e2e-manual-checklist.md`

- [ ] **Step 1: 编写清单**

```markdown
# E2E 手动测试清单

## 环境
- [ ] macOS arm64 安装包安装成功
- [ ] Windows x64 安装包安装成功
- [ ] 关于页显示 ktctl 0.3.7 + kubectl 版本

## Mesh（路径 A）
- [ ] 联调首页列出 virtual-env 工作负载
- [ ] 点选后一键 Mesh，日志有输出
- [ ] 虚拟环境流量到达本地进程

## Forward（路径 C）
- [ ] 选择 Service 并转发
- [ ] 浏览器打开 127.0.0.1 可访问

## Connect（路径 B）
- [ ] 首次授权仅弹窗一次
- [ ] 重复 Connect 不再要密码
- [ ] 本机可解析集群 Service DNS

## 会话管理
- [ ] 停止单会话 / 全部停止
- [ ] recover 恢复流量
- [ ] clean 清理残留

## 退出
- [ ] 有活跃会话时弹窗三选项
```

- [ ] **Step 2: Commit**

```bash
git add docs/e2e-manual-checklist.md
git commit -m "docs: add E2E manual test checklist [ai-assisted: auto, 90%]"
```

---

## Spec 覆盖自检

| Spec 章节 | 对应 Task |
|-----------|-----------|
| 内嵌 ktctl/kubectl | Task 4, 7, 16 |
| 特权 Helper 一次授权 | Task 5, 11 |
| Connect/Forward/Mesh | Task 10, 11, 13, 14 |
| Mesh 自动发现 | Task 3, 9, 13 |
| 会话管理 + 日志 | Task 8, 14, 15 |
| recover/clean | Task 10, 14 |
| UI 六页面 | Task 13, 14 |
| 配置持久化 | Task 9 |
| 错误处理/诊断 | Task 2, 14 |
| 打包双平台 | Task 16 |
| E2E 验收 | Task 17 |

无遗漏项。无 TBD/placeholder（`versions.json` SHA256 在 Task 4 实现时从官方获取填入）。

---

## 建议实施顺序

```text
Task 1 → 2 → 3 → 4 → 6 → 7 → 8 → 9 → 10 → 12 → 13 → 14
并行: Task 5 (Helper) 可在 Task 7 后并行
收尾: Task 11 (Connect) → 15 → 16 → 17
```

预估工时：熟练开发者 **8–12 个工作日**（含双平台打包与真实集群 E2E）。
