# 01 — Current System Map: VoiceConnect

> **Status**: Discovery complete — based on code inspection of both repositories.
> **Confidence key**: ✅ Verified (code evidence) · 🔶 Inferred (reasonable deduction) · ❓ Unknown

---

## 1. What the Application Is Today

**Product name**: VoiceConnect (branded "Connect")
**Product type**: Realtime, voice-first team collaboration desktop app
**Paradigm**: Always-on audio presence — team members appear as colored agents; clicking an agent initiates a voice connection. Presence is modeled as a "door open/closed" metaphor.

| Dimension | Value |
|-----------|-------|
| Client platform | Electron 16 (Chromium) desktop app — macOS, Windows, Linux ✅ |
| Client framework | React 17, Material-UI 4, Webpack 5, Babel 7 ✅ |
| Server runtime | Node.js (LTS) + Express 4.17 ✅ |
| Database | MongoDB via Mongoose 5.9 ✅ |
| Message bus | Apache Kafka (kafkajs 1.12), single topic `TEAM_SERVICE` ✅ |
| Realtime push | Server-Sent Events (SSE), **not** WebSocket/Socket.io ✅ |
| Audio transport | WebRTC peer-to-peer (RTCPeerConnection, native browser API) ✅ |
| Signaling | SDP + ICE candidates relayed via SSE → Kafka → SSE ✅ |
| Auth | Auth0 (OAuth2 PKCE + JWKS RS256), tokens stored in OS keychain via Keytar ✅ |
| Speech/ML | TensorFlow.js speech-commands for custom wake-word training ✅ |
| Infrastructure | Docker Compose (dev), Docker Swarm on AWS EC2 (prod), Nginx TLS proxy, Bitbucket Pipelines CI/CD ✅ |

---

## 2. Repository Structure

### Client Repository (`@touchto/connect` v5.0.3)

```
client-work/
├── main/                      # Electron main process
│   ├── index.js               # App lifecycle, IPC, tray, hotkeys, auto-update
│   ├── config/default.js      # Peer config (STUN/TURN), API URLs, Auth0 config
│   ├── lib/
│   │   ├── auth.js            # Auth0 token exchange, refresh, keychain storage
│   │   ├── MemoryStore.js     # In-process state store (EventEmitter-based)
│   │   ├── doorFunctions.js   # Door open/close logic
│   │   ├── hotkeys.js         # Global keyboard shortcuts
│   │   ├── Notifications.js   # OS notification handling
│   │   ├── settingsStore.js   # Persistent user settings
│   │   ├── store.js           # LocalStorage wrapper
│   │   ├── userMedia.js       # Media device enumeration
│   │   └── ipcHandlers/       # 3 handler modules
│   ├── windows/               # 12 Electron window definitions
│   └── plugins/tray/          # System tray integration
│
├── renderer/                  # React renderer process
│   ├── entries/               # 9 webpack entry points (primary, welcome, onboarding, settings, etc.)
│   ├── components/            # 22 component groups
│   │   ├── Connect/           # Main voice UI container
│   │   ├── Me/                # Current user agent + controls
│   │   ├── Member/            # Peer agent + WebRTC audio playback
│   │   ├── Members/           # Team roster grid
│   │   ├── Knock/             # Incoming call notification
│   │   ├── VoiceTraining/     # TensorFlow speech command training
│   │   ├── VoiceConnectControls/       # Volume + conversation controls
│   │   └── ...
│   ├── contexts/              # 3 React Context providers
│   │   ├── AppStateContext/   # Global app state (IPC-synced)
│   │   ├── ProfileContext/    # Current user profile
│   │   └── TeamServiceContext/# Team + SSE realtime events
│   ├── hooks/                 # 15 custom hooks
│   │   ├── useInputStream.js  # Mic capture + mute logic
│   │   ├── usePeerConnection.js # WebRTC peer management
│   │   ├── useRTC.js          # Alternate WebRTC impl
│   │   ├── useConversations.js# Conversation CRUD
│   │   ├── useProfile.js      # Profile + door/mute toggles
│   │   └── ...
│   ├── lib/                   # Renderer utilities (EventSource, IPC bridge, device checks)
│   ├── preload/               # Electron preload security scripts
│   └── webpack/               # 3 webpack configs (common, dev, prod)
│
├── shared/constants/          # IPC channels, hotkey commands, onboarding states
├── scripts/notarize.js        # macOS code-signing
├── package.json               # 11 deps + 63 devDeps, Yarn 3
└── .env                       # NODE_CONFIG_DIR, app key, Auth0 vars
```

### Server Repository (`@touchto/connect-server` v1.0.0-0)

