package hub

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"

	"github.com/anthropic/claw-wallet-relay/internal/iputil"
)

// ConnectionLimiter tracks active WebSocket connections per IP address
// and enforces a configurable maximum limit.
type ConnectionLimiter struct {
	mu          sync.RWMutex
	connections map[string]int // IP -> active connection count
	maxPerIP    int
}

// NewConnectionLimiter creates a new connection limiter with the specified max connections per IP.
func NewConnectionLimiter(maxPerIP int) *ConnectionLimiter {
	if maxPerIP <= 0 {
		maxPerIP = 10 // Default to 10 connections per IP
	}
	return &ConnectionLimiter{
		connections: make(map[string]int),
		maxPerIP:    maxPerIP,
	}
}

// ExtractIPFromRequest extracts the client IP from HTTP request headers.
// It checks X-Forwarded-For, X-Real-IP, and falls back to RemoteAddr.
func ExtractIPFromRequest(r *http.Request) string {
	return iputil.ExtractIP(r)
}

// AllowConnection checks if a new connection from the given IP is allowed.
// Returns true if the connection is allowed, false if the IP has reached its limit.
func (cl *ConnectionLimiter) AllowConnection(ip string) bool {
	cl.mu.Lock()
	defer cl.mu.Unlock()

	currentCount := cl.connections[ip]
	if currentCount >= cl.maxPerIP {
		log.Printf("[ConnectionLimiter] IP %s rejected: %d/%d connections", ip, currentCount, cl.maxPerIP)
		return false
	}

	cl.connections[ip]++
	log.Printf("[ConnectionLimiter] IP %s allowed: %d/%d connections", ip, cl.connections[ip], cl.maxPerIP)
	return true
}

// ReleaseConnection decrements the connection count for the given IP.
// Should be called when a connection is closed.
func (cl *ConnectionLimiter) ReleaseConnection(ip string) {
	cl.mu.Lock()
	defer cl.mu.Unlock()

	if cl.connections[ip] > 0 {
		cl.connections[ip]--
		log.Printf("[ConnectionLimiter] IP %s released: %d/%d connections remaining", ip, cl.connections[ip], cl.maxPerIP)
		
		// Clean up if count reaches zero
		if cl.connections[ip] == 0 {
			delete(cl.connections, ip)
		}
	}
}

// GetConnectionCount returns the current connection count for the given IP.
func (cl *ConnectionLimiter) GetConnectionCount(ip string) int {
	cl.mu.RLock()
	defer cl.mu.RUnlock()
	return cl.connections[ip]
}

// GetAllConnectionCounts returns a copy of all IP connection counts for monitoring.
func (cl *ConnectionLimiter) GetAllConnectionCounts() map[string]int {
	cl.mu.RLock()
	defer cl.mu.RUnlock()

	counts := make(map[string]int, len(cl.connections))
	for ip, count := range cl.connections {
		counts[ip] = count
	}
	return counts
}

// GetTotalConnections returns the total number of active connections across all IPs.
func (cl *ConnectionLimiter) GetTotalConnections() int {
	cl.mu.RLock()
	defer cl.mu.RUnlock()

	total := 0
	for _, count := range cl.connections {
		total += count
	}
	return total
}

// String returns a human-readable representation of the connection limiter state.
func (cl *ConnectionLimiter) String() string {
	cl.mu.RLock()
	defer cl.mu.RUnlock()

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("ConnectionLimiter(maxPerIP=%d, uniqueIPs=%d, totalConnections=%d)\n", 
		cl.maxPerIP, len(cl.connections), cl.GetTotalConnections()))
	
	for ip, count := range cl.connections {
		sb.WriteString(fmt.Sprintf("  %s: %d/%d\n", ip, count, cl.maxPerIP))
	}
	
	return sb.String()
}
