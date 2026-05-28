# Interface Catalog: VoiceConnect

> **Source**: Code inspection of client-work and server-work repositories.
> **Confidence**: ✅ Verified · 🔶 Inferred · ❓ Unknown

---

## 1. REST API Endpoints

All endpoints require `Authorization: Bearer <JWT>` header unless noted.
Common headers: `x-machine-id`, `x-application-version`.

### Users (`/`)

| Method | Route | Handler | Purpose | Notes |
|--------|-------|---------|---------|-------|
| GET | `/profile/:isLaunch` | getProfile | Fetch user profile; set door from defaultDoor on launch | ✅ |
| PUT | `/profile` | updateProfile | Update profile, broadcast via Kafka | ✅ |
| PUT | `/offline` | goOffline | Set user offline, Kafka `user-offline` event | ✅ |
| GET | `/logout` | logout | Offline + unmute + open door, Kafka `user-quit` | ✅ |
| GET | `/isLoggedIn` | isLoggedIn | Auth check; detects device conflict (machineID) | ✅ |
| PUT | `/door/:state` | updateDoorState | Toggle doorOpen, broadcast `door-state` | ✅ |
| PUT | `/muted/:state` | updateMutedState | Mute/unmute, broadcast `muted-state` | ✅ |
| POST | `/instance-chosen` | onInstanceChosen | Register machineID, broadcast `instance-chosen` | ✅ |
| POST | `/instance-quit` | onInstanceQuit | Broadcast `instance-quit` | ✅ |
| GET | `/search/:searchString` | searchUsers | Search by initials/email/dept in org | ✅ |
| POST | `/first-visit` | changeFirstVisit | Mark first visit complete | ✅ |

### Conversations (`/conversations`)

| Method | Route | Handler | Purpose | Notes |
|--------|-------|---------|---------|-------|
| GET | `/conversations` | getConversationsByTeam | All conversations for user's team | ✅ |
| GET | `/conversations-update` | produceConversationChange | Trigger cleanup & sync | ✅ |
| POST | `/conversations` | createConversation | Create 1:1 or broadcast; triggers knock if needed | ✅ |
| POST | `/conversations/leave` | userLeaveConversations | Leave all conversations | ✅ |
| PUT | `/conversation/private` | userConversationPrivate | Toggle private flag | ✅ |
| POST | `/knock/accept` | acceptKnock | Accept knock → create conversation | ✅ |
| POST | `/knock/decline` | declineKnock | Decline knock | ✅ |
| DELETE | `/:conversationId/disconnect` | removeUserFromConversation | Remove specific user | ✅ |

### Teams (`/teams`)

| Method | Route | Handler | Purpose | Notes |
|--------|-------|---------|---------|-------|
| GET | `/teams` | teams | List all teams | ✅ |
| POST | `/teams` | create | Create team, user becomes owner | ✅ |
| PUT | `/team/:code/admin/set` | setAdmin | Owner adds admin | ✅ |
| PUT | `/team/:code/admin/unset` | unsetAdmin | Owner removes admin | ✅ |
| PUT | `/team/:code/owner/update` | updateOwner | Transfer ownership | ✅ |
| PUT | `/team/:code/membership/invite` | inviteMember | Invite member (admin/owner) | ✅ |
| PUT | `/team/:code/privacy/:state` | updatePrivacyState | Toggle team privacy | ✅ |
| DELETE | `/team/:code/membership/remove` | removeMember | Remove member (admin/owner) | ✅ |
| DELETE | `/teams/:code` | removeTeam | Delete team | ✅ |
| PUT | `/team/:code/membership` | join | Join team | ✅ |
| DELETE | `/team/:code/membership` | leave | Leave team | ✅ |

### Team Service — SSE + Broadcast (`/team-service`)

| Method | Route | Handler | Purpose | Notes |
|--------|-------|---------|---------|-------|
| GET | `/team-service/:code` | SSE stream | Persistent SSE connection for team events | ✅ |
| GET | `/team-service` | SSE stream | SSE for user's own team | ✅ |
| POST | `/team-service/:code/:event` | broadcast | Broadcast custom event to team via Kafka | ✅ |
| POST | `/team-service/:event` | broadcast | Broadcast to user's team | ✅ |

### Invitations (`/invitations`)

| Method | Route | Handler | Purpose | Notes |
|--------|-------|---------|---------|-------|
| GET | `/invitations` | getInvitations | List all invitations | ✅ |
| POST | `/invitation` | createInvitations | Send email invitations | ✅ |
| GET | `/invitation/confirm/:acceptanceCode` | acceptInvitation | Accept invite via code | ✅ |

### Heartbeat (`/heartbeat`)

| Method | Route | Handler | Purpose | Notes |
|--------|-------|---------|---------|-------|
| GET | `/heartbeat` | handleHeartbeat | Client keepalive; 40s auto-logoff | ✅ |

### Static / Misc (root)

