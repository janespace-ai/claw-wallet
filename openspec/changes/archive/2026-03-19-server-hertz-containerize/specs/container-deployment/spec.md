## ADDED Requirements

### Requirement: Container image build
The system SHALL provide a production-ready Docker image built via multi-stage build, producing a minimal statically-linked binary on an Alpine base.

#### Scenario: Multi-stage build produces minimal image
- **WHEN** the Dockerfile is built with `docker build`
- **THEN** the final image SHALL be based on Alpine, contain only the compiled binary and CA certificates, and run as a non-root user

#### Scenario: Build argument controls Go version
- **WHEN** the Dockerfile is built without overriding build args
- **THEN** the builder stage SHALL use `golang:1.22-alpine` as the base image

### Requirement: Docker Compose orchestration
The system SHALL provide a `docker-compose.yml` for local development and production-like deployment.

#### Scenario: Single command startup
- **WHEN** the user runs `docker compose up`
- **THEN** the relay server SHALL start and be accessible on the configured port

#### Scenario: Environment variable configuration
- **WHEN** environment variables (`PORT`) are set in `docker-compose.yml` or `.env`
- **THEN** the relay server SHALL use those values for its configuration

#### Scenario: Health check integration
- **WHEN** the container is running
- **THEN** Docker SHALL perform periodic health checks via `GET /health` and report the container as healthy when the endpoint returns HTTP 200

### Requirement: Graceful shutdown in container
The relay server SHALL handle SIGTERM signals and shut down gracefully within a configurable timeout.

#### Scenario: Container stop signal
- **WHEN** Docker sends SIGTERM to the relay process (e.g., `docker compose down`)
- **THEN** the server SHALL stop accepting new connections, wait for in-flight requests and active WebSocket connections to complete (up to 10 seconds), and then exit cleanly with code 0

#### Scenario: Forced shutdown on timeout
- **WHEN** the graceful shutdown timeout expires with connections still active
- **THEN** the server SHALL forcefully close remaining connections and exit

### Requirement: Non-root container execution
The relay container SHALL run as a non-root user for security hardening.

#### Scenario: Process runs as non-root
- **WHEN** the container starts
- **THEN** the relay process SHALL run with a non-root UID (e.g., UID 1001)

### Requirement: Docker build context optimization
The project SHALL include a `.dockerignore` file to exclude unnecessary files from the Docker build context.

#### Scenario: Build context excludes non-essential files
- **WHEN** `docker build` is executed
- **THEN** files matching `.git`, `node_modules`, `docs`, `openspec`, and other non-server directories SHALL be excluded from the build context
