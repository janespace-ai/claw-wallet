package hub

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/anthropic/claw-wallet-relay/internal/iputil"
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
	mu           sync.RWMutex
	pairs        map[string][]*Client
	msgRate      map[string]*rateBucket
	pairIPs      map[string]map[string]int // pairId -> ip -> client count
	pairConnRate map[string]*rateBucket    // pairId -> connection rate
}

type rateBucket struct {
	count   int
	resetAt time.Time
}

func New() *Hub {
	h := &Hub{
		pairs:        make(map[string][]*Client),
		msgRate:      make(map[string]*rateBucket),
		pairIPs:      make(map[string]map[string]int),
		pairConnRate: make(map[string]*rateBucket),
	}
	go h.cleanupRateBuckets()
	return h
}

func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	pairID := r.URL.Query().Get("pairId")
	if pairID == "" {
		http.Error(w, "missing pairId", http.StatusBadRequest)
		return
	}

	clientIP := iputil.ExtractIP(r)

	if !h.checkPairConnRate(pairID) {
		http.Error(w, "connection rate limit exceeded", http.StatusTooManyRequests)
		return
	}

	if !h.checkPairIPLimit(pairID, clientIP) {
		http.Error(w, "pair IP limit exceeded", http.StatusForbidden)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("upgrade error: %v", err)
		return
	}

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
		h.removeIPTracking(oldest.PairID, oldest.IP)
		oldest.Conn.Close()
		clients = clients[1:]
	}
	h.pairs[c.PairID] = append(clients, c)

	if h.pairIPs[c.PairID] == nil {
		h.pairIPs[c.PairID] = make(map[string]int)
	}
	h.pairIPs[c.PairID][c.IP]++

	pairIdShort := c.PairID
	if len(pairIdShort) > 8 {
		pairIdShort = pairIdShort[:8]
	}
	log.Printf("client connect: pairId=%s ip=%s active=%d", pairIdShort, c.IP, len(h.pairs[c.PairID]))
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
		delete(h.pairIPs, c.PairID)
	} else {
		h.removeIPTracking(c.PairID, c.IP)
	}
	close(c.Send)

	pairIdShort := c.PairID
	if len(pairIdShort) > 8 {
		pairIdShort = pairIdShort[:8]
	}
	remaining := len(h.pairs[c.PairID])
	log.Printf("client disconnect: pairId=%s ip=%s active=%d", pairIdShort, c.IP, remaining)
}

func (h *Hub) removeIPTracking(pairID, ip string) {
	ips := h.pairIPs[pairID]
	if ips == nil {
		return
	}
	ips[ip]--
	if ips[ip] <= 0 {
		delete(ips, ip)
	}
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

func (h *Hub) checkPairIPLimit(pairID, ip string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	ips := h.pairIPs[pairID]
	if ips == nil {
		return true
	}
	if _, exists := ips[ip]; exists {
		return true
	}
	return len(ips) < 2
}

func (h *Hub) checkPairConnRate(pairID string) bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	now := time.Now()
	bucket, ok := h.pairConnRate[pairID]
	if !ok || now.After(bucket.resetAt) {
		h.pairConnRate[pairID] = &rateBucket{count: 1, resetAt: now.Add(time.Minute)}
		return true
	}
	bucket.count++
	return bucket.count <= 10
}

func (h *Hub) cleanupRateBuckets() {
	ticker := time.NewTicker(5 * time.Minute)
	for range ticker.C {
		h.mu.Lock()
		now := time.Now()
		for k, b := range h.pairConnRate {
			if now.After(b.resetAt) {
				delete(h.pairConnRate, k)
			}
		}
		for k, b := range h.msgRate {
			if now.After(b.resetAt) {
				delete(h.msgRate, k)
			}
		}
		h.mu.Unlock()
	}
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
