package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/anthropic/claw-wallet-relay/internal/hub"
	"github.com/anthropic/claw-wallet-relay/internal/pairing"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	h := hub.New()
	pairStore := pairing.NewStore()

	mux := http.NewServeMux()

	mux.HandleFunc("/ws", h.HandleWS)
	mux.HandleFunc("/pair/create", pairStore.HandleCreate)
	mux.HandleFunc("/pair/", pairStore.HandleResolve)

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok"}`)
	})

	addr := ":" + port
	log.Printf("Claw Wallet Relay Server starting on %s", addr)
	log.Printf("  WebSocket: /ws?pairId=<id>")
	log.Printf("  Pairing:   POST /pair/create, GET /pair/<code>")
	log.Printf("  Health:    GET /health")

	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
