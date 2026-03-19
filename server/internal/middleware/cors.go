package middleware

import (
	"context"
	"strings"

	"github.com/cloudwego/hertz/pkg/app"
)

func CORS() app.HandlerFunc {
	return func(ctx context.Context, c *app.RequestContext) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Header("Access-Control-Max-Age", "86400")

		if strings.EqualFold(string(c.Method()), "OPTIONS") {
			c.AbortWithStatus(204)
			return
		}

		c.Next(ctx)
	}
}
