package hub

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestConnectionLimiter_AllowConnection(t *testing.T) {
	limiter := NewConnectionLimiter(3) // Max 3 connections per IP

	ip := "192.168.1.100"

	// First 3 connections should be allowed
	for i := 0; i < 3; i++ {
		if !limiter.AllowConnection(ip) {
			t.Errorf("Connection %d should be allowed", i+1)
		}
	}

	// 4th connection should be rejected
	if limiter.AllowConnection(ip) {
		t.Error("4th connection should be rejected")
	}

	// Count should be at limit
	if count := limiter.GetConnectionCount(ip); count != 3 {
		t.Errorf("Expected count 3, got %d", count)
	}
}

func TestConnectionLimiter_ReleaseConnection(t *testing.T) {
	limiter := NewConnectionLimiter(2)
	ip := "192.168.1.101"

	// Use up the limit
	limiter.AllowConnection(ip)
	limiter.AllowConnection(ip)

	// Should be at limit
	if limiter.AllowConnection(ip) {
		t.Error("Should be at limit")
	}

	// Release one connection
	limiter.ReleaseConnection(ip)

	// Should now be able to connect again
	if !limiter.AllowConnection(ip) {
		t.Error("Should be able to connect after release")
	}

	// Count should be 2
	if count := limiter.GetConnectionCount(ip); count != 2 {
		t.Errorf("Expected count 2 after release and reconnect, got %d", count)
	}
}

func TestConnectionLimiter_MultipleIPs(t *testing.T) {
	limiter := NewConnectionLimiter(2)

	ip1 := "192.168.1.1"
	ip2 := "192.168.1.2"
	ip3 := "192.168.1.3"

	// Each IP should have independent limits
	limiter.AllowConnection(ip1)
	limiter.AllowConnection(ip1)
	limiter.AllowConnection(ip2)
	limiter.AllowConnection(ip2)
	limiter.AllowConnection(ip3)
	limiter.AllowConnection(ip3)

	// All should be at their limits
	if limiter.AllowConnection(ip1) {
		t.Error("IP1 should be at limit")
	}
	if limiter.AllowConnection(ip2) {
		t.Error("IP2 should be at limit")
	}
	if limiter.AllowConnection(ip3) {
		t.Error("IP3 should be at limit")
	}

	// Each IP should have count of 2
	if count := limiter.GetConnectionCount(ip1); count != 2 {
		t.Errorf("IP1 expected count 2, got %d", count)
	}
	if count := limiter.GetConnectionCount(ip2); count != 2 {
		t.Errorf("IP2 expected count 2, got %d", count)
	}
	if count := limiter.GetConnectionCount(ip3); count != 2 {
		t.Errorf("IP3 expected count 2, got %d", count)
	}

	// Total connections should be 6
	if total := limiter.GetTotalConnections(); total != 6 {
		t.Errorf("Expected total 6 connections, got %d", total)
	}
}

func TestConnectionLimiter_ReleaseToZero(t *testing.T) {
	limiter := NewConnectionLimiter(5)
	ip := "192.168.1.200"

	// Add 3 connections
	limiter.AllowConnection(ip)
	limiter.AllowConnection(ip)
	limiter.AllowConnection(ip)

	if count := limiter.GetConnectionCount(ip); count != 3 {
		t.Errorf("Expected count 3, got %d", count)
	}

	// Release all
	limiter.ReleaseConnection(ip)
	limiter.ReleaseConnection(ip)
	limiter.ReleaseConnection(ip)

	// Count should be 0 and IP should be removed from map
	if count := limiter.GetConnectionCount(ip); count != 0 {
		t.Errorf("Expected count 0 after releasing all, got %d", count)
	}

	// GetAllConnectionCounts should not include this IP
	allCounts := limiter.GetAllConnectionCounts()
	if _, exists := allCounts[ip]; exists {
		t.Error("IP should be removed from map after count reaches 0")
	}
}

