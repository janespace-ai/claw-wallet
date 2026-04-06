# Relay server configuration

Place `config.json` in the process working directory or under `server/`. Load order is in `internal/config/config.go`: try `config.json`, then `server/config.json`. Missing fields keep code defaults.

Copy `config.example.json` and edit as needed.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `CLAW_SERVER_PORT` or `PORT` | Listen port as a string, e.g. `"8080"`. |
| `CLAW_SERVER_CORS_ORIGINS` | Allowed CORS origins, comma-separated; overrides `corsAllowedOrigins`. |

## Top-level keys

| Path | Description |
|------|-------------|
| `port` | Server listen port. |
| `corsAllowedOrigins` | CORS allowlist; `["*"]` is fine for dev, tighten in production. |
| `gracefulShutdown` | Graceful shutdown wait as a Go duration string, e.g. `"10s"`. |
| `ws.readLimitBytes` | Max size in bytes for a single inbound WebSocket message (default 65536). |
| `ws.readTimeout` | Read deadline / pong wait, e.g. `"60s"`. |
| `ws.writeTimeout` | Write deadline, e.g. `"10s"`. |
| `ws.pingInterval` | Keep-alive ping interval, e.g. `"30s"`. |
| `ws.sendBufferSize` | Per-client outbound message buffer size. |
| `rateLimit.messageRate` | Max messages per second per client. |
| `rateLimit.connectionRate` | Max new connections per minute per pair ID. |
| `rateLimit.maxIPsPerPair` | Max distinct source IPs per pair ID. |
| `rateLimit.maxClientsPerPair` | Max concurrent WebSocket clients per pair ID. |
| `rateLimit.maxConnectionsPerIP` | Max concurrent connections per IP (default `10`; server defaults apply if omitted from JSON). |
| `rateLimit.cleanupInterval` | Interval to purge expired rate-limit buckets, e.g. `"5m"`. |
| `pairing.codeLength` | Length of generated pairing short codes. |
| `pairing.codeTTL` | Pairing code lifetime, e.g. `"10m"`. |
| `pairing.ipRateLimit` | Max pairing-code creations per minute per IP. |
| `pairing.cleanupInterval` | Interval to purge expired pairing codes, e.g. `"1m"`. |
