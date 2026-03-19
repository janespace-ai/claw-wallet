package middleware

import (
	"context"
	"testing"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/config"
	"github.com/cloudwego/hertz/pkg/common/ut"
	"github.com/cloudwego/hertz/pkg/route"
)

func TestCORSOptionsPreflight(t *testing.T) {
	router := route.NewEngine(config.NewOptions([]config.Option{}))
	router.Use(CORS())
	router.GET("/test", func(_ context.Context, c *app.RequestContext) {
		c.String(200, "ok")
	})

	w := ut.PerformRequest(router, "OPTIONS", "/test", nil)
	resp := w.Result()

	if resp.StatusCode() != 204 {
		t.Fatalf("expected 204, got %d", resp.StatusCode())
	}

	origin := resp.Header.Get("Access-Control-Allow-Origin")
	if origin != "*" {
		t.Fatalf("expected Access-Control-Allow-Origin *, got %s", origin)
	}

	methods := resp.Header.Get("Access-Control-Allow-Methods")
	if methods == "" {
		t.Fatal("expected Access-Control-Allow-Methods header to be set")
	}

	headers := resp.Header.Get("Access-Control-Allow-Headers")
	if headers == "" {
		t.Fatal("expected Access-Control-Allow-Headers header to be set")
	}

	maxAge := resp.Header.Get("Access-Control-Max-Age")
	if maxAge != "86400" {
		t.Fatalf("expected Access-Control-Max-Age 86400, got %s", maxAge)
	}
}

func TestCORSRegularRequest(t *testing.T) {
	router := route.NewEngine(config.NewOptions([]config.Option{}))
	router.Use(CORS())
	router.GET("/test", func(_ context.Context, c *app.RequestContext) {
		c.String(200, "hello")
	})

	w := ut.PerformRequest(router, "GET", "/test", nil)
	resp := w.Result()

	if resp.StatusCode() != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode())
	}

	origin := resp.Header.Get("Access-Control-Allow-Origin")
	if origin != "*" {
		t.Fatalf("expected Access-Control-Allow-Origin *, got %s", origin)
	}

	if string(resp.Body()) != "hello" {
		t.Fatalf("expected body 'hello', got '%s'", string(resp.Body()))
	}
}

func TestAccessLogPassthrough(t *testing.T) {
	handlerCalled := false

	router := route.NewEngine(config.NewOptions([]config.Option{}))
	router.Use(AccessLog())
	router.GET("/test", func(_ context.Context, c *app.RequestContext) {
		handlerCalled = true
		c.String(200, "logged")
	})

	w := ut.PerformRequest(router, "GET", "/test", nil)
	resp := w.Result()

	if !handlerCalled {
		t.Fatal("downstream handler was not called through AccessLog middleware")
	}

	if resp.StatusCode() != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode())
	}

	if string(resp.Body()) != "logged" {
		t.Fatalf("expected body 'logged', got '%s'", string(resp.Body()))
	}
}