func TestConnectionLimiter_GetAllConnectionCounts(t *testing.T) {
	limiter := NewConnectionLimiter(10)

	// Add connections from multiple IPs
	ips := []string{"10.0.0.1", "10.0.0.2", "10.0.0.3"}
	for i, ip := range ips {
		for j := 0; j < i+1; j++ {
			limiter.AllowConnection(ip)
		}
	}

	allCounts := limiter.GetAllConnectionCounts()

	if len(allCounts) != 3 {
		t.Errorf("Expected 3 IPs, got %d", len(allCounts))
	}

	if allCounts["10.0.0.1"] != 1 {
		t.Errorf("Expected IP1 count 1, got %d", allCounts["10.0.0.1"])
	}
	if allCounts["10.0.0.2"] != 2 {
		t.Errorf("Expected IP2 count 2, got %d", allCounts["10.0.0.2"])
	}
	if allCounts["10.0.0.3"] != 3 {
		t.Errorf("Expected IP3 count 3, got %d", allCounts["10.0.0.3"])
	}
}

func TestConnectionLimiter_DefaultLimit(t *testing.T) {
	// Test with invalid limit (should default to 10)
	limiter := NewConnectionLimiter(0)
	ip := "192.168.1.250"

	// Should allow up to 10 connections
	for i := 0; i < 10; i++ {
		if !limiter.AllowConnection(ip) {
			t.Errorf("Connection %d should be allowed (default limit 10)", i+1)
		}
	}

	// 11th connection should be rejected
	if limiter.AllowConnection(ip) {
		t.Error("11th connection should be rejected")
	}
}

func TestConnectionLimiter_ThreadSafety(t *testing.T) {
	limiter := NewConnectionLimiter(100)
	ip := "192.168.1.100"

	// Simulate concurrent connections
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			for j := 0; j < 10; j++ {
				limiter.AllowConnection(ip)
			}
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}

	// Should have exactly 100 connections (at the limit)
	count := limiter.GetConnectionCount(ip)
	if count != 100 {
		t.Errorf("Expected exactly 100 connections, got %d", count)
	}
}

func TestExtractIPFromRequest(t *testing.T) {
	tests := []struct {
		name           string
		headers        map[string]string
		remoteAddr     string
		expectedIP     string
	}{
		{
			name:       "X-Forwarded-For single IP",
			headers:    map[string]string{"X-Forwarded-For": "203.0.113.1"},
			remoteAddr: "10.0.0.1:1234",
			expectedIP: "203.0.113.1",
		},
		{
			name:       "X-Forwarded-For multiple IPs (use first)",
			headers:    map[string]string{"X-Forwarded-For": "203.0.113.1, 10.0.0.2, 10.0.0.3"},
			remoteAddr: "10.0.0.1:1234",
			expectedIP: "203.0.113.1",
		},
		{
			name:       "X-Real-IP",
			headers:    map[string]string{"X-Real-IP": "203.0.113.2"},
			remoteAddr: "10.0.0.1:1234",
			expectedIP: "203.0.113.2",
		},
		{
			name:       "Fallback to RemoteAddr",
			headers:    map[string]string{},
			remoteAddr: "203.0.113.3:5678",
			expectedIP: "203.0.113.3",
		},
		{
			name:       "X-Forwarded-For takes precedence",
			headers: map[string]string{
				"X-Forwarded-For": "203.0.113.4",
				"X-Real-IP":       "203.0.113.5",
			},
			remoteAddr: "10.0.0.1:1234",
			expectedIP: "203.0.113.4",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			req.RemoteAddr = tt.remoteAddr
			
			for key, value := range tt.headers {
				req.Header.Set(key, value)
			}

			ip := ExtractIPFromRequest(req)
			if ip != tt.expectedIP {
				t.Errorf("Expected IP %s, got %s", tt.expectedIP, ip)
			}
		})
	}
}

func TestConnectionLimiter_String(t *testing.T) {
	limiter := NewConnectionLimiter(5)
	
	limiter.AllowConnection("192.168.1.1")
	limiter.AllowConnection("192.168.1.1")
	limiter.AllowConnection("192.168.1.2")

	str := limiter.String()
	
	// Should contain basic info
	if str == "" {
		t.Error("String representation should not be empty")
	}

	// Just verify it doesn't panic and returns something
	t.Logf("ConnectionLimiter string: %s", str)
}
