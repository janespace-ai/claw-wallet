package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/hertz/pkg/common/adaptor"

	"github.com/anthropic/claw-wallet-relay/internal/config"
	"github.com/anthropic/claw-wallet-relay/internal/hub"
	"github.com/anthropic/claw-wallet-relay/internal/middleware"
	"github.com/anthropic/claw-wallet-relay/internal/pairing"
)

func main() {
	cfg := config.LoadConfig()

	h := hub.New(cfg)
	pairStore := pairing.NewStore(cfg.Pairing)

	addr := ":" + cfg.Port
	srv := server.Default(
		server.WithHostPorts(addr),
		server.WithExitWaitTime(config.ParseDuration(cfg.GracefulShutdown, 10_000_000_000)),
	)

	srv.Use(middleware.CORS(cfg.CORSAllowedOrigins))
	srv.Use(middleware.AccessLog())

	srv.GET("/ws", adaptor.HertzHandler(http.HandlerFunc(h.HandleWS)))

	srv.POST("/pair/create", pairStore.HandleCreate)
	srv.GET("/pair/:code", pairStore.HandleResolve)

	srv.GET("/health", adaptor.HertzHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok"}`)
	})))

	log.Printf("Claw Wallet Relay Server starting on %s", addr)
	log.Printf("  WebSocket: /ws?pairId=<id>")
	log.Printf("  Pairing:   POST /pair/create, GET /pair/<code>")
	log.Printf("  Health:    GET /health")

	srv.Spin()
}
