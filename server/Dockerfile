FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go env -w GOPROXY=https://goproxy.cn,direct && go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /relay ./cmd/relay

FROM alpine:3.19
RUN apk --no-cache add ca-certificates && \
    adduser -D -u 1001 appuser

COPY --from=builder /relay /relay

USER appuser
EXPOSE 8080
ENV PORT=8080

ENTRYPOINT ["/relay"]
