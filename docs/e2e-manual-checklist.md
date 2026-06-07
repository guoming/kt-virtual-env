# E2E 手动测试清单

## 环境

- [ ] macOS arm64 安装包安装成功
- [ ] Windows x64 安装包安装成功
- [ ] 设置页显示 ktctl 0.3.7 + kubectl 1.28.15

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

## 健康检查与自动恢复

- [ ] Forward 本地端口不可达时，健康检查重试后仍失败，约 20s 后自动重启
- [ ] Mesh 停止本地 Java 进程后，连续 2 次 degraded 触发自动 mesh 重启
- [ ] Connect 断网后连续 2 次异常触发自动重连，会话日志含 [auto-recovery]
- [ ] 切换页面后自动恢复仍生效（主进程后台监控）

## 会话管理

- [ ] 停止单会话 / 全部停止
- [ ] recover 恢复流量
- [ ] clean 清理残留

## 退出

- [ ] 有活跃会话时弹窗三选项
