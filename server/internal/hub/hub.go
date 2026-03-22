package hub

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/anthropic/claw-wallet-relay/internal/config"
	"github.com/anthropic/claw-wallet-relay/internal/iputil"
	"github.com/cloudwego/hertz/pkg/app"
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
	pairIPs      map[string]map[string]int
	pairConnRate map[string]*rateBucket
	pendingHTTP  map[string]chan []byte
	relayRate    map[string]*rateBucket
	cfg          config.Config
}

type rateBucket struct {
	count   int
	resetAt time.Time
}

func New(cfg config.Config) *Hub {
	h := &Hub{
		pairs:        make(map[string][]*Client),
		msgRate:      make(map[string]*rateBucket),
		pairIPs:      make(map[string]map[string]int),
		pairConnRate: make(map[string]*rateBucket),
		pendingHTTP:  make(map[string]chan []byte),
		relayRate:    make(map[string]*rateBucket),
		cfg:          cfg,
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
		Send:   make(chan []byte, h.cfg.WS.SendBufferSize),
	}

	h.register(client)
	go h.writePump(client)
	h.readPump(client)
}

func (h *Hub) register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	clients := h.pairs[c.PairID]
	if len(clients) >= h.cfg.RateLimit.MaxClientsPerPair {
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
	return bucket.count <= h.cfg.RateLimit.MessageRate
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
	return len(ips) < h.cfg.RateLimit.MaxIPsPerPair
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
	return bucket.count <= h.cfg.RateLimit.ConnectionRate
}

func (h *Hub) cleanupRateBuckets() {
	interval := config.ParseDuration(h.cfg.RateLimit.CleanupInterval, 5*time.Minute)
	ticker := time.NewTicker(interval)
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
	readTimeout := config.ParseDuration(h.cfg.WS.ReadTimeout, 60*time.Second)

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

		h.notifyPendingHTTPDisconnect(c.PairID)
	}()

	c.Conn.SetReadLimit(h.cfg.WS.ReadLimitBytes)
	c.Conn.SetReadDeadline(time.Now().Add(readTimeout))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(readTimeout))
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

		if h.tryRouteToHTTP(message) {
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
	pingInterval := config.ParseDuration(h.cfg.WS.PingInterval, 30*time.Second)
	writeTimeout := config.ParseDuration(h.cfg.WS.WriteTimeout, 10*time.Second)

	ticker := time.NewTicker(pingInterval)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeTimeout))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeTimeout))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

var (
	ErrNoPeer    = errors.New("no wallet connected for this pairId")
	ErrTimeout   = errors.New("wallet response timeout")
	ErrPeerGone  = errors.New("wallet disconnected")
	ErrRateLimit = errors.New("relay rate limit exceeded")
)

func (h *Hub) tryRouteToHTTP(message []byte) bool {
	var peek struct {
		RequestID string `json:"requestId"`
	}
	if err := json.Unmarshal(message, &peek); err != nil || peek.RequestID == "" {
		return false
	}

	h.mu.RLock()
	ch, ok := h.pendingHTTP[peek.RequestID]
	h.mu.RUnlock()
	if !ok {
		return false
	}

	select {
	case ch <- message:
	default:
	}
	return true
}

func (h *Hub) notifyPendingHTTPDisconnect(pairID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	remaining := len(h.pairs[pairID])
	if remaining > 0 {
		return
	}

	for reqID, ch := range h.pendingHTTP {
		select {
		case ch <- nil:
		default:
		}
		delete(h.pendingHTTP, reqID)
	}
}

func (h *Hub) checkRelayRate(ip string) bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	now := time.Now()
	bucket, ok := h.relayRate[ip]
	if !ok || now.After(bucket.resetAt) {
		h.relayRate[ip] = &rateBucket{count: 1, resetAt: now.Add(time.Minute)}
		return true
	}
	bucket.count++
	return bucket.count <= 30
}

func (h *Hub) SendAndWait(pairID string, requestID string, message []byte, timeout time.Duration) ([]byte, error) {
	h.mu.RLock()
	peers := h.pairs[pairID]
	h.mu.RUnlock()

	if len(peers) == 0 {
		return nil, ErrNoPeer
	}

	ch := make(chan []byte, 1)
	h.mu.Lock()
	h.pendingHTTP[requestID] = ch
	h.mu.Unlock()

	defer func() {
		h.mu.Lock()
		delete(h.pendingHTTP, requestID)
		h.mu.Unlock()
	}()

	sent := false
	for _, peer := range peers {
		select {
		case peer.Send <- message:
			sent = true
		default:
		}
	}
	if !sent {
		return nil, ErrNoPeer
	}

	select {
	case resp := <-ch:
		if resp == nil {
			return nil, ErrPeerGone
		}
		return resp, nil
	case <-time.After(timeout):
		return nil, ErrTimeout
	}
}

func (h *Hub) HandleRelay(_ context.Context, c *app.RequestContext) {
	pairID := c.Param("pairId")
	if pairID == "" {
		c.JSON(http.StatusBadRequest, map[string]string{"error": "missing pairId"})
		return
	}

	clientIP := string(c.GetHeader("X-Forwarded-For"))
	if clientIP != "" {
		if idx := indexOf(clientIP, ','); idx >= 0 {
			clientIP = clientIP[:idx]
		}
	}
	if clientIP == "" {
		clientIP = string(c.GetHeader("X-Real-IP"))
	}
	if clientIP == "" {
		clientIP = c.ClientIP()
	}

	if !h.checkRelayRate(clientIP) {
		c.JSON(http.StatusTooManyRequests, map[string]string{"error": "relay rate limit exceeded"})
		return
	}

	var body struct {
		RequestID string          `json:"requestId"`
		Data      json.RawMessage `json:"data"`
	}
	if err := c.BindJSON(&body); err != nil || body.RequestID == "" {
		c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body, requires requestId and data"})
		return
	}

	envelope, _ := json.Marshal(map[string]interface{}{
		"sourceIP": clientIP,
		"data":     body.Data,
	})

	resp, err := h.SendAndWait(pairID, body.RequestID, envelope, 120*time.Second)
	if err != nil {
		switch {
		case errors.Is(err, ErrNoPeer):
			c.JSON(http.StatusNotFound, map[string]string{"error": "no wallet connected for this pairId"})
		case errors.Is(err, ErrTimeout):
			c.JSON(http.StatusGatewayTimeout, map[string]string{"error": "wallet response timeout"})
		case errors.Is(err, ErrPeerGone):
			c.JSON(http.StatusBadGateway, map[string]string{"error": "wallet disconnected"})
		default:
			c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
		}
		return
	}

	c.Data(http.StatusOK, "application/json", resp)
}

func indexOf(s string, ch byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == ch {
			return i
		}
	}
	return -1
}
