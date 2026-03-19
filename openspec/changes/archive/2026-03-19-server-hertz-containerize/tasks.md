## 1. 依赖与项目基础

- [x] 1.1 更新 `go.mod`：移除 `gorilla/websocket`，添加 `github.com/cloudwego/hertz` 和 `github.com/hertz-contrib/websocket`，运行 `go mod tidy`
- [x] 1.2 创建 `internal/middleware/` 包目录

## 2. 中间件实现

- [x] 2.1 在 `internal/middleware/` 中实现 CORS 中间件，允许跨域请求并正确处理 OPTIONS 预检
- [x] 2.2 在 `internal/middleware/` 中实现 Access Log 中间件，记录 method、path、status code、latency

## 3. Hub 模块迁移

- [x] 3.1 将 `internal/hub/hub.go` 中的 `gorilla/websocket` 替换为 `hertz-contrib/websocket`，适配 Upgrader 和连接 API
- [x] 3.2 将 `HandleWS` 方法签名从 `http.ResponseWriter, *http.Request` 迁移为 Hertz 的 `app.RequestContext` handler
- [x] 3.3 统一 `extractIP` 函数实现，支持 `X-Forwarded-For` 解析，供 hub 和 pairing 共用

## 4. Pairing 模块迁移

- [x] 4.1 将 `internal/pairing/pairing.go` 中的 `HandleCreate` 和 `HandleResolve` 从 `http.Handler` 迁移为 Hertz handler
- [x] 4.2 使用 Hertz 的路由参数绑定替代手动 URL path 解析（`/pair/:code`）
- [x] 4.3 更新 `internal/pairing/pairing_test.go` 测试用例，适配 Hertz 的测试工具

## 5. 入口与路由注册

- [x] 5.1 重写 `cmd/relay/main.go`：使用 `server.Default()` 创建 Hertz 引擎，注册全局中间件（Recovery、CORS、Access Log）
- [x] 5.2 注册路由：`GET /ws`、`POST /pair/create`、`GET /pair/:code`、`GET /health`
- [x] 5.3 配置优雅关闭：设置 `ExitWaitTime` 为 10 秒，日志打印关闭状态

## 6. 容器化部署

- [x] 6.1 重写 `server/Dockerfile`：多阶段构建、非 root 用户（UID 1001）、CA 证书、EXPOSE 8080
- [x] 6.2 创建 `server/.dockerignore` 排除 `.git`、`docs`、`openspec`、`node_modules` 等非必要文件
- [x] 6.3 创建 `server/docker-compose.yml`：relay 服务定义、端口映射、环境变量配置、健康检查（`/health` 端点，间隔 10s）

## 7. 验证

- [x] 7.1 运行 `go build ./...` 确认编译通过
- [x] 7.2 运行 `go test ./...` 确认现有 pairing 测试通过
- [x] 7.3 运行 `docker compose up` 确认容器启动正常，`/health` 返回 200
