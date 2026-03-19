## Context

Claw Wallet Relay Server 是一个轻量级 WebSocket 中继服务，负责在 Electron 钱包应用和 Agent Signer 之间转发端到端加密消息，并提供短码配对功能。

当前实现基于 Go 标准库 `net/http` + `gorilla/websocket`，手动实现了速率限制、IP 提取等功能，没有中间件管道、结构化路由或优雅关闭。`Dockerfile` 存在但缺少非 root 运行等生产实践，无 `docker-compose.yml` 编排。

本次变更将框架切换到 CloudWeGo Hertz 并完善容器化部署能力。

## Goals / Non-Goals

**Goals:**
- 将 HTTP/WebSocket 层迁移到 Hertz 框架，获得中间件管道、路由分组、参数绑定、优雅关闭等能力
- 保持所有现有 API 端点路径和行为不变（对客户端零破坏）
- 完善容器化部署：生产级 Dockerfile + docker-compose 编排
- 统一 CORS、Recovery、日志等横切关注点为 Hertz 中间件

**Non-Goals:**
- 不引入持久化存储（保持 zero-persistence 设计）
- 不改变业务逻辑（配对、中继、速率限制的规则和阈值不变）
- 不引入 Kubernetes 编排（仅 docker-compose 级别）
- 不引入配置中心或外部服务发现

## Decisions

### Decision 1: Hertz 作为 HTTP 框架

**选择**: CloudWeGo Hertz

**理由**:
- 字节跳动开源的高性能 HTTP 框架，基于 Netpoll 网络库，吞吐量优于 Gin/Echo
- 内置中间件管道、路由分组、参数绑定、优雅关闭
- 原生支持 WebSocket 扩展 (`hertz-contrib/websocket`)，API 与 `gorilla/websocket` 高度兼容，迁移成本低
- 活跃的社区和文档支持

**替代方案**:
- **Gin**: 生态成熟但性能不如 Hertz，WebSocket 需自行集成
- **继续使用标准库**: 无中间件管道，手动管理横切关注点成本高
- **Fiber**: 基于 fasthttp，与 `net/http` 不兼容，生态相对较小

### Decision 2: WebSocket 扩展选择

**选择**: `github.com/hertz-contrib/websocket`

**理由**:
- 官方 Hertz WebSocket 扩展，API 与 `gorilla/websocket` 几乎一致
- 底层使用 `gorilla/websocket` 同源代码适配 Hertz，迁移时 hub 核心逻辑改动最小
- 与 Hertz 中间件管道无缝集成

### Decision 3: 项目结构保持不变

**选择**: 保持 `cmd/relay/`、`internal/hub/`、`internal/pairing/` 结构

**理由**:
- 现有结构符合 Go 标准项目布局，清晰合理
- 框架替换主要影响 handler 签名和路由注册，不需要重构目录
- 新增 `internal/middleware/` 包存放自定义中间件

### Decision 4: 容器化方案

**选择**: 多阶段 Dockerfile + docker-compose.yml

**理由**:
- 多阶段构建保持镜像最小化（基于 `alpine`）
- 增加非 root 用户运行（`appuser`）提升安全性
- docker-compose 提供本地开发和生产部署的统一编排
- 健康检查通过现有 `/health` 端点实现

### Decision 5: 优雅关闭

**选择**: 利用 Hertz 内置的优雅关闭机制

**理由**:
- Hertz `server.Default()` 自带 `SIGINT`/`SIGTERM` 信号监听和优雅关闭
- 配合 `ExitWaitTime` 参数控制关闭超时
- 关闭时先停止接受新连接，等待现有 WebSocket 连接和请求完成

## Risks / Trade-offs

- **[Hertz WebSocket 兼容性]** → hub 核心的 `ReadMessage`/`WriteMessage` 调用需要适配 Hertz WebSocket API。缓解：`hertz-contrib/websocket` 与 `gorilla/websocket` API 高度兼容，重点验证 ping/pong 和 close handler 行为。

- **[依赖体积增加]** → Hertz 及其 Netpoll 依赖会增加二进制大小和 go.sum 复杂度。缓解：生产镜像仍使用多阶段构建，最终镜像体积影响可控。

- **[迁移期间的测试覆盖]** → 现有测试仅覆盖 pairing 模块，hub 模块无测试。缓解：迁移时确保 pairing 测试继续通过，hub 的行为通过手动和 docker-compose 端到端验证。

- **[零停机部署]** → docker-compose 不提供原生滚动更新。缓解：当前为无状态服务，重启即可恢复，不在本次范围引入 K8s。
