# NoDoop

**NoDoop** is a polyglot microservice application that combines a highly available collaborative document
editor with distributed data storage to bridge the gap between real‑time synchronization and scalable
persistence.

## Key Features

- **Collaborative Editor** – A fault‑tolerant, real‑time document editor built for high availability.
- **Distributed Data Storage** – Seamlessly syncs edits while persisting data across services.

## DFS Part (Phase 1)

The DFS foundation is now implemented from scratch in Go (inspired by
`anthdm/distributedfilesystemgo` architecture):

- `dfs/store.go`: content-addressed local storage (CAS path transform, read/write/delete).
- `dfs/crypto.go`: stream encryption/decryption (`AES-CTR`) for replication payloads.
- `dfs/p2p/*`: TCP transport, RPC framing, stream/message handling.
- `dfs/server.go`: distributed file server with peer bootstrap, `Store`, and `Get`.
- `cmd/dfsnode/main.go`: runnable node (single-node or 3-node demo).

## Project Structure

```text
cmd/dfsnode/main.go
dfs/
	crypto.go
	messages.go
	server.go
	store.go
	store_test.go
	p2p/
		encoding.go
		handshake.go
		message.go
		tcp_transport.go
		tcp_transport_test.go
```

## Run

```bash
go test ./...
go run ./cmd/dfsnode -mode demo3
```

Single-node mode:

```bash
go run ./cmd/dfsnode -mode single -listen :3000
```

Join an existing node:

```bash
go run ./cmd/dfsnode -mode single -listen :3001 -bootstrap :3000
```


