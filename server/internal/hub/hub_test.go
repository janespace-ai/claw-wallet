package hub

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func setupTestServer(h *Hub) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(h.HandleWS))
}

func wsURL(s *httptest.Server, pairID string) string {
	url := "ws" + strings.TrimPrefix(s.URL, "http") + "/ws"
	if pairID != "" {
		url += "?pairId=" + pairID
	}
	return url
}

func dial(t *testing.T, s *httptest.Server, pairID string) *websocket.Conn {
	t.Helper()
	conn, resp, err := websocket.DefaultDialer.Dial(wsURL(s, pairID), nil)
	if err != nil {
		t.Fatalf("dial failed: %v (resp=%v)", err, resp)
	}
	return conn
}

func readJSON(t *testing.T, conn *websocket.Conn, timeout time.Duration) map[string]interface{} {
	t.Helper()
	conn.SetReadDeadline(time.Now().Add(timeout))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read failed: %v", err)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(msg, &result); err != nil {
		t.Fatalf("unmarshal failed: %v (raw=%s)", err, string(msg))
	}
	return result
}

func TestWSConnect(t *testing.T) {
	h := New()
	s := setupTestServer(h)
	defer s.Close()

	conn := dial(t, s, "test-pair")
	defer conn.Close()

	err := conn.WriteMessage(websocket.TextMessage, []byte(`{"hello":"world"}`))
	if err != nil {
		t.Fatalf("write failed: %v", err)
	}
}

func TestWSMissingPairId(t *testing.T) {
	h := New()
	s := setupTestServer(h)
	defer s.Close()

	_, resp, err := websocket.DefaultDialer.Dial(wsURL(s, ""), nil)
	if err == nil {
		t.Fatal("expected dial to fail with missing pairId")
	}
	if resp != nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestWSMessageRelay(t *testing.T) {
	h := New()
	s := setupTestServer(h)
	defer s.Close()

	connA := dial(t, s, "relay-pair")
	defer connA.Close()
	connB := dial(t, s, "relay-pair")
	defer connB.Close()

	time.Sleep(50 * time.Millisecond)

	payload := `{"msg":"hello from A"}`
	if err := connA.WriteMessage(websocket.TextMessage, []byte(payload)); err != nil {
		t.Fatalf("write failed: %v", err)
	}

	envelope := readJSON(t, connB, 2*time.Second)

	if _, ok := envelope["sourceIP"]; !ok {
		t.Fatal("envelope missing sourceIP")
	}
	if envelope["data"] == nil {
		t.Fatal("envelope missing data")
	}
}

func TestWSMessageNotEchoedToSender(t *testing.T) {
	h := New()
	s := setupTestServer(h)
	defer s.Close()

	connA := dial(t, s, "echo-pair")
	defer connA.Close()
	connB := dial(t, s, "echo-pair")
	defer connB.Close()

	time.Sleep(50 * time.Millisecond)

	if err := connA.WriteMessage(websocket.TextMessage, []byte(`{"test":"data"}`)); err != nil {
		t.Fatalf("write failed: %v", err)
	}

	// B should receive it
	readJSON(t, connB, 2*time.Second)

	// A should NOT receive it — set short deadline
	connA.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
	_, _, err := connA.ReadMessage()
	if err == nil {
		t.Fatal("sender should not receive its own message")
	}
}

func TestWSDisconnectNotification(t *testing.T) {
	h := New()
	s := setupTestServer(h)
	defer s.Close()

	connA := dial(t, s, "disconnect-pair")
	connB := dial(t, s, "disconnect-pair")
	defer connB.Close()

	time.Sleep(50 * time.Millisecond)

	connA.Close()

	msg := readJSON(t, connB, 2*time.Second)
	if msg["type"] != "peer_disconnected" {
		t.Fatalf("expected peer_disconnected, got %v", msg["type"])
	}
}

func TestWSPairCapacityEviction(t *testing.T) {
	h := New()
	s := setupTestServer(h)
	defer s.Close()

	conn1 := dial(t, s, "cap-pair")
	conn2 := dial(t, s, "cap-pair")
	defer conn2.Close()

	time.Sleep(50 * time.Millisecond)

	conn3 := dial(t, s, "cap-pair")
	defer conn3.Close()

	// Wait for eviction and unregister goroutines to settle
	time.Sleep(300 * time.Millisecond)

	// conn1 should have been evicted — reading should fail
	conn1.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
	_, _, err := conn1.ReadMessage()
	if err == nil {
		t.Fatal("first client should have been evicted when third connected")
	}
	conn1.Close()

	// Verify pair has exactly 2 clients
	h.mu.RLock()
	count := len(h.pairs["cap-pair"])
	h.mu.RUnlock()
	if count != 2 {
		t.Fatalf("expected 2 clients in pair, got %d", count)
	}
}

func TestWSMessageRateLimit(t *testing.T) {
	h := New()
	s := setupTestServer(h)
	defer s.Close()

	connA := dial(t, s, "rate-pair")
	defer connA.Close()
	connB := dial(t, s, "rate-pair")
	defer connB.Close()

	time.Sleep(50 * time.Millisecond)

	for i := 0; i < 110; i++ {
		connA.WriteMessage(websocket.TextMessage, []byte(`{"i":"msg"}`))
	}

	time.Sleep(200 * time.Millisecond)

	received := 0
	connB.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
	for {
		_, _, err := connB.ReadMessage()
		if err != nil {
			break
		}
		received++
	}

	if received > 100 {
		t.Fatalf("rate limit should cap at 100 messages, but received %d", received)
	}
	if received == 0 {
		t.Fatal("should have received at least some messages")
	}
}
