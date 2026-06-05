# zt-virtual-env

跨平台桌面工具（macOS / Windows），用于 Kubernetes + Istio 虚拟环境本地联调。

## 能力

- **Connect**：打通本地与集群网络，解析 Service DNS
- **Forward**：将集群 Service 端口转发到本机
- **Mesh**：将指定虚拟环境流量导向本地服务

## 技术栈

- Electron + React + TypeScript
- 内嵌官方 ktctl 0.3.7 与 kubectl
- Go 特权 Helper（Connect 一次授权）

## 开发

```bash
pnpm install
pnpm dev
```

## 文档

- 设计规格：`docs/superpowers/specs/2026-06-06-zt-virtual-env-desktop-design.md`
- 实现计划：`docs/superpowers/plans/2026-06-06-zt-virtual-env-desktop.md`
