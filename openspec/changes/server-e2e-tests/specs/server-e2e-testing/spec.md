## ADDED Requirements

### Requirement: Hub WebSocket connection test
The test suite SHALL verify that WebSocket clients can connect to the hub with a valid pairId.

#### Scenario: Successful WebSocket connection
- **WHEN** a client connects to `/ws?pairId=test-pair`
- **THEN** the connection SHALL be established and the client SHALL be able to send and receive messages

#### Scenario: Missing pairId rejected
- **WHEN** a client connects to `/ws` without a pairId query parameter
- **THEN** the server SHALL respond with HTTP 400 and reject the upgrade

### Requirement: Hub message relay test
The test suite SHALL verify that messages are correctly relayed between paired clients.

#### Scenario: Two clients exchange messages
- **WHEN** Client A and Client B connect with the same pairId, and Client A sends a message
- **THEN** Client B SHALL receive the message wrapped in an envelope with `sourceIP` and `data` fields

#### Scenario: Message not echoed to sender
- **WHEN** Client A sends a message
- **THEN** Client A SHALL NOT receive its own message back

### Requirement: Hub disconnect notification test
The test suite SHALL verify that disconnect notifications are sent to remaining peers.

#### Scenario: Peer receives disconnect notification
- **WHEN** Client A and Client B are connected with the same pairId, and Client A disconnects
- **THEN** Client B SHALL receive a `peer_disconnected` message with Client A's sourceIP

### Requirement: Hub pair capacity test
The test suite SHALL verify the 2-client-per-pair limit.

#### Scenario: Third client evicts oldest
- **WHEN** three clients connect with the same pairId
- **THEN** the first client's connection SHALL be closed, and the second and third clients SHALL remain connected

### Requirement: Hub message rate limit test
The test suite SHALL verify WebSocket message rate limiting at 100 messages per second.

#### Scenario: Messages beyond rate limit are dropped
- **WHEN** a client sends more than 100 messages within 1 second
- **THEN** excess messages SHALL NOT be relayed to the peer

### Requirement: CORS middleware test
The test suite SHALL verify that the CORS middleware sets correct headers.

#### Scenario: OPTIONS preflight returns 204
- **WHEN** a client sends an OPTIONS request
- **THEN** the response SHALL have status 204 and include `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, and `Access-Control-Allow-Headers` headers

#### Scenario: Regular request includes CORS headers
- **WHEN** a client sends a GET request
- **THEN** the response SHALL include `Access-Control-Allow-Origin: *` header

### Requirement: Access Log middleware test
The test suite SHALL verify that the Access Log middleware passes requests through to handlers.

#### Scenario: Request passes through middleware
- **WHEN** a request is processed with the Access Log middleware active
- **THEN** the downstream handler SHALL be called and return the expected response

### Requirement: IP extraction test
The test suite SHALL verify all IP extraction paths in the iputil package.

#### Scenario: X-Forwarded-For with multiple IPs
- **WHEN** a request contains `X-Forwarded-For: 10.0.0.1, 10.0.0.2`
- **THEN** ExtractIP SHALL return `10.0.0.1`

#### Scenario: X-Real-IP fallback
- **WHEN** a request has no X-Forwarded-For but has `X-Real-IP: 192.168.1.1`
- **THEN** ExtractIP SHALL return `192.168.1.1`

#### Scenario: RemoteAddr fallback with port stripping
- **WHEN** a request has no forwarding headers and RemoteAddr is `1.2.3.4:5678`
- **THEN** ExtractIP SHALL return `1.2.3.4`

#### Scenario: RemoteAddr without port
- **WHEN** RemoteAddr is `1.2.3.4` (no port)
- **THEN** ExtractIP SHALL return `1.2.3.4`

### Requirement: Pairing expired code test
The test suite SHALL verify that expired pairing codes are rejected.

#### Scenario: Expired code returns 404
- **WHEN** a pairing code's TTL has elapsed and a client resolves it
- **THEN** the server SHALL return HTTP 404

### Requirement: Pairing invalid JSON test
The test suite SHALL verify that malformed JSON is rejected.

#### Scenario: Malformed JSON body returns 400
- **WHEN** a client sends `{invalid` as the POST body to `/pair/create`
- **THEN** the server SHALL return HTTP 400

### Requirement: Pairing code case insensitivity test
The test suite SHALL verify that code resolution is case-insensitive.

#### Scenario: Lowercase code resolves successfully
- **WHEN** a code is created and the client resolves it using lowercase letters
- **THEN** the server SHALL return the pairing info successfully

### Requirement: Integration health endpoint test
The test suite SHALL verify the full server wiring through the health endpoint.

#### Scenario: Health endpoint returns ok
- **WHEN** the fully wired server receives `GET /health`
- **THEN** the response SHALL be HTTP 200 with body `{"status":"ok"}`
