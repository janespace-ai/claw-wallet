package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/hertz/pkg/common/adaptor"

	"github.com/anthropic/claw-wallet-relay/internal/hub"
	"github.com/anthropic/claw-wallet-relay/internal/middleware"
	"github.com/anthropic/claw-wallet-relay/internal/pairing"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	h := hub.New()
	pairStore := pairing.NewStore()

	addr := ":" + port
	srv := server.Default(
		server.WithHostPorts(addr),
		server.WithExitWaitTime(10*time.Second),
	)

	srv.Use(middleware.CORS())
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
