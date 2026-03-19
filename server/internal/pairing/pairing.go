package pairing

import (
	"crypto/rand"
	"encoding/json"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	codeLength = 8
	codeTTL    = 10 * time.Minute
	charset    = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O/1/I ambiguity
)

type PairInfo struct {
	WalletAddr string `json:"walletAddr"`
	CommPubKey string `json:"commPubKey"`
	CreatedAt  time.Time
	CreatorIP  string
}

type CreateRequest struct {
	WalletAddr string `json:"walletAddr"`
	CommPubKey string `json:"commPubKey"`
}

type CreateResponse struct {
	ShortCode string `json:"shortCode"`
	ExpiresIn int    `json:"expiresIn"`
}

type Store struct {
	mu    sync.RWMutex
	codes map[string]*PairInfo

	rateMu    sync.Mutex
	rateCount map[string]*ipRate
}

type ipRate struct {
	count   int
	resetAt time.Time
}

func NewStore() *Store {
	s := &Store{
		codes:     make(map[string]*PairInfo),
		rateCount: make(map[string]*ipRate),
	}
	go s.cleanup()
	return s
}

func (s *Store) cleanup() {
	ticker := time.NewTicker(1 * time.Minute)
	for range ticker.C {
		s.mu.Lock()
		now := time.Now()
		for code, info := range s.codes {
			if now.Sub(info.CreatedAt) > codeTTL {
				delete(s.codes, code)
			}
		}
		s.mu.Unlock()
	}
}

func (s *Store) checkIPRate(ip string) bool {
	s.rateMu.Lock()
	defer s.rateMu.Unlock()

	now := time.Now()
	rate, ok := s.rateCount[ip]
	if !ok || now.After(rate.resetAt) {
		s.rateCount[ip] = &ipRate{count: 1, resetAt: now.Add(1 * time.Minute)}
		return true
	}
	rate.count++
	return rate.count <= 10
}

func generateCode() (string, error) {
	var sb strings.Builder
	for i := 0; i < codeLength; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", err
		}
		sb.WriteByte(charset[n.Int64()])
	}
	return sb.String(), nil
}

func (s *Store) HandleCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ip := extractIP(r)
	if !s.checkIPRate(ip) {
		http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
		return
	}

	var req CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if req.WalletAddr == "" || req.CommPubKey == "" {
		http.Error(w, "walletAddr and commPubKey required", http.StatusBadRequest)
		return
	}

	code, err := generateCode()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	s.mu.Lock()
	s.codes[code] = &PairInfo{
		WalletAddr: req.WalletAddr,
		CommPubKey: req.CommPubKey,
		CreatedAt:  time.Now(),
		CreatorIP:  ip,
	}
	s.mu.Unlock()

	resp := CreateResponse{
		ShortCode: code,
		ExpiresIn: int(codeTTL.Seconds()),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Store) HandleResolve(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	path := r.URL.Path
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) < 2 {
		http.Error(w, "missing short code", http.StatusBadRequest)
		return
	}
	code := strings.ToUpper(parts[len(parts)-1])

	s.mu.RLock()
	info, ok := s.codes[code]
	s.mu.RUnlock()

	if !ok {
		http.Error(w, "not found or expired", http.StatusNotFound)
		return
	}

	if time.Since(info.CreatedAt) > codeTTL {
		s.mu.Lock()
		delete(s.codes, code)
		s.mu.Unlock()
		http.Error(w, "not found or expired", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"walletAddr": info.WalletAddr,
		"commPubKey": info.CommPubKey,
	})
}

func extractIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return strings.TrimSpace(strings.Split(xff, ",")[0])
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
