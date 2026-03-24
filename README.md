# NoDoop

**NoDoop** is a Google Docs-style collaborative document editor built on the MERN stack with a custom Go-based distributed file system for fault-tolerant version storage.

## Features

- **Real-time Collaboration** - Multiple users edit simultaneously via Socket.IO + Yjs CRDT
- **Rich Text Editor** - TipTap-powered editor with headings, formatting, tables, images, lists, and more
- **Document Dashboard** - Search, template gallery, recent docs, rename/delete actions
- **Collaboration Presence** - See who is online in a document with avatar indicators
- **Comments & Threads** - Create, reply, and resolve comment threads in real-time
- **Sharing & Permissions** - Invite by email, role management (owner/editor/viewer), revoke access
- **Version History** - Browse saved versions with author/time/size, restore any version
- **Autosave** - Periodic autosave to DFS with manual checkpoint control
- **Distributed Storage** - Document payloads stored in custom Go DFS with encrypted peer replication
- **Auth & Sessions** - JWT access/refresh tokens with bcrypt password hashing

## Tech Stack

- **Frontend**: React 18, Vite, React Router, TipTap, Yjs, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO, Mongoose, Zod, JWT
- **Database**: MongoDB Atlas
- **Storage**: Custom Go DFS (content-addressed, AES-CTR encrypted replication)

## Project Structure

```text
backend/
  src/
    app.js                 # Express app setup with middleware
    server.js              # HTTP server + Socket.IO bootstrap
    config/env.js          # Environment configuration
    db/mongoose.js          # MongoDB connection
    lib/
      AppError.js          # Structured error classes
      schemas.js           # Zod validation schemas
      validate.js          # Validation helper
    middleware/
      auth.js              # JWT auth middleware
      require-doc-access.js # Role-based document access
      rate-limit.js        # Rate limiting (auth + API)
      request-id.js        # Correlation ID middleware
    models/
      User.js              # User model
      Session.js           # Refresh token sessions
      Document.js          # Document metadata
      DocVersion.js        # Version metadata (DFS pointers)
      Permission.js        # Document permissions
      Comment.js           # Comments with embedded replies
    routes/
      auth.js              # Register, login, refresh
      docs.js              # CRUD, search, share, invite, history, restore
      comments.js          # Comments, replies, resolve
    services/
      tokens.js            # JWT creation/verification
      dfs-client.js        # HTTP client for DFS bridge
      doc-storage.js       # Version persistence to DFS
      collab-room.js       # Yjs room state management
    sockets/
      collab.js            # Socket.IO event handling

frontend/
  src/
    main.jsx               # App entry with Router + AuthProvider
    App.jsx                # Route definitions
    context/AuthContext.jsx # Auth state + persistence
    lib/
      api.js               # REST API client
      socket.js            # Socket.IO client
      SocketIOProvider.js  # Yjs <-> Socket.IO bridge
    components/
      Navbar.jsx           # Top navigation bar
      Editor.jsx           # TipTap editor with Yjs collaboration
      EditorToolbar.jsx    # Rich text formatting toolbar
      PresenceAvatars.jsx  # Online collaborator avatars
      CommentsSidebar.jsx  # Comments panel
      ShareModal.jsx       # Share/invite modal
      VersionHistoryPanel.jsx # Version history modal
    pages/
      LoginPage.jsx        # Auth page (login/register)
      DashboardPage.jsx    # Document list, search, templates
      EditorPage.jsx       # Document editing workspace

distributed_filesys/       # Go DFS implementation
cmd/dfsbridge/             # DFS HTTP bridge
cmd/dfsnode/               # DFS node runner
```

## API Endpoints

### Auth
- `POST /auth/register` - Create account
- `POST /auth/login` - Sign in
- `POST /auth/refresh` - Refresh access token

### Documents
- `POST /docs` - Create document
- `GET /docs?q=` - List/search documents
- `GET /docs/:id` - Get document with latest version
- `PATCH /docs/:id` - Rename document
- `DELETE /docs/:id` - Delete document
- `POST /docs/:id/save` - Save version to DFS
- `GET /docs/:id/versions` - List versions
- `GET /docs/:id/history` - Enriched version history
- `POST /docs/:id/restore` - Restore a version
- `POST /docs/:id/share` - Share with userId
- `POST /docs/:id/invite` - Invite by email
- `GET /docs/:id/collaborators` - List collaborators
- `DELETE /docs/:id/collaborators/:userId` - Remove access

### Comments
- `GET /docs/:id/comments` - List comments
- `POST /docs/:id/comments` - Create comment
- `POST /docs/:id/comments/:commentId/replies` - Reply
- `POST /docs/:id/comments/:commentId/resolve` - Resolve

## Socket Events

- `doc:join` / `doc:update` - Yjs document sync
- `doc:presence:join` / `doc:presence:leave` - Presence
- `doc:cursor` / `doc:awareness` - Cursor tracking
- `doc:comment:create` / `doc:comment:reply` / `doc:comment:resolve` - Live comments

## Local Run Guide

### 1) Start DFS Bridge

```bash
go run ./cmd/dfsbridge
```

### 2) Start Backend

```bash
cd backend
npm install
cp .env.example .env   # Set MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
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
