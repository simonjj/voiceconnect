# Current Runtime Model: VoiceConnect

> **Source**: Code inspection of both repositories.
> **Confidence**: ✅ Verified · 🔶 Inferred · ❓ Unknown

---

## 1. Process Model

### Client-Side Processes ✅

```
┌─────────────────────────────────────────────────────────┐
│ Electron Main Process (main/index.js)                    │
│                                                          │
│  MemoryStore (EventEmitter)                              │
│   ├── user state, team state, conversations              │
│   ├── settings, hotkeys, volume                          │
│   └── broadcasts to all renderer windows via IPC         │
│                                                          │
│  Services:                                               │
│   ├── Auth (auth.js) — OAuth2 flow, keychain tokens      │
│   ├── AutoUpdater — S3-based Electron updates            │
│   ├── Tray — System tray icon + menu                     │
│   ├── Hotkeys — Global keyboard shortcuts                │
│   ├── PowerMonitor — Sleep/wake handling                 │
│   ├── Notifications — OS native notifications            │
│   └── IPC Handlers — 20+ registered channels             │
│                                                          │
│  Windows (12 BrowserWindow instances):                   │
│   ├── primary (main voice UI)                            │
│   ├── auth (login window)                                │
│   ├── knock (incoming call notification)                 │
│   ├── settings, teamSettings                             │
│   ├── welcome, onboarding, tutorial                      │
│   ├── notification, controls                             │
│   └── multiDevice (conflict resolution)                  │
└─────────────────────────────────────────────────────────┘
         │ IPC (contextBridge)
         ▼
┌─────────────────────────────────────────────────────────┐
│ Electron Renderer Process (per window)                   │
│                                                          │
│  React 17 App                                            │
│   ├── AppStateProvider (synced with main via IPC)        │
│   │   └── TeamServiceProvider (SSE EventSource)          │
│   │       └── ProfileProvider (user profile state)       │
│   │           └── Connect component tree                 │
│   │               ├── Me (own agent + controls)            │
│   │               └── Members → Member (peer agents)       │
│   │                   ├── usePeerConnection (WebRTC)     │
│   │                   ├── useInputStream (mic capture)   │
│   │                   └── <audio> (remote playback)      │
│   └── Preload scripts (security boundary)                │
└─────────────────────────────────────────────────────────┘
```

### Server-Side Processes ✅

```
┌─────────────────────────────────────────────────────────┐
│ Node.js Express Server (src/index.js, port 7000)         │
│                                                          │
│  Middleware Chain:                                        │
│   1. Helmet (security headers)                           │
│   2. Morgan (HTTP access logging → /logs/access.log)     │
│   3. CORS                                                │
│   4. body-parser (JSON)                                  │
│   5. Static assets (/assets)                             │
│   6. JWT auth (express-jwt + jwks-rsa)                   │
│   7. User middleware (resolve user from JWT)              │
│   8. Route handlers                                      │
│                                                          │
│  Persistent Connections:                                  │
│   ├── MongoDB (Mongoose, auto-reconnect)                 │
│   ├── Kafka Producer (GZIP, TEAM_SERVICE topic)          │
│   ├── Kafka Consumer (unique group ID per instance)      │
│   └── SSE Connections (in-memory Map per team)           │
│                                                          │
│  In-Memory State:                                        │
│   └── teams: Map<teamCode, Map<userId, SSE response>>   │
│       └── Heartbeat timers per user                      │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Startup Sequence

### Client Startup ✅

```
1. Electron app.on('ready')
2. Initialize MemoryStore with defaults
3. Register IPC handlers (20+ channels)
4. Register global hotkeys
5. Setup power monitor listeners
6. Setup auto-updater
7. Create tray icon
8. Check for saved tokens in keychain
   ├── Tokens found → refresh tokens → open primary window
   └── No tokens → open welcome/auth window
9. On auth success:
   a. Store tokens in keychain + memory
   b. Open primary window
   c. GET /profile?isLaunch=true → store user
   d. GET /team → store team members
   e. Connect SSE EventSource to /team-service
   f. Start heartbeat interval (10s)
   g. Initialize WebRTC peer connections for online members
```

### Server Startup ✅

```
1. Load Express app with middleware
2. Serve static assets
3. Connect to MongoDB (10 retries, 15s intervals)
4. Connect to Kafka (producer + consumer)
5. Subscribe consumer to TEAM_SERVICE topic
6. Consumer message handler → TeamService.broadcast()
7. Mount routes (JWT-protected)
8. Listen on port 7000
```

---

## 3. Connection Lifecycle

### SSE Connection ✅

```
Client                              Server
  │                                    │
  │  GET /team-service                 │
  │  Accept: text/event-stream         │
  │  Authorization: Bearer <JWT>       │
  │──────────────────────────────────→ │
  │                                    │ Register in teams Map
  │                                    │ Mark user online
  │                                    │ Produce toggle-member-online
  │  SSE: heartbeat (every 5s)         │
  │ ←────────────────────────────────  │
  │  SSE: events as they occur         │
  │ ←────────────────────────────────  │
  │                                    │
  │  Connection closed                 │
  │──────────────────────────────────→ │
  │                                    │ Remove from teams Map
  │                                    │ Mark user offline
  │                                    │ Produce toggle-member-online
