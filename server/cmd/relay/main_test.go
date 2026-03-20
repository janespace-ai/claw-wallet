package main

import (
	"context"
	"testing"

	"github.com/cloudwego/hertz/pkg/app"
	hertzconfig "github.com/cloudwego/hertz/pkg/common/config"
	"github.com/cloudwego/hertz/pkg/common/ut"
	"github.com/cloudwego/hertz/pkg/route"

	appconfig "github.com/anthropic/claw-wallet-relay/internal/config"
	"github.com/anthropic/claw-wallet-relay/internal/middleware"
	"github.com/anthropic/claw-wallet-relay/internal/pairing"
)

func setupIntegrationRouter() *route.Engine {
	cfg := appconfig.Default()
	router := route.NewEngine(hertzconfig.NewOptions([]hertzconfig.Option{}))

	router.Use(middleware.CORS(cfg.CORSAllowedOrigins))
	router.Use(middleware.AccessLog())

	pairStore := pairing.NewStore(cfg.Pairing)
	router.POST("/pair/create", pairStore.HandleCreate)
	router.GET("/pair/:code", pairStore.HandleResolve)

	router.GET("/health", func(_ context.Context, c *app.RequestContext) {
		c.SetContentType("application/json")
		c.SetBodyString(`{"status":"ok"}`)
	})

	return router
}

func TestHealthEndpoint(t *testing.T) {
	router := setupIntegrationRouter()

	w := ut.PerformRequest(router, "GET", "/health", nil)
	resp := w.Result()

	if resp.StatusCode() != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode())
	}

	body := string(resp.Body())
	if body != `{"status":"ok"}` {
		t.Fatalf("expected {\"status\":\"ok\"}, got %s", body)
	}
}

func TestIntegrationCORSOnHealth(t *testing.T) {
	router := setupIntegrationRouter()

	w := ut.PerformRequest(router, "GET", "/health", nil)
	resp := w.Result()

	origin := resp.Header.Get("Access-Control-Allow-Origin")
	if origin != "*" {
		t.Fatalf("expected CORS header on health, got %s", origin)
	}
}

func TestIntegrationRoutesRegistered(t *testing.T) {
	router := setupIntegrationRouter()

	tests := []struct {
		method string
		path   string
		want   int
	}{
		{"GET", "/health", 200},
		{"GET", "/pair/NONEXIST", 404},
	}

	for _, tt := range tests {
		w := ut.PerformRequest(router, tt.method, tt.path, nil)
		resp := w.Result()
		if resp.StatusCode() != tt.want {
			t.Errorf("%s %s: expected %d, got %d", tt.method, tt.path, tt.want, resp.StatusCode())
		}
	}
}
