package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"golang.org/x/time/rate"
)

type ipLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type RateLimiter struct {
	mu       sync.RWMutex
	limiters map[string]*ipLimiter
	r        rate.Limit
	b        int
}

func NewRateLimiter(requestsPerSecond float64, burst int) *RateLimiter {
	rl := &RateLimiter{
		limiters: make(map[string]*ipLimiter),
		r:        rate.Limit(requestsPerSecond),
		b:        burst,
	}
	// Clean up stale entries every minute
	go func() {
		for range time.Tick(time.Minute) {
			rl.cleanup()
		}
	}()
	return rl
}

func (rl *RateLimiter) getLimiter(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	if entry, ok := rl.limiters[ip]; ok {
		entry.lastSeen = time.Now()
		return entry.limiter
	}

	l := rate.NewLimiter(rl.r, rl.b)
	rl.limiters[ip] = &ipLimiter{limiter: l, lastSeen: time.Now()}
	return l
}

func (rl *RateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	threshold := time.Now().Add(-5 * time.Minute)
	for ip, entry := range rl.limiters {
		if entry.lastSeen.Before(threshold) {
			delete(rl.limiters, ip)
		}
	}
}

// Middleware returns an Echo middleware that enforces the rate limit per client IP.
func (rl *RateLimiter) Middleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			ip := c.RealIP()
			if !rl.getLimiter(ip).Allow() {
				return echo.NewHTTPError(http.StatusTooManyRequests, map[string]string{
					"error":   "rate_limit_exceeded",
					"message": "Too many requests. Please try again later.",
				})
			}
			return next(c)
		}
	}
}
