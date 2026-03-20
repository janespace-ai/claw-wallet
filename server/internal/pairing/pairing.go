package pairing

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"log"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/anthropic/claw-wallet-relay/internal/config"
	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"
)

const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

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

	cfg config.PairingConfig
}

type ipRate struct {
	count   int
	resetAt time.Time
}

func NewStore(cfg config.PairingConfig) *Store {
	s := &Store{
		codes:     make(map[string]*PairInfo),
		rateCount: make(map[string]*ipRate),
		cfg:       cfg,
	}
	go s.cleanup()
	return s
}

func (s *Store) codeTTL() time.Duration {
	return config.ParseDuration(s.cfg.CodeTTL, 10*time.Minute)
}

func (s *Store) cleanup() {
	interval := config.ParseDuration(s.cfg.CleanupInterval, 1*time.Minute)
	ticker := time.NewTicker(interval)
	ttl := s.codeTTL()
	for range ticker.C {
		s.mu.Lock()
		now := time.Now()
		for code, info := range s.codes {
			if now.Sub(info.CreatedAt) > ttl {
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
	return rate.count <= s.cfg.IPRateLimit
}

func (s *Store) generateCode() (string, error) {
	length := s.cfg.CodeLength
	if length <= 0 {
		length = 8
	}
	var sb strings.Builder
	for i := 0; i < length; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", err
		}
		sb.WriteByte(charset[n.Int64()])
	}
	return sb.String(), nil
}

func extractIP(c *app.RequestContext) string {
	if xff := c.GetHeader("X-Forwarded-For"); len(xff) > 0 {
		return strings.TrimSpace(strings.Split(string(xff), ",")[0])
	}
	if xri := c.GetHeader("X-Real-IP"); len(xri) > 0 {
		return string(xri)
	}
	host := c.RemoteAddr().String()
	for i := len(host) - 1; i >= 0; i-- {
		if host[i] == ':' {
			return host[:i]
		}
	}
	return host
}

func (s *Store) HandleCreate(_ context.Context, c *app.RequestContext) {
	ip := extractIP(c)
	if !s.checkIPRate(ip) {
		c.String(consts.StatusTooManyRequests, "rate limit exceeded")
		return
	}

	var req CreateRequest
	if err := c.BindJSON(&req); err != nil {
		c.String(consts.StatusBadRequest, "invalid JSON")
		return
	}

	if req.WalletAddr == "" || req.CommPubKey == "" {
		c.String(consts.StatusBadRequest, "walletAddr and commPubKey required")
		return
	}

	code, err := s.generateCode()
	if err != nil {
		log.Printf("code generation error: %v", err)
		c.String(consts.StatusInternalServerError, "internal error")
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
		ExpiresIn: int(s.codeTTL().Seconds()),
	}

	c.JSON(consts.StatusOK, resp)
}

func (s *Store) HandleResolve(_ context.Context, c *app.RequestContext) {
	code := strings.ToUpper(c.Param("code"))
	if code == "" {
		c.String(consts.StatusBadRequest, "missing short code")
		return
	}

	ttl := s.codeTTL()

	s.mu.RLock()
	info, ok := s.codes[code]
	s.mu.RUnlock()

	if !ok {
		c.String(consts.StatusNotFound, "not found or expired")
		return
	}

	if time.Since(info.CreatedAt) > ttl {
		s.mu.Lock()
		delete(s.codes, code)
		s.mu.Unlock()
		c.String(consts.StatusNotFound, "not found or expired")
		return
	}

	c.JSON(consts.StatusOK, map[string]string{
		"walletAddr": info.WalletAddr,
		"commPubKey": info.CommPubKey,
	})
}

// CreateForTest exposes store creation for testing without going through HTTP.
func (s *Store) CreateForTest(walletAddr, commPubKey, ip string) (string, error) {
	if !s.checkIPRate(ip) {
		return "", json.Unmarshal([]byte(`"rate limited"`), new(string))
	}

	code, err := s.generateCode()
	if err != nil {
		return "", err
	}

	s.mu.Lock()
	s.codes[code] = &PairInfo{
		WalletAddr: walletAddr,
		CommPubKey: commPubKey,
		CreatedAt:  time.Now(),
		CreatorIP:  ip,
	}
	s.mu.Unlock()

	return code, nil
}

// ResolveForTest exposes store resolution for testing without going through HTTP.
func (s *Store) ResolveForTest(code string) (*PairInfo, bool) {
	code = strings.ToUpper(code)
	ttl := s.codeTTL()

	s.mu.RLock()
	info, ok := s.codes[code]
	s.mu.RUnlock()

	if !ok {
		return nil, false
	}

	if time.Since(info.CreatedAt) > ttl {
		s.mu.Lock()
		delete(s.codes, code)
		s.mu.Unlock()
		return nil, false
	}

	return info, true
}
