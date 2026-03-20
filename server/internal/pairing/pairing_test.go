package pairing

import (
	"bytes"
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	appconfig "github.com/anthropic/claw-wallet-relay/internal/config"
	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/config"
	"github.com/cloudwego/hertz/pkg/common/ut"
	"github.com/cloudwego/hertz/pkg/route"
)

func testStore() *Store {
	return NewStore(appconfig.Default().Pairing)
}

func setupRouter(store *Store) *route.Engine {
	router := route.NewEngine(config.NewOptions([]config.Option{}))
	router.POST("/pair/create", store.HandleCreate)
	router.GET("/pair/:code", store.HandleResolve)
	return router
}

func TestCreateAndResolve(t *testing.T) {
	store := testStore()
	router := setupRouter(store)

	body, _ := json.Marshal(CreateRequest{
		WalletAddr: "0xabc123",
		CommPubKey: "pubkey-xyz",
	})

	w := ut.PerformRequest(router, "POST", "/pair/create",
		&ut.Body{Body: bytes.NewReader(body), Len: len(body)},
		ut.Header{Key: "Content-Type", Value: "application/json"})
	resp := w.Result()

	if resp.StatusCode() != 200 {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode(), string(resp.Body()))
	}

	var createResp CreateResponse
	json.Unmarshal(resp.Body(), &createResp)

	if len(createResp.ShortCode) != store.cfg.CodeLength {
		t.Fatalf("expected code length %d, got %d", store.cfg.CodeLength, len(createResp.ShortCode))
	}

	w2 := ut.PerformRequest(router, "GET", "/pair/"+createResp.ShortCode, nil)
	resp2 := w2.Result()

	if resp2.StatusCode() != 200 {
		t.Fatalf("resolve expected 200, got %d: %s", resp2.StatusCode(), string(resp2.Body()))
	}

	var resolveResp map[string]string
	json.Unmarshal(resp2.Body(), &resolveResp)

	if resolveResp["walletAddr"] != "0xabc123" {
		t.Fatalf("expected walletAddr 0xabc123, got %s", resolveResp["walletAddr"])
	}
	if resolveResp["commPubKey"] != "pubkey-xyz" {
		t.Fatalf("expected commPubKey pubkey-xyz, got %s", resolveResp["commPubKey"])
	}
}

func TestResolveNotFound(t *testing.T) {
	store := testStore()
	router := setupRouter(store)

	w := ut.PerformRequest(router, "GET", "/pair/NONEXIST", nil)
	resp := w.Result()

	if resp.StatusCode() != 404 {
		t.Fatalf("expected 404, got %d", resp.StatusCode())
	}
}

func TestCreateRateLimit(t *testing.T) {
	store := testStore()
	router := setupRouter(store)

	for i := 0; i < 10; i++ {
		body, _ := json.Marshal(CreateRequest{WalletAddr: "0xabc", CommPubKey: "key"})
		w := ut.PerformRequest(router, "POST", "/pair/create",
			&ut.Body{Body: bytes.NewReader(body), Len: len(body)},
			ut.Header{Key: "Content-Type", Value: "application/json"},
			ut.Header{Key: "X-Forwarded-For", Value: "1.2.3.4"})
		resp := w.Result()
		if resp.StatusCode() != 200 {
			t.Fatalf("request %d should succeed, got %d", i+1, resp.StatusCode())
		}
	}

	body, _ := json.Marshal(CreateRequest{WalletAddr: "0xabc", CommPubKey: "key"})
	w := ut.PerformRequest(router, "POST", "/pair/create",
		&ut.Body{Body: bytes.NewReader(body), Len: len(body)},
		ut.Header{Key: "Content-Type", Value: "application/json"},
		ut.Header{Key: "X-Forwarded-For", Value: "1.2.3.4"})
	resp := w.Result()
	if resp.StatusCode() != 429 {
		t.Fatalf("11th request should be rate limited, got %d", resp.StatusCode())
	}
}

func TestCreateMissingFields(t *testing.T) {
	store := testStore()
	router := setupRouter(store)

	body, _ := json.Marshal(map[string]string{"walletAddr": "0x123"})
	w := ut.PerformRequest(router, "POST", "/pair/create",
		&ut.Body{Body: bytes.NewReader(body), Len: len(body)},
		ut.Header{Key: "Content-Type", Value: "application/json"})
	resp := w.Result()

	if resp.StatusCode() != 400 {
		t.Fatalf("expected 400, got %d", resp.StatusCode())
	}
}

func TestCodeUniqueness(t *testing.T) {
	store := testStore()
	codes := make(map[string]bool)
	for i := 0; i < 100; i++ {
		code, err := store.generateCode()
		if err != nil {
			t.Fatal(err)
		}
		if codes[code] {
			t.Fatalf("duplicate code: %s", code)
		}
		codes[code] = true
	}
}

func TestExtractIP(t *testing.T) {
	var capturedIP string
	router := route.NewEngine(config.NewOptions([]config.Option{}))
	router.GET("/test-ip", func(_ context.Context, c *app.RequestContext) {
		capturedIP = extractIP(c)
		c.String(200, "ok")
	})

	ut.PerformRequest(router, "GET", "/test-ip", nil,
		ut.Header{Key: "X-Forwarded-For", Value: "10.0.0.1, 10.0.0.2"})
	if capturedIP != "10.0.0.1" {
		t.Fatalf("expected IP 10.0.0.1, got %s", capturedIP)
	}
}

func TestResolveExpiredCode(t *testing.T) {
	store := testStore()
	ttl := store.codeTTL()

	store.mu.Lock()
	store.codes["EXPIRED1"] = &PairInfo{
		WalletAddr: "0xexpired",
		CommPubKey: "key-expired",
		CreatedAt:  time.Now().Add(-(ttl + time.Minute)),
		CreatorIP:  "127.0.0.1",
	}
	store.mu.Unlock()

	router := setupRouter(store)
	w := ut.PerformRequest(router, "GET", "/pair/EXPIRED1", nil)
	resp := w.Result()

	if resp.StatusCode() != 404 {
		t.Fatalf("expected 404 for expired code, got %d", resp.StatusCode())
	}
}

func TestCreateInvalidJSON(t *testing.T) {
	store := testStore()
	router := setupRouter(store)

	invalidBody := []byte(`{invalid json`)
	w := ut.PerformRequest(router, "POST", "/pair/create",
		&ut.Body{Body: bytes.NewReader(invalidBody), Len: len(invalidBody)},
		ut.Header{Key: "Content-Type", Value: "application/json"})
	resp := w.Result()

	if resp.StatusCode() != 400 {
		t.Fatalf("expected 400 for invalid JSON, got %d", resp.StatusCode())
	}
}

func TestResolveCaseInsensitive(t *testing.T) {
	store := testStore()
	router := setupRouter(store)

	body, _ := json.Marshal(CreateRequest{
		WalletAddr: "0xcase",
		CommPubKey: "key-case",
	})

	w := ut.PerformRequest(router, "POST", "/pair/create",
		&ut.Body{Body: bytes.NewReader(body), Len: len(body)},
		ut.Header{Key: "Content-Type", Value: "application/json"})
	resp := w.Result()

	var createResp CreateResponse
	json.Unmarshal(resp.Body(), &createResp)

	lowered := strings.ToLower(createResp.ShortCode)
	w2 := ut.PerformRequest(router, "GET", "/pair/"+lowered, nil)
	resp2 := w2.Result()

	if resp2.StatusCode() != 200 {
		t.Fatalf("expected 200 for lowercase code, got %d: %s", resp2.StatusCode(), string(resp2.Body()))
	}
}
