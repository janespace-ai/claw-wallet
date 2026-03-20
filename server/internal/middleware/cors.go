package middleware

import (
	"context"
	"strings"

	"github.com/cloudwego/hertz/pkg/app"
)

// CORS returns a middleware that sets CORS headers based on the given allowed origins.
func CORS(allowedOrigins []string) app.HandlerFunc {
	origin := "*"
	if len(allowedOrigins) > 0 {
		origin = strings.Join(allowedOrigins, ", ")
	}

	return func(ctx context.Context, c *app.RequestContext) {
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Header("Access-Control-Max-Age", "86400")

		if strings.EqualFold(string(c.Method()), "OPTIONS") {
			c.AbortWithStatus(204)
			return
		}

		c.Next(ctx)
	}
}
