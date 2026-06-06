# README 截图素材

将配图放入本目录，`README.md` 通过相对路径引用。

**数据说明：** 截图使用模拟数据生成（个人标识 `developer`、集群 `demo-cluster@admin`、示例服务名等），不含真实内部环境信息。重新生成：

```bash
pnpm add -D playwright -w
pnpm exec playwright install chromium
pnpm docs:screenshots
```

| 文件名 | 内容 |
|--------|------|
| `overview.png` | 应用主界面（配置页） |
| `settings.png` | 配置与环境检测 |
| `connect.png` | 网络连接 |
| `forward.png` | 端口转发 |
| `stain.png` | 流量染色 |
| `session-panel.png` | 右侧会话与日志面板 |
| `mesh.png` | 流量转发 |