| Method | Route | Purpose | Notes |
|--------|-------|---------|-------|
| GET | `/` | Health check ("OK") | No auth |
| POST/GET | `/request-test` | Test endpoint | No auth |
| GET | `/download` | Platform-specific S3 redirect | No auth |
| GET | `/auth-redirect` | Auth0 callback | No auth |
| GET | `/redirect` | Serve redirect HTML page | No auth |
| GET | `/logout-redirect` | Auth0 logout redirect | No auth |

---

## 2. SSE Event Types (Server → Client)

All events sent over persistent EventSource connection (`GET /team-service`).
Format: `id:<n>\nevent:<type>\ndata:<JSON>\n\n`

| Event | Payload | Source Action | Purpose |
|-------|---------|---------------|---------|
| `user-authenticate` | User object | Login / new user | User signed in |
| `user-offline` | User object | PUT /offline, heartbeat timeout | User went offline |
| `user-quit` | User object | GET /logout | User logged out |
| `toggle-member-online` | null | SSE connect/disconnect | Online status changed |
| `door-state` | `{doorOpen, ...user}` | PUT /door/:state | Door opened/closed |
| `muted-state` | `{muted, ...user}` | PUT /muted/:state | Mic muted/unmuted |
| `profile-update` | User object | PUT /profile | Profile changed |
| `conversation-change` | `{conversations: [...]}` | Any conversation mutation | Sync all conversations |
| `private-conversation-warning` | `{user: userId}` | PUT /conversation/private | Version check warning |
| `minimize-state` | `{status, membersIds}` | Join/leave conversation | UI minimize hint |
| `member-knock-start` | `{src, user, firstName}` | POST /conversations (target) | "Someone is knocking" (to knockee) |
| `user-knock-start` | `{src, user, firstName}` | POST /conversations (target) | "You're knocking" (to knocker) |
| `knock-accepted` | `{src, user, knocker}` | POST /knock/accept | Knock accepted, both notified |
| `knock-declined` | `{src, user, knocker}` | POST /knock/decline | Knock rejected |
| `knock-expired` | `{user}` or null | 8s timeout | Knock timed out |
| `device-conflict` | `{user: userId}` | Login on different device | Multi-device conflict |
| `instance-chosen` | `{user, machineID}` | POST /instance-chosen | Device selected |
| `instance-quit` | `{user, machineID}` | POST /instance-quit | Device released |
| `update-team-prop` | `{admins}` or `{owner}` | Admin actions | Team property changed |
| `user-list` | `{[userId]: userObj}` | Team membership change | Full member roster |
| `peer-signal` | `{signal: SDP/ICE}` | POST /team-service/:code/peer-signal | WebRTC signaling |

### SSE Broadcast Filtering ✅

```javascript
// Self-events are filtered unless in allowedSelfEvents list
const allowedSelfEvents = [
    'user-authenticate', 'device-conflict', 'instance-chosen',
    'instance-quit', 'user-knock-start', 'member-knock-start',
    'knock-accepted', 'knock-declined', 'knock-expired'
];
```

---

## 3. Kafka Topic and Message Schema

### Topic: `TEAM_SERVICE` ✅

Single topic for all events. Messages keyed by `data.src` (sender user ID). GZIP compressed.

```json
{
    "code": "<team-code>",
    "event": "<event-type>",
    "data": {
        "src": "<sender-user-id>",
        ...event-specific-fields
    }
}
```

Consumer group: `connect-server-<uuid>` (unique per server instance, enabling multi-instance broadcast).

### Kafka Connect (S3 Sink) 🔶

- Connector: `S3SinkConnector`
- Topic: `TEAM_SERVICE` → S3 bucket `connect-sink` (us-east-1)
- Format: JSON, flush every 1000 messages
- Status: Template in `notes/connector.curl`; not auto-configured

---

## 4. MongoDB Collections

### User ✅

```javascript
{
    _id: ObjectId,
    initials: String,
    email: String (unique),
    firstName: String,
    lastName: String,
    source: Object,              // Auth0 raw profile (not selected by default)
    orgCompany: String,
    department: String,
    team: ObjectId → Team,
    active: Boolean,
    doorOpen: Boolean,           // default: true
    firstVisit: Boolean,         // default: true
    defaultDoor: Boolean,        // default: null (remembered preference)
    isKnockRequired: Boolean,    // default: false
    avatarColor: String,         // default: '#ffa500b3'
    muted: Boolean,              // default: false
    online: Boolean,             // default: false
    lastLogin: Date,
    code: String (unique, shortid),
    machineID: String,
    appVersion: String,
    createdAt: Date,
    updatedAt: Date
}
// Virtual: defaultInitials (computed from first/lastName)
```

### Team ✅

```javascript
{
    _id: ObjectId,
    name: String,
    code: String (unique, shortid),
    members: [ObjectId → User],
    owner: ObjectId → User,
    admins: [ObjectId → User],
    isPrivate: Boolean,          // default: false
    invitedMembers: [ObjectId → User],
    createdAt: Date,
    updatedAt: Date
}
```

### Conversation ✅

