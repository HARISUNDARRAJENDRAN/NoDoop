# NoDoop

**NoDoop** is a polyglot microservice application that combines a highly available collaborative document
editor with distributed data storage to bridge the gap between real‑time synchronization and scalable
persistence.

## Key Features

- **Collaborative Editor** – A fault‑tolerant, real‑time document editor built for high availability.
- **Distributed Data Storage** – Seamlessly syncs edits while persisting data across services.

## DFS Part (Phase 1)

- `dfs/store.go`: content-addressed local storage (CAS path transform, read/write/delete).
- `dfs/crypto.go`: stream encryption/decryption (`AES-CTR`) for replication payloads.
- `dfs/p2p/*`: TCP transport, RPC framing, stream/message handling.
- `dfs/server.go`: distributed file server with peer bootstrap, `Store`, and `Get`.
- `cmd/dfsnode/main.go`: runnable node (single-node or 3-node demo).

Note: in this repository those files currently live under `distributed_filesys/` and
`distributed_filesys/peer2peer/`.

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

## Full Project (MERN + Custom DFS + MongoDB Atlas)

This repo now includes a full MVP for collaborative docs where:

- document payloads are stored in the custom DFS via a Go HTTP bridge,
- auth + metadata + indexing live in MongoDB Atlas,
- realtime editing is done via Socket.IO + Yjs.

### Added Components

- `cmd/dfsbridge/main.go`: DFS HTTP bridge (`/v1/blobs/:key`)
- `backend/`: Express + Socket.IO + MongoDB Atlas (auth, docs, versions, permissions)
- `frontend/`: React + Vite collaborative editor shell

### Architecture Split

- DFS object storage: version blobs and manifests
- MongoDB Atlas: users, sessions, documents, permissions, doc version metadata

## Local Run Guide

### 1) Start DFS Bridge

```bash
go run ./cmd/dfsbridge
```

Optional env vars:

- `DFS_BRIDGE_PORT` (default `9090`)
- `DFS_BRIDGE_ROOT` (default `dfs_bridge_data`)
- `DFS_BRIDGE_NODE_ID` (default `bridge-node`)

### 2) Start Backend

```bash
cd backend
npm install
cp .env.example .env
```

Set required values in `.env`:

- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

Run backend:

```bash
npm run dev
```

Backend default: `http://localhost:8080`

### 3) Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend default: `http://localhost:5173`

## Implemented APIs

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /docs`
- `GET /docs`
- `GET /docs/:id`
- `POST /docs/:id/save`
- `GET /docs/:id/versions`
- `POST /docs/:id/share`

## Realtime Events

- `doc:join` (request room + initial state)
- `doc:update` (Yjs update broadcast)

## Go Validation

```bash
go test ./... -count=1
```


