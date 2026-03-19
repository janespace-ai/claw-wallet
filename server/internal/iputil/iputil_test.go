package iputil

import (
	"net/http"
	"testing"
)

func TestExtractIPXForwardedForMultiple(t *testing.T) {
	r := &http.Request{Header: http.Header{}}
	r.Header.Set("X-Forwarded-For", "10.0.0.1, 10.0.0.2, 10.0.0.3")
	r.RemoteAddr = "192.168.1.1:5555"

	ip := ExtractIP(r)
	if ip != "10.0.0.1" {
		t.Fatalf("expected 10.0.0.1, got %s", ip)
	}
}

func TestExtractIPXForwardedForSingle(t *testing.T) {
	r := &http.Request{Header: http.Header{}}
	r.Header.Set("X-Forwarded-For", "10.0.0.1")
	r.RemoteAddr = "192.168.1.1:5555"

	ip := ExtractIP(r)
	if ip != "10.0.0.1" {
		t.Fatalf("expected 10.0.0.1, got %s", ip)
	}
}

func TestExtractIPXRealIP(t *testing.T) {
	r := &http.Request{Header: http.Header{}}
	r.Header.Set("X-Real-IP", "192.168.1.1")
	r.RemoteAddr = "127.0.0.1:8080"

	ip := ExtractIP(r)
	if ip != "192.168.1.1" {
		t.Fatalf("expected 192.168.1.1, got %s", ip)
	}
}

func TestExtractIPRemoteAddrWithPort(t *testing.T) {
	r := &http.Request{Header: http.Header{}}
	r.RemoteAddr = "1.2.3.4:5678"

	ip := ExtractIP(r)
	if ip != "1.2.3.4" {
		t.Fatalf("expected 1.2.3.4, got %s", ip)
	}
}

func TestExtractIPRemoteAddrWithoutPort(t *testing.T) {
	r := &http.Request{Header: http.Header{}}
	r.RemoteAddr = "1.2.3.4"

	ip := ExtractIP(r)
	if ip != "1.2.3.4" {
		t.Fatalf("expected 1.2.3.4, got %s", ip)
	}
}

func TestExtractIPPriority(t *testing.T) {
	r := &http.Request{Header: http.Header{}}
	r.Header.Set("X-Forwarded-For", "10.0.0.1")
	r.Header.Set("X-Real-IP", "172.16.0.1")
	r.RemoteAddr = "192.168.1.1:8080"

	ip := ExtractIP(r)
	if ip != "10.0.0.1" {
		t.Fatalf("X-Forwarded-For should take priority, expected 10.0.0.1, got %s", ip)
	}
}
