package middleware

import (
	"context"
	"log"
	"time"

	"github.com/cloudwego/hertz/pkg/app"
)

func AccessLog() app.HandlerFunc {
	return func(ctx context.Context, c *app.RequestContext) {
		start := time.Now()
		c.Next(ctx)
		latency := time.Since(start)
		log.Printf("%s %s %d %v",
			string(c.Method()),
			string(c.Request.URI().Path()),
			c.Response.StatusCode(),
			latency,
		)
	}
}
