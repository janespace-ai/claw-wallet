## Why

当前 Relay Server 使用 Go 标准库 `net/http` + `gorilla/websocket` 构建，缺少中间件支持、路由分组、参数绑定等现代框架能力，随着功能增长维护成本上升。同时现有 Dockerfile 仅提供基础镜像构建，缺少生产级容器化编排（健康检查、优雅关闭、多服务编排）。切换到 CloudWeGo Hertz 高性能 HTTP 框架并完善容器化部署能力，可为后续功能迭代和生产部署打好基础。

## What Changes

- 将 HTTP/WebSocket 层从 `net/http` + `gorilla/websocket` 迁移到 Hertz 框架，利用其内置路由、中间件管道、参数绑定能力
- 使用 Hertz 的 `hws`（hertz-websocket）扩展替换 `gorilla/websocket`
- 引入 Hertz 中间件处理 CORS、Recovery、Access Log 等横切关注点
- 实现优雅关闭（Graceful Shutdown），替代当前的 `http.ListenAndServe` 硬停机
- 完善 Dockerfile 为生产级多阶段构建，添加非 root 用户运行
- 新增 `docker-compose.yml` 支持本地一键启动和多环境部署
- 新增 `.dockerignore` 优化构建上下文

## Capabilities

### New Capabilities
- `container-deployment`: 容器化部署能力，包括生产级 Dockerfile、docker-compose 编排、健康检查、环境变量配置

### Modified Capabilities
- `go-relay-server`: 框架从标准库迁移到 Hertz，所有现有 requirement 保持不变，实现层替换

## Impact

- **代码**: `server/` 目录下所有 Go 源文件需要重写 HTTP handler 签名和路由注册方式
- **依赖**: 移除 `gorilla/websocket`，新增 `github.com/cloudwego/hertz` 及其 WebSocket 扩展
- **API**: 所有 HTTP 端点路径和行为保持不变，对客户端无 **BREAKING** 变更
- **部署**: 新增 `docker-compose.yml`，`Dockerfile` 重写，部署流程变更
- **配置**: 引入结构化配置（端口、日志级别等），保持环境变量兼容