```
server-work/
├── src/
│   ├── index.js               # Express app entry (port 7000)
│   ├── lib/
│   │   ├── database.js        # Mongoose connection (10 retries)
│   │   ├── kafka.js           # KafkaJS producer + consumer
│   │   ├── jwtAuth.js         # Auth0 JWT validation middleware
│   │   ├── userMiddleware.js  # User resolution + Kafka event production
│   │   ├── TeamService.js     # SSE broadcast + Kafka consumer routing
│   │   ├── Knock.js           # Knock request logic (8s TTL)
│   │   ├── mute.js            # Mute/unmute operations
│   │   ├── error.js           # Winston error logging
│   │   └── ...
│   ├── models/                # 5 Mongoose schemas
│   │   ├── User.js            # email, doorOpen, online, muted, team ref, machineID
│   │   ├── Team.js            # name, code, members[], owner, admins[]
│   │   ├── Conversation.js    # members[], private, isBroadcast
│   │   ├── Knock.js           # 10s TTL auto-delete
│   │   └── Invitation.js      # email-based team invites
│   └── routes/
│       ├── users/             # Profile, presence, door, mute, search
│       ├── team/              # Team CRUD, membership, admin
│       ├── team-service/      # SSE stream + Kafka broadcast bridge
│       ├── conversations/     # Create, leave, knock, disconnect
│       ├── invitations/       # Create, accept invitations
│       ├── heartbeat/         # 10s keepalive, 40s auto-logoff
│       └── assets.js          # Static file serving
│
├── config/default.js          # DB, Kafka, Auth0, heartbeat config
├── connectors/                # Empty (Kafka S3 sink configured externally)
├── scripts/
│   ├── kafka.sh               # Kafka topic initialization
│   └── server.sh              # AWS EC2 deployment (Docker Swarm)
├── docker-compose.yml         # 7 services: proxy, app-server, mongo, zookeeper, kafka, kafka-connect, ksqldb
├── docker-compose.development.yml
├── docker-compose.production.yml  # 3 app replicas, Swarm mode
└── package.json               # 17 deps + 3 devDeps
```

---

## 3. How Client and Server Interact

### Communication Channels

```
┌──────────────────────┐                    ┌──────────────────────┐
│    Electron Client    │                    │    Express Server     │
│                       │                    │    (port 7000)        │
│  ┌─────────────────┐  │   HTTPS REST       │  ┌────────────────┐  │
│  │ API requests     │──┼──────────────────→ │  │ routes/*       │  │
│  │ (superagent)     │  │  Bearer JWT        │  │ (Express)      │  │
│  └─────────────────┘  │                    │  └────────────────┘  │
│                       │                    │          │           │
│  ┌─────────────────┐  │   SSE (EventSource)│  ┌──────▼─────────┐  │
│  │ TeamService     │←─┼──────────────────── │  │ TeamService.js │  │
│  │ Context         │  │   text/event-stream │  │ (SSE + Kafka)  │  │
│  └─────────────────┘  │                    │  └────────────────┘  │
│                       │                    │          │           │
│  ┌─────────────────┐  │                    │  ┌──────▼─────────┐  │
│  │ WebRTC P2P      │──┼── SDP/ICE via SSE──┼→ │ Kafka topic    │  │
│  │ RTCPeerConn     │  │   (peer-signal)    │  │ TEAM_SERVICE   │  │
│  └─────────────────┘  │                    │  └────────────────┘  │
│          │            │                    │                      │
│          │ Direct P2P │                    │  ┌────────────────┐  │
│          └────────────┼─── Audio Stream ──→│  │ MongoDB        │  │
│                       │   (STUN/TURN)      │  │ (persist state)│  │
│                       │                    │  └────────────────┘  │
└──────────────────────┘                    └──────────────────────┘
```

### Request Flow Summary

1. **REST API** — All CRUD operations (profile, team, conversations, invitations, heartbeat) go over HTTPS with Bearer JWT auth. ✅
2. **SSE (Server-Sent Events)** — Persistent one-way push channel. Server broadcasts events through Kafka → TeamService.js → SSE response objects. Client connects to `GET /team-service`. ✅
3. **WebRTC Signaling** — SDP offers/answers and ICE candidates are sent as `peer-signal` events via `POST /team-service/:code/:event` → Kafka → SSE → peer client. **No dedicated signaling server.** ✅
4. **WebRTC Audio** — Once ICE completes, audio streams flow directly peer-to-peer via STUN (stun.touchto.io) / TURN (turn.touchto.io). Server is **not** in the media path. ✅
5. **Heartbeat** — Client polls `GET /heartbeat` every 10s. Server auto-logs-off after 4 missed beats (40s). ✅