```javascript
{
    _id: ObjectId,
    code: String (shortid),
    team: ObjectId → Team,
    private: Boolean,            // default: false
    isBroadcast: Boolean,        // default: false
    members: [ObjectId → User],
    createdAt: Date,
    updatedAt: Date
}
// Auto-cleanup: conversations with ≤1 members (non-broadcast) deleted on change
```

### Knock ✅

```javascript
{
    _id: ObjectId,
    user: ObjectId → User,       // initiator
    member: ObjectId → User,     // target
    team: ObjectId → Team,
    active: Boolean,             // default: true
    createdAt: Date              // 10-second TTL index
}
```

### Invitation ✅

```javascript
{
    _id: ObjectId,
    receiver: String (email),
    sender: String (email),
    sentDate: Date,
    isAccepted: Boolean,         // default: false
    acceptanceCode: String (unique, shortid),
    message: String
}
```

---

## 5. Electron IPC Channels

### Authentication
| Channel | Direction | Purpose |
|---------|-----------|---------|
| `OPEN_AUTH` | renderer → main | Open login window |

### Presence / Door
| Channel | Direction | Purpose |
|---------|-----------|---------|
| `TOGGLE_DOOR_EVENT` | renderer → main | Toggle door open/closed |

### Conversation
| Channel | Direction | Purpose |
|---------|-----------|---------|
| `START_CONVERSATION_EVENT` | renderer → main | Initiate voice call |
| `CONVERSATION_CHANGE` | main → renderer | Conversation list updated |
| `END_CONVERSATION_EVENT` | renderer → main | End current call |

### Knock System
| Channel | Direction | Purpose |
|---------|-----------|---------|
| `KNOCK_INITIATED` | renderer → main | Outgoing knock |
| `KNOCK_RECEIVED` | main → renderer | Incoming knock |
| `KNOCK_ACCEPTED` | main → renderer | Knock approved |
| `KNOCK_DECLINED` | main → renderer | Knock rejected |
| `KNOCK_EXPIRED` | main → renderer | Knock timed out |

### Power Management
| Channel | Direction | Purpose |
|---------|-----------|---------|
| `START_POWER_SAVE_BLOCKER` | renderer → main | Keep device awake during call |
| `STOP_POWER_SAVE_BLOCKER` | renderer → main | Allow sleep |

### Settings / Media
| Channel | Direction | Purpose |
|---------|-----------|---------|
| `SET_HOT_KEY` | renderer → main | Register keyboard shortcut |
| `GET_SERIALIZED_SPEECH_EXAMPLES` | renderer → main | Load voice training data |
| `SAVE_SERIALIZED_SPEECH_EXAMPLES` | renderer → main | Save voice training data |
| `SET_BG_VOLUME` | renderer → main | Set background conversation volume |
| `GET_BG_VOLUME` | renderer → main | Get background volume |
| `PREFERRED_MEDIA_CHANGE` | renderer → main | Audio device switched |

### State Sync
| Channel | Direction | Purpose |
|---------|-----------|---------|
| `GET_APP_STATE` | renderer → main | Fetch full app state |
| `SET_APP_STATE` | renderer → main | Update app state |
| `APP_STATE_UPDATE` | main → renderer | Broadcast state change |

### UI / Window
| Channel | Direction | Purpose |
|---------|-----------|---------|
| `MINIMIZE_UI` | renderer → main | Hide to tray |
| `TOGGLE_MINIMIZE` | renderer → main | Toggle main window |
| `OPEN_NOTIFICATION_WINDOW` | main → renderer | Show notification |
| `CLOSE_NOTIFICATION_WINDOW` | main → renderer | Hide notification |

### System
| Channel | Direction | Purpose |
|---------|-----------|---------|
| `ONLINE_DETECTED` | main → renderer | Internet reconnected |
| `OFFLINE_DETECTED` | main → renderer | Internet lost |
| `HEARTBEAT_SUCCESS` | main → renderer | Server reachable |
| `HEARTBEAT_FAILURE` | main → renderer | Server unreachable |
| `MAIN_WINDOW_BLUR` | main → renderer | App lost focus |
| `MAIN_WINDOW_FOCUS` | main → renderer | App gained focus |

---

## 6. WebRTC Signaling Messages

Exchanged via `peer-signal` SSE event, posted through `POST /team-service/:code/peer-signal`.

### SDP Offer
```json
{
    "type": "peer-signal",
    "payload": {
        "signal": {
            "type": "offer",
            "sdp": "<SDP string>"
        }
    }
}
```

### SDP Answer
```json
{
    "type": "peer-signal",
    "payload": {
        "signal": {
            "type": "answer",
            "sdp": "<SDP string>"
        }
    }
}
```

### ICE Candidate
```json
{
    "type": "peer-signal",
    "payload": {
        "signal": {
            "candidate": "<candidate string>",
            "sdpMid": "<mid>",
            "sdpMLineIndex": <number>
        }
    }
}
```

### Collision Handling ✅
- Uses RFC 8829 "perfect negotiation" pattern
- Each peer has a `polite` flag (determined by ordering)
- On simultaneous offers: impolite peer ignores, polite peer rolls back
