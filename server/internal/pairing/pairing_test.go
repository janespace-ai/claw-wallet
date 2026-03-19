package pairing

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCreateAndResolve(t *testing.T) {
	store := NewStore()

	body, _ := json.Marshal(CreateRequest{
		WalletAddr: "0xabc123",
		CommPubKey: "pubkey-xyz",
	})
	req := httptest.NewRequest(http.MethodPost, "/pair/create", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	store.HandleCreate(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var createResp CreateResponse
	json.Unmarshal(w.Body.Bytes(), &createResp)

	if len(createResp.ShortCode) != codeLength {
		t.Fatalf("expected code length %d, got %d", codeLength, len(createResp.ShortCode))
	}

	resolveReq := httptest.NewRequest(http.MethodGet, "/pair/"+createResp.ShortCode, nil)
	rw := httptest.NewRecorder()
	store.HandleResolve(rw, resolveReq)

	if rw.Code != http.StatusOK {
		t.Fatalf("resolve expected 200, got %d: %s", rw.Code, rw.Body.String())
	}

	var resolveResp map[string]string
	json.Unmarshal(rw.Body.Bytes(), &resolveResp)

	if resolveResp["walletAddr"] != "0xabc123" {
		t.Fatalf("expected walletAddr 0xabc123, got %s", resolveResp["walletAddr"])
	}
	if resolveResp["commPubKey"] != "pubkey-xyz" {
		t.Fatalf("expected commPubKey pubkey-xyz, got %s", resolveResp["commPubKey"])
	}
}

func TestResolveNotFound(t *testing.T) {
	store := NewStore()
	req := httptest.NewRequest(http.MethodGet, "/pair/NONEXIST", nil)
	w := httptest.NewRecorder()
	store.HandleResolve(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestCreateRateLimit(t *testing.T) {
	store := NewStore()

	for i := 0; i < 10; i++ {
		body, _ := json.Marshal(CreateRequest{WalletAddr: "0xabc", CommPubKey: "key"})
		req := httptest.NewRequest(http.MethodPost, "/pair/create", bytes.NewReader(body))
		req.RemoteAddr = "1.2.3.4:12345"
		w := httptest.NewRecorder()
		store.HandleCreate(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("request %d should succeed, got %d", i+1, w.Code)
		}
	}

	body, _ := json.Marshal(CreateRequest{WalletAddr: "0xabc", CommPubKey: "key"})
	req := httptest.NewRequest(http.MethodPost, "/pair/create", bytes.NewReader(body))
	req.RemoteAddr = "1.2.3.4:12345"
	w := httptest.NewRecorder()
	store.HandleCreate(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("11th request should be rate limited, got %d", w.Code)
	}
}

func TestCreateMissingFields(t *testing.T) {
	store := NewStore()

	body, _ := json.Marshal(map[string]string{"walletAddr": "0x123"})
	req := httptest.NewRequest(http.MethodPost, "/pair/create", bytes.NewReader(body))
	w := httptest.NewRecorder()
	store.HandleCreate(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestCodeUniqueness(t *testing.T) {
	codes := make(map[string]bool)
	for i := 0; i < 100; i++ {
		code, err := generateCode()
		if err != nil {
			t.Fatal(err)
		}
		if codes[code] {
			t.Fatalf("duplicate code: %s", code)
		}
		codes[code] = true
	}
}