---

## 4. How Audio Works

### Audio Capture Path ✅

```
Microphone → navigator.mediaDevices.getUserMedia({audio: deviceId})
          → MediaStream with audio track(s)
          → track.enabled = shouldSendAudio()
          → RTCPeerConnection.addTrack(track, stream)
          → WebRTC encoding (Opus codec, browser-native)
          → DTLS-SRTP encrypted → network
```

**Key file**: `renderer/hooks/useInputStream.js`

**Mute logic** (`shouldSendAudio()`):
- If globally muted → false
- If not in any conversation → false
- If in same conversation as peer → true
- If in private conversation without peer → false
- If door open (and in non-private conversation) → true (ambient audio to team)
- If door closed → false

### Audio Playback Path ✅

```
Network → RTCPeerConnection.ontrack event
       → track.onunmute → audioRef.srcObject = stream
       → <audio autoPlay> element per Member component
       → audioRef.setSinkId(preferredOutput)
       → Per-member volume: memberVolumeSettings
       → Background conversation: reduced volume (BG_CONVERSATION_MAX)
       → AudioContext → AnalyserNode → amplitude visualization (agent glow)
```

**Key file**: `renderer/components/Member/index.js`

### WebRTC Connection Setup ✅

1. Both peers create `RTCPeerConnection` with STUN/TURN config
2. **Polite/impolite** collision avoidance (RFC 8829 "perfect negotiation")
3. Negotiation needed → create offer → send via `peer-signal` SSE event
4. Peer receives offer → set remote description → create answer → send back
5. ICE candidates exchanged via same `peer-signal` mechanism
6. ICE failure → `restartIce()` (impolite peer only)
7. Connection state monitored; peer auto-closes on disconnect

**STUN/TURN config** (hardcoded in client):
```javascript
iceServers: [
    { urls: ['stun:stun.touchto.io'] },
    { urls: ['turn:turn.touchto.io'], username: 'testy', credential: 'man2020' }
]
```

### Speech Command ML ✅

- TensorFlow.js `@tensorflow-models/speech-commands` with browser FFT
- Transfer learning on base model: user trains custom words
- Commands: "Connect With [name]", "Close Connection [name]", plus background noise
- 200 training epochs, 95% probability threshold
- Training data serialized to disk via IPC
- Detection triggers `START_CONVERSATION_EVENT` or `END_CONVERSATION_EVENT` IPC

---

## 5. How Presence Works

### Presence State Model ✅

| Property | Type | Meaning |
|----------|------|---------|
| `online` | Boolean | User has active SSE connection and heartbeat |
| `doorOpen` | Boolean | User available for conversations ("door open") |
| `muted` | Boolean | User's mic is disabled |
| `isKnockRequired` | Boolean | Callers must knock before connecting |
| `defaultDoor` | Boolean | Remembered door preference on login |

### Presence Update Flow ✅

```
User action → API call → MongoDB update → Kafka produce → SSE broadcast → all team clients update
```

Events: `door-state`, `muted-state`, `toggle-member-online`, `user-offline`, `user-authenticate`

### Heartbeat ✅

- Client: `GET /heartbeat` every 10 seconds
- Server: resets 40-second timeout per user
- Timeout → auto-offline: set `online: false`, produce `user-offline` event
- SSE disconnect also triggers offline handling

---

## 6. Conversation/Session Model

### Conversation Types ✅

| Type | Members | Behavior |
|------|---------|----------|
| **Direct (1:1)** | 2 users | Bidirectional audio |
| **Broadcast** | 1 speaker + N listeners | One-to-many, others can join to make it bidirectional |
| **Private** | Any | Only members can hear; team sees but can't join |

### Conversation Lifecycle ✅

```
Initiate → Check doorOpen/knockRequired → [Knock if needed] →
Create Conversation (DB) → Unmute both → Broadcast conversation-change →
Both peers see each other in conversation → WebRTC connects →
Audio flows → Leave → Remove from conversation → Cleanup empty conversations
```

### Knock System ✅

- If target has `doorOpen: false` or `isKnockRequired: true`
- Knock record created in MongoDB with **8-second TTL** (10s index)
- SSE events: `member-knock-start` / `user-knock-start`
- Resolution: `knock-accepted` (creates conversation) or `knock-declined` or `knock-expired`

---

## 7. Infrastructure and Services

### Docker Compose Services (7) ✅

