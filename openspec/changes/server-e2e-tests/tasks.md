## 1. Hub WebSocket 测试

- [x] 1.1 创建 `internal/hub/hub_test.go`，实现 `httptest.NewServer` + `gorilla/websocket.Dialer` 的测试基础设施（helper 函数）
- [x] 1.2 测试 WebSocket 成功连接（带 pairId）
- [x] 1.3 测试缺少 pairId 时返回 400 拒绝升级
- [x] 1.4 测试两个客户端配对消息中继（Client A 发送，Client B 接收 envelope）
- [x] 1.5 测试消息不回传给发送方
- [x] 1.6 测试客户端断连后对端收到 `peer_disconnected` 通知
- [x] 1.7 测试 pair 容量限制：第三个客户端连接时第一个被驱逐
- [x] 1.8 测试消息速率限制（超过 100 msg/s 后消息被丢弃）

## 2. Middleware 测试

- [x] 2.1 创建 `internal/middleware/middleware_test.go`
- [x] 2.2 测试 CORS 中间件：OPTIONS 请求返回 204 + 正确 CORS 头
- [x] 2.3 测试 CORS 中间件：普通 GET 请求包含 `Access-Control-Allow-Origin: *`
- [x] 2.4 测试 Access Log 中间件：请求正确传递到下游 handler

## 3. IP 工具测试

- [x] 3.1 创建 `internal/iputil/iputil_test.go`
- [x] 3.2 测试 X-Forwarded-For 多 IP 提取第一个
- [x] 3.3 测试 X-Real-IP 回退
- [x] 3.4 测试 RemoteAddr 剥离端口
- [x] 3.5 测试 RemoteAddr 无端口情况

## 4. Pairing 补充测试

- [x] 4.1 在 `internal/pairing/pairing_test.go` 中补充过期码返回 404 的测试
- [x] 4.2 补充异常 JSON body 返回 400 的测试
- [x] 4.3 补充小写 code 解析成功的大小写无关性测试

## 5. 集成测试

- [x] 5.1 创建 `cmd/relay/main_test.go`，构建完整 Hertz Engine 并验证 `GET /health` 返回 200 + `{"status":"ok"}`

## 6. 验证

- [x] 6.1 运行 `go test ./...` 确认所有测试通过
