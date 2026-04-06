# Relay Server 配置说明

在运行目录或 `server/` 下放置 `config.json`。加载顺序见 `internal/config/config.go`：`config.json`，否则 `server/config.json`；缺失字段使用代码默认值。

可复制 `config.example.json` 后按需修改。

## 环境变量

| 变量 | 作用 |
|------|------|
| `CLAW_SERVER_PORT` 或 `PORT` | 监听端口（字符串，如 `"8080"`）。 |
| `CLAW_SERVER_CORS_ORIGINS` | 允许的 CORS 来源，逗号分隔；覆盖 `corsAllowedOrigins`。 |

## 顶层字段

| 路径 | 说明 |
|------|------|
| `port` | 服务监听端口。 |
| `corsAllowedOrigins` | CORS 白名单；开发可用 `["*"]`，生产应收紧。 |
| `gracefulShutdown` | 优雅退出等待时间，Go duration 字符串（如 `"10s"`）。 |
| `ws.readLimitBytes` | 单条入站 WebSocket 消息最大字节数（默认 65536）。 |
| `ws.readTimeout` | 读超时 / pong 等待，如 `"60s"`。 |
| `ws.writeTimeout` | 写超时，如 `"10s"`。 |
| `ws.pingInterval` | 心跳 ping 间隔，如 `"30s"`。 |
| `ws.sendBufferSize` | 每连接出站缓冲条数。 |
| `rateLimit.messageRate` | 每客户端每秒最大消息数。 |
| `rateLimit.connectionRate` | 每个 pair ID 每分钟最大新连接数。 |
| `rateLimit.maxIPsPerPair` | 每个 pair ID 允许的最多不同源 IP 数。 |
| `rateLimit.maxClientsPerPair` | 每个 pair ID 最大并发 WebSocket 客户端数。 |
| `rateLimit.maxConnectionsPerIP` | 每个 IP 最大并发连接数（默认 `10`；若示例 JSON 未写，服务端仍使用默认值）。 |
| `rateLimit.cleanupInterval` | 清理过期限流桶的间隔，如 `"5m"`。 |
| `pairing.codeLength` | 配对短码长度。 |
| `pairing.codeTTL` | 配对码有效期，如 `"10m"`。 |
| `pairing.ipRateLimit` | 每 IP 每分钟最多创建配对次数。 |
| `pairing.cleanupInterval` | 清理过期配对码的间隔，如 `"1m"`。 |
