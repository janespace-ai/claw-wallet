## Context

Relay Server 刚完成从标准库到 Hertz 框架的迁移。当前仅 pairing 模块有 6 个测试用例，其余模块（hub、middleware、iputil、cmd/relay 集成）完全没有测试。需要建立全面的测试覆盖基线。

现有测试模式使用 Hertz `ut.PerformRequest` + 标准 `testing` 包，无第三方断言库。WebSocket 测试需要用 `net/http/httptest.NewServer()` + `gorilla/websocket.Dialer` 建立真实连接。

## Goals / Non-Goals

**Goals:**
- 为 hub 模块补充 WebSocket 端到端测试：连接、配对中继、断连通知、速率限制、pair 容量上限
- 为 middleware 模块补充行为测试：CORS 头设置、OPTIONS 预检、Access Log 通过性
- 为 iputil 模块补充多场景 IP 提取测试
- 补全 pairing 模块的缺失场景：过期码、异常 JSON、大小写无关
- 新增 cmd/relay 集成测试：验证路由注册完整性和 health 端点

**Non-Goals:**
- 不引入第三方测试框架（保持 `testing` + Hertz `ut` 风格）
- 不编写性能基准测试（benchmark）
- 不增加 mock 框架
- 不修改生产代码（除非测试需要暴露最小必要接口）

## Decisions

### Decision 1: Hub WebSocket 测试方法

**选择**: `net/http/httptest.NewServer()` + `gorilla/websocket.DefaultDialer`

**理由**:
- hub 的 `HandleWS` 保持 `http.Handler` 签名，可直接用标准库 httptest 启动真实 HTTP 服务
- `gorilla/websocket.Dialer` 提供完整的 WebSocket 客户端能力，支持 ping/pong、close handler
- 无需额外依赖，项目已有 `gorilla/websocket`

**替代方案**:
- Hertz `ut.PerformRequest` — 不支持 WebSocket upgrade，无法使用
- Mock WebSocket 连接 — 测试不够真实，无法验证完整握手和消息流

### Decision 2: Middleware 测试方法

**选择**: Hertz `ut.PerformRequest` + `route.Engine`

**理由**:
- 中间件是 Hertz `app.HandlerFunc`，最自然的测试方式是注册到 Engine 后用 `ut.PerformRequest` 发送请求
- 可以验证 response header、status code、中间件链的通过行为

### Decision 3: 测试文件组织

**选择**: 每个包内一个 `_test.go` 文件

**理由**:
- 遵循 Go 标准约定：`hub/hub_test.go`、`middleware/middleware_test.go`、`iputil/iputil_test.go`
- pairing 已有 `pairing_test.go`，在其中追加即可
- cmd/relay 新建 `main_test.go` 做集成测试

### Decision 4: 不引入 testify

**选择**: 继续使用标准 `testing` 包 + `t.Fatalf`/`t.Errorf`

**理由**:
- 与现有 pairing 测试风格一致
- 减少外部依赖
- Go 标准库足够覆盖所需断言场景

## Risks / Trade-offs

- **[Hub 测试的并发复杂性]** → WebSocket 端到端测试涉及 goroutine（readPump/writePump），需要合理的 sleep/channel 同步。缓解：使用短超时和 channel 等待替代固定 sleep。

- **[Access Log 测试的日志捕获]** → `log.Printf` 输出到 stderr，测试中难以精确断言。缓解：仅验证中间件的通过性（后续 handler 被调用），不断言日志内容。

- **[测试端口冲突]** → httptest.NewServer 使用随机端口，不存在冲突风险。