```

### WebRTC Connection ✅

```
Client A                    Server                     Client B
   │                          │                            │
   │ POST /conversations      │                            │
   │ {targetUser: B}          │                            │
   │─────────────────────────→│                            │
   │                          │ Create conversation        │
   │                          │ Kafka: conversation-change │
   │                          │──────────────────────────→ │ SSE event
   │ ←────────────────────────│                            │
   │                          │                            │
   │ Create RTCPeerConnection │                            │ Create RTCPeerConnection
   │ createOffer()            │                            │
   │                          │                            │
   │ POST /team-service/.../  │                            │
   │  peer-signal {offer}     │                            │
   │─────────────────────────→│ Kafka → SSE               │
   │                          │──────────────────────────→ │
   │                          │                            │ setRemoteDescription(offer)
   │                          │                            │ createAnswer()
   │                          │     POST peer-signal       │
   │                          │ ←──────────────────────────│
   │ ←────────────────────────│ Kafka → SSE               │
   │ setRemoteDescription     │                            │
   │   (answer)               │                            │
   │                          │                            │
   │ ICE candidates ←───────→ │ (same SSE/Kafka relay) ←──→│ ICE candidates
   │                          │                            │
   │ ═══════════ P2P Audio Stream (DTLS-SRTP) ═══════════ │
   │                          │                            │
```

---

## 4. Data Flow Patterns

### Event Broadcasting ✅

```
Any mutation (e.g., door toggle)
    │
    ▼
Express route handler
    │ MongoDB update
    ▼
Kafka.produce({
    code: teamCode,
    event: 'door-state',
    data: { src: userId, ...payload }
})
    │
    ▼
TEAM_SERVICE topic
    │
    ▼
Kafka consumer (all server instances)
    │
    ▼
TeamService.broadcast({code, event, data})
    │
    ▼
For each SSE connection in teams[teamCode]:
    │ Skip if src === connection user (unless in allowedSelfEvents)
    ▼
res.write(`id:${id}\nevent:${event}\ndata:${JSON.stringify(data)}\n\n`)
    │
    ▼
Client EventSource fires event → React state update → UI re-render
```

### State Synchronization Model ✅

| Layer | Storage | Sync Mechanism | Latency |
|-------|---------|----------------|---------|
| MongoDB | Persistent | REST write → read | ~50ms |
| Kafka | Event log | Produce → consume | ~10-50ms |
| SSE | Push channel | Server write → client read | ~5-20ms |
| React Context | In-memory | Reducer dispatch | <1ms |
| MemoryStore (Electron) | In-memory | IPC broadcast | <1ms |

---

## 5. Failure Modes and Recovery

### Network Interruption 🔶

| Component | Failure | Recovery |
|-----------|---------|----------|
| SSE connection | Drops | EventSource auto-reconnects (browser built-in) |
| WebRTC audio | ICE fails | `restartIce()` on impolite peer |
| Heartbeat | Missed 4× | Server auto-logs-off user after 40s |
| MongoDB | Connection lost | 10 retries with 15s intervals |
| Kafka | Broker down | KafkaJS auto-reconnect |

### Multi-Device Conflict ✅

- User logs in on Device B while Device A is active
- Server detects different `machineID` on same user
- Produces `device-conflict` SSE event to Device A
- Client shows "logged in elsewhere" notification

---

## 6. Resource and Scaling Characteristics

### Server Resource Model ✅

- **SSE connections**: One persistent HTTP connection per online user per server instance
- **Kafka consumer groups**: Unique group ID per server instance → all instances receive all messages → all can broadcast
- **MongoDB connections**: Mongoose connection pool per instance
- **Memory**: `teams` Map holds all active SSE response objects in memory

### Scaling Limitations 🔶

| Concern | Current State | Notes |
|---------|---------------|-------|
| SSE connections per instance | Unbounded | No connection limit configured |
| Team broadcast | O(N) per team | Iterates all SSE connections in team |
| Kafka consumer model | Full fan-out | Every instance consumes every message |
| WebRTC | Peer-to-peer only | N users = N*(N-1)/2 connections for full mesh |
| State in memory | SSE Map | Lost on server restart |
| Heartbeat timers | In-memory setTimeout | Lost on server restart |

### Production Deployment ✅

- 3 app-server replicas behind Nginx
- Sticky sessions 🔶 likely needed for SSE (not confirmed)
- Docker Swarm orchestration
- No horizontal auto-scaling configured
