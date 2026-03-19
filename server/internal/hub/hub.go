package hub

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Client struct {
	PairID string
	Conn   *websocket.Conn
	IP     string
	Send   chan []byte
}

type Hub struct {
	mu      sync.RWMutex
	pairs   map[string][]*Client // pairId -> clients (max 2)
	msgRate map[string]*rateBucket
}

type rateBucket struct {
	count    int
	windowMs int64
	resetAt  time.Time
}

type relayMessage struct {
	SourceIP string          `json:"sourceIP,omitempty"`
	Raw      json.RawMessage `json:"data"`
}

func New() *Hub {
	return &Hub{
		pairs:   make(map[string][]*Client),
		msgRate: make(map[string]*rateBucket),
	}
}

func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	pairID := r.URL.Query().Get("pairId")
	if pairID == "" {
		http.Error(w, "missing pairId", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("upgrade error: %v", err)
		return
	}

	clientIP := extractIP(r)
	client := &Client{
		PairID: pairID,
		Conn:   conn,
		IP:     clientIP,
		Send:   make(chan []byte, 64),
	}

	h.register(client)
	go h.writePump(client)
	h.readPump(client)
}

func (h *Hub) register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	clients := h.pairs[c.PairID]
	if len(clients) >= 2 {
		oldest := clients[0]
		oldest.Conn.Close()
		clients = clients[1:]
	}
	h.pairs[c.PairID] = append(clients, c)
	log.Printf("client registered: pairId=%s ip=%s (total=%d)", c.PairID, c.IP, len(h.pairs[c.PairID]))
}

func (h *Hub) unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	clients := h.pairs[c.PairID]
	for i, cl := range clients {
		if cl == c {
			h.pairs[c.PairID] = append(clients[:i], clients[i+1:]...)
			break
		}
	}
	if len(h.pairs[c.PairID]) == 0 {
		delete(h.pairs, c.PairID)
	}
	close(c.Send)
	log.Printf("client unregistered: pairId=%s ip=%s", c.PairID, c.IP)
}

func (h *Hub) checkMsgRate(clientAddr string) bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	now := time.Now()
	bucket, ok := h.msgRate[clientAddr]
	if !ok || now.After(bucket.resetAt) {
		h.msgRate[clientAddr] = &rateBucket{count: 1, resetAt: now.Add(time.Second)}
		return true
	}
	bucket.count++
	return bucket.count <= 100
}

func (h *Hub) readPump(c *Client) {
	defer func() {
		h.unregister(c)
		c.Conn.Close()

		h.mu.RLock()
		peers := h.pairs[c.PairID]
		h.mu.RUnlock()
		for _, peer := range peers {
			disconnectMsg, _ := json.Marshal(map[string]string{
				"type":     "peer_disconnected",
				"sourceIP": c.IP,
			})
			select {
			case peer.Send <- disconnectMsg:
			default:
			}
		}
	}()

	c.Conn.SetReadLimit(64 * 1024)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		addr := c.Conn.RemoteAddr().String()
		if !h.checkMsgRate(addr) {
			log.Printf("rate limit exceeded: %s", addr)
			continue
		}

		envelope, _ := json.Marshal(map[string]interface{}{
			"sourceIP": c.IP,
			"data":     json.RawMessage(message),
		})

		h.mu.RLock()
		peers := h.pairs[c.PairID]
		h.mu.RUnlock()

		for _, peer := range peers {
			if peer != c {
				select {
				case peer.Send <- envelope:
				default:
					log.Printf("send buffer full for peer, dropping message")
				}
			}
		}
	}
}

func (h *Hub) writePump(c *Client) {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func extractIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return xff
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	host := r.RemoteAddr
	for i := len(host) - 1; i >= 0; i-- {
		if host[i] == ':' {
			return host[:i]
		}
	}
	return host
}