| Service | Image | Role |
|---------|-------|------|
| proxy | `nginx/proxy` (custom) | HTTPS TLS termination, Let's Encrypt |
| app-server | `touchto/connect` | Express API + SSE + Kafka consumer |
| mongo | `mongo:latest` | Primary datastore |
| zookeeper | `bitnami/zookeeper` | Kafka coordination |
| kafka | `bitnami/kafka` | Event streaming (single topic) |
| kafka-connect | `confluentinc/cp-kafka-connect-base` | S3 sink connector for event archival |
| ksqldb | `confluentinc/ksqldb-server` | SQL stream processing (🔶 usage unclear) |

### Production Deployment ✅

- Docker Swarm on AWS EC2
- 3 app-server replicas (1 per node)
- 3 Kafka brokers (replicated)
- 1 MongoDB, 1 Zookeeper
- CI/CD: Bitbucket Pipelines → ECR → Docker Swarm deploy
- Auto-update: Electron auto-updater via S3 (`connect-archive` bucket)

---

## 8. Reality Check: Code vs Deck

### Implemented and Functional ✅

- Peer-to-peer WebRTC audio via RTCPeerConnection
- SSE-based realtime event streaming
- Kafka single-topic event bus (`TEAM_SERVICE`)
- Auth0 OAuth2 + JWT authentication
- Door open/closed presence metaphor
- Knock-to-connect interaction model
- Per-member and per-conversation volume control
- Speech command training (TensorFlow.js transfer learning)
- Audio amplitude visualization (agent glow)
- Multi-device conflict detection
- Broadcast (one-to-many) conversations
- Team CRUD with owner/admin/member roles
- Heartbeat-based auto-logoff

### Deck-Mentioned but Uncertain 🔶

- **Python services** — No Python code found in either repo. Server is pure Node.js.
- **Terraform** — No Terraform files. Deployment is Docker Swarm + shell scripts.
- **ksqldb** — Service exists in Docker Compose but no code references it.
- **Kafka Connect S3 sink** — Config template in notes/ but connector directory is empty.

### Dead Code / Stubs / TODO Areas 🔶

- `useRTC.js` — Appears to be an older/alternate WebRTC implementation alongside `usePeerConnection.js`
- `VoiceTraining` — Present but unclear if actively used in production flow or just a settings feature
- `WordCollector` — Training data collection component, may be experimental
- Multiple `@touchto/` private npm packages referenced but registry (`npm.touchto.io`) likely offline

### Missing for Local Development ❓

- Private npm registry `@touchto:registry=https://npm.touchto.io` — likely unavailable
- Auth0 tenant configuration (client ID, domain)
- STUN/TURN servers (stun.touchto.io, turn.touchto.io)
- SSL certificates for Nginx proxy
- AWS credentials for S3/ECR

---

## 9. Architectural Planes

### Media Plane ✅
- **Transport**: WebRTC (RTCPeerConnection) — peer-to-peer, encrypted (DTLS-SRTP)
- **Codec**: Browser-native (Opus for audio)
- **Path**: Client mic → WebRTC → network → peer client speaker
- **Server role**: None (server is not in the media path)
- **STUN/TURN**: External servers (stun.touchto.io / turn.touchto.io)

### Signaling/Control Plane ✅
- **Transport**: SSE (EventSource) for server→client; REST (superagent) for client→server
- **Relay**: Client → REST POST → Kafka → SSE → peer client
- **Messages**: SDP offers/answers, ICE candidates, knock events, conversation changes
- **Kafka topic**: Single `TEAM_SERVICE` topic for all events

### Auth/Identity Plane ✅
- **Provider**: Auth0 (OAuth2 PKCE)
- **Tokens**: JWT (RS256), refresh tokens in OS keychain
- **Server validation**: express-jwt + jwks-rsa middleware
- **User identity**: Email-based (Auth0 profile), MongoDB User model

### Presence/State Plane ✅
- **Model**: online, doorOpen, muted, isKnockRequired
- **Storage**: MongoDB (persistent), MemoryStore (client in-memory)
- **Sync**: REST mutations → Kafka produce → SSE broadcast
- **Timeout**: Heartbeat every 10s, auto-logoff after 40s

### Persistence/Eventing Plane ✅
- **Database**: MongoDB (`connect` database) — 5 collections
- **Event bus**: Kafka (single topic `TEAM_SERVICE`, GZIP compressed)
- **Archival**: Kafka Connect S3 sink (configured but 🔶 possibly inactive)
- **Client storage**: Electron LocalStorage, OS keychain, settings store

### Deployment/Infrastructure Plane ✅
- **Dev**: Docker Compose (7 services)
- **Prod**: Docker Swarm on AWS EC2 (3 app replicas)
- **CI/CD**: Bitbucket Pipelines → AWS ECR → Docker Swarm deploy
- **TLS**: Nginx proxy with Let's Encrypt
- **Distribution**: Electron auto-updater via S3
