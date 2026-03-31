package config

import (
	"encoding/json"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all server configuration parameters.
type Config struct {
	// Server listen port (env: CLAW_SERVER_PORT or PORT, default: "8080")
	Port string `json:"port"`
	// Allowed CORS origins; use ["*"] for development, restrict in production (env: CLAW_SERVER_CORS_ORIGINS, comma-separated)
	CORSAllowedOrigins []string `json:"corsAllowedOrigins"`
	// Graceful shutdown timeout as duration string, e.g. "10s" (default: "10s")
	GracefulShutdown string `json:"gracefulShutdown"`
	// WebSocket connection parameters
	WS WSConfig `json:"ws"`
	// Rate limiting parameters
	RateLimit RateLimitConfig `json:"rateLimit"`
	// Pairing code parameters
	Pairing PairingConfig `json:"pairing"`
}

// WSConfig holds WebSocket-related tuning parameters.
type WSConfig struct {
	// Maximum incoming WebSocket message size in bytes (default: 65536 = 64KB)
	ReadLimitBytes int64 `json:"readLimitBytes"`
	// Read deadline / pong wait timeout, e.g. "60s" (default: "60s")
	ReadTimeout string `json:"readTimeout"`
	// Write deadline for outgoing messages, e.g. "10s" (default: "10s")
	WriteTimeout string `json:"writeTimeout"`
	// Interval between keep-alive ping frames, e.g. "30s" (default: "30s")
	PingInterval string `json:"pingInterval"`
	// Per-client outgoing message buffer size (default: 64)
	SendBufferSize int `json:"sendBufferSize"`
}

// RateLimitConfig holds rate-limiting tuning parameters.
type RateLimitConfig struct {
	// Maximum messages per second per client (default: 100)
	MessageRate int `json:"messageRate"`
	// Maximum new connections per minute per pair ID (default: 10)
	ConnectionRate int `json:"connectionRate"`
	// Maximum unique source IPs allowed per pair ID (default: 2)
	MaxIPsPerPair int `json:"maxIPsPerPair"`
	// Maximum concurrent WebSocket clients per pair ID (default: 2)
	MaxClientsPerPair int `json:"maxClientsPerPair"`
	// Maximum concurrent connections per IP address (default: 10)
	MaxConnectionsPerIP int `json:"maxConnectionsPerIP"`
	// Interval to purge expired rate-limit buckets, e.g. "5m" (default: "5m")
	CleanupInterval string `json:"cleanupInterval"`
}

// PairingConfig holds pairing-code tuning parameters.
type PairingConfig struct {
	// Length of generated pairing short codes (default: 8)
	CodeLength int `json:"codeLength"`
	// Time-to-live for pairing codes, e.g. "10m" (default: "10m")
	CodeTTL string `json:"codeTTL"`
	// Maximum pairing code creates per minute per IP (default: 10)
	IPRateLimit int `json:"ipRateLimit"`
	// Interval to purge expired pairing codes, e.g. "1m" (default: "1m")
	CleanupInterval string `json:"cleanupInterval"`
}

// Default returns a Config populated with sensible defaults.
func Default() Config {
	return Config{
		Port:               "8080",
		CORSAllowedOrigins: []string{"*"},
		GracefulShutdown:   "10s",
		WS: WSConfig{
			ReadLimitBytes: 64 * 1024,
			ReadTimeout:    "60s",
			WriteTimeout:   "10s",
			PingInterval:   "30s",
			SendBufferSize: 64,
		},
		RateLimit: RateLimitConfig{
			MessageRate:         100,
			ConnectionRate:      10,
			MaxIPsPerPair:       2,
			MaxClientsPerPair:   2,
			MaxConnectionsPerIP: 10,
			CleanupInterval:     "5m",
		},
		Pairing: PairingConfig{
			CodeLength:      8,
			CodeTTL:         "10m",
			IPRateLimit:     10,
			CleanupInterval: "1m",
		},
	}
}

// LoadConfig reads config.json if present, then applies environment variable overrides.
// Missing fields retain their default values.
func LoadConfig() Config {
	cfg := Default()

	for _, path := range []string{"config.json", "server/config.json"} {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		if err := json.Unmarshal(data, &cfg); err != nil {
			log.Printf("[config] WARNING: failed to parse %s: %v, using defaults", path, err)
		} else {
			log.Printf("[config] Loaded from %s", path)
		}
		break
	}

	if v := envStr("CLAW_SERVER_PORT", envStr("PORT", "")); v != "" {
		cfg.Port = v
	}
	if v := envStr("CLAW_SERVER_CORS_ORIGINS", ""); v != "" {
		cfg.CORSAllowedOrigins = strings.Split(v, ",")
	}

	return cfg
}

// ParseDuration parses a duration string with a fallback default.
func ParseDuration(s string, fallback time.Duration) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		return fallback
	}
	return d
}

func envStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}
