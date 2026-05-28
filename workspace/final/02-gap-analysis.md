# 02 — Gap Analysis: Current State → Multi-Agent Audio Platform

> **Based on**: Codex system map, interface catalog, and runtime model.
> **Target**: A system where humans talk to agents by audio, agents talk back by audio, and multiple agents can communicate with each other by audio — all preserving Connect's low-friction, presence-aware interaction model.

---

## 1. Current Capabilities Summary

### What Connect Has Today

| Capability | Status | Reusability for Agents |
|------------|--------|------------------------|
| Peer-to-peer WebRTC audio | ✅ Working | 🟡 Needs adaptation — only works between Electron clients |
| SSE-based realtime event broadcasting | ✅ Working | 🟢 High — can extend to agent clients |
| Kafka event bus (TEAM_SERVICE) | ✅ Working | 🟢 High — agents can produce/consume |
| Presence model (online, doorOpen, muted) | ✅ Working | 🟡 Needs extension — agent-specific states |
| Conversation/session management | ✅ Working | 🟡 Needs extension — agent participants |
| Knock-to-connect interaction | ✅ Working | 🟡 May not apply to agents |
| Auth0 OAuth2 + JWT | ✅ Working | 🔴 Designed for human browser flow |
| Speech command ML (TensorFlow.js) | ✅ Working | 🟡 Client-side only — not generalizable |
| MongoDB persistence | ✅ Working | 🟢 High — schema extensible |
| Team/membership model | ✅ Working | 🟡 Needs "agent member" concept |
| Per-member volume control | ✅ Working | 🟢 Carries forward for agent audio |
| Broadcast (one-to-many) conversations | ✅ Working | 🟢 Useful for agent announcements |

---

## 2. Capability Gaps

### 2.1 Agent Identity and Lifecycle

| Gap | Severity | Details |
|-----|----------|---------|
| **No agent participant concept** | Critical | The User model assumes human attributes (email, firstName, Auth0 profile). No way to register an agent as a participant. |
| **No agent auth model** | Critical | Auth0 OAuth2 PKCE is designed for browser-based human login. Agents need service-to-service auth (API keys, client credentials). |
| **No agent lifecycle management** | Critical | No way to deploy, start, stop, or monitor an agent. No agent registry. |
| **No agent presence model** | High | Agents need states beyond doorOpen/muted — e.g., `listening`, `speaking`, `thinking`, `idle`, `processing`. |
| **No agent capability declaration** | Medium | No way for an agent to advertise what it can do, what conversations it can join, or what triggers activate it. |

### 2.2 Audio Infrastructure

| Gap | Severity | Details |
|-----|----------|---------|
| **No server-side audio endpoint** | Critical | WebRTC is browser-to-browser only. Agents running as server processes cannot be WebRTC peers without a media bridge (e.g., headless browser, GStreamer, Janus). |
| **No STT pipeline** | Critical | Incoming audio must be transcribed for agent understanding. The existing TensorFlow.js speech commands do wake-word only, not general STT. |
| **No TTS pipeline** | Critical | Agents need to produce audio output. No text-to-speech service exists. |
| **No audio mixing/MCU** | High | Current WebRTC is full-mesh P2P. Multi-party (>2) conversations with agents would need either SFU/MCU or mesh management. |
| **No audio-native agent interface** | High | Even if STT/TTS exists, there's no API for agents to receive transcribed text and emit synthesized speech into a conversation. |
| **No echo/feedback prevention** | High | When agents hear their own TTS output via other agents, feedback loops are inevitable. No architecture for this. |

### 2.3 Orchestration and Routing

| Gap | Severity | Details |
|-----|----------|---------|
| **No agent routing/dispatch** | Critical | No system decides which agent should respond to a user, when an agent should join a conversation, or how to route audio to the right agent. |
| **No conversation turn-taking** | High | Humans manage turn-taking socially. Agent-to-agent needs protocol-level turn management (who speaks when, interruption rules, timeouts). |
| **No supervisor/moderator** | High | Multi-agent conversations need an orchestrator to prevent chaos (cross-talk, infinite loops, competing responses). |
| **No agent-to-agent communication** | Critical | No mechanism for agents to talk to each other (via audio or otherwise). All communication currently requires a human initiator. |
| **No intent/topic routing** | Medium | No way to route a user's request to the right agent based on topic, capability, or context. |

### 2.4 Signaling and Transport

| Gap | Severity | Details |
|-----|----------|---------|
| **SSE is unidirectional** | Medium | Server can push to client, but agents-as-clients need bidirectional signaling. Current model uses REST POST for client→server, which adds latency. |
| **Single Kafka topic** | Medium | All events share `TEAM_SERVICE`. Agent events, control plane events, and signaling may need separation for scalability and filtering. |
| **No WebSocket signaling** | Medium | SSE + REST POST works but is suboptimal for high-frequency signaling. WebSocket would be more natural for bidirectional agent communication. |
| **Signaling goes through Kafka** | Low | Adds latency to WebRTC negotiation. Acceptable for human interactions but may be slow for rapid agent-to-agent connection setup. |

### 2.5 Observability and Governance

| Gap | Severity | Details |
|-----|----------|---------|
| **No conversation logging/recording** | High | Audio content is P2P and ephemeral. No way to log, audit, or analyze agent conversations. |
| **No cost tracking** | Medium | Agent STT/TTS/LLM calls have per-token/per-minute costs. No metering. |
| **No rate limiting for agents** | Medium | An agent could flood the system with events/audio. No throttling. |
| **No conversation analytics** | Medium | No metrics on conversation duration, agent response time, turn count, etc. |
| **No policy engine** | Medium | No rules for "which agents can talk to which users" or "maximum concurrent agent conversations." |

---

## 3. Gap Severity Matrix

```
                        CRITICAL (must solve)    HIGH (should solve)     MEDIUM (nice to have)
Agent Identity          ████████████████████
Agent Auth              ████████████████████
Server-side Audio       ████████████████████
STT Pipeline            ████████████████████
TTS Pipeline            ████████████████████
Agent Routing           ████████████████████
Agent-to-Agent          ████████████████████
Agent Lifecycle                                  ████████████████████
Agent Presence                                   ████████████████████
Audio Mixing/SFU                                 ████████████████████
Audio-native Interface                           ████████████████████
Echo Prevention                                  ████████████████████
Turn-taking                                      ████████████████████
Supervisor Agent                                 ████████████████████
Conversation Logging                             ████████████████████
Bidirectional Signaling                                                 ████████████████████
Topic Separation                                                        ████████████████████
Cost Tracking                                                           ████████████████████
Rate Limiting                                                           ████████████████████
```

---

## 4. What Carries Forward (Reusable Foundations)

### Strong Reuse Candidates

1. **Conversation model** — ephemeral, membership-based sessions are a good fit for agent conversations. Extend `members` to include agent IDs. ✅
2. **Presence model** — `online`/`doorOpen`/`muted` maps naturally to agent states. Add agent-specific states. ✅
3. **Kafka event bus** — agents can produce and consume events on the same bus. Add agent-specific topics. ✅
4. **SSE broadcast** — agents running as services can connect as SSE clients or receive events via Kafka directly. ✅
5. **Team/membership** — agents can be "members" of teams, visible in the roster. ✅
6. **Knock metaphor** — could extend to "agent requesting to join conversation" or "user requesting agent assistance." 🔶
7. **Volume/mute controls** — per-member volume works for agent audio output too. ✅
8. **MongoDB schemas** — extensible with agent-specific fields. ✅

### Partial Reuse (Needs Adaptation)

1. **WebRTC** — Keep for human-to-human. For agent participation, need a media bridge/gateway. 🔶
2. **Auth** — Keep Auth0 for humans. Add service auth (client credentials / API key) for agents. 🔶
3. **UI (agent model)** — Agent agents could look different (shape, color, icon) but fit the same visual metaphor. 🔶

### Unlikely to Reuse

1. **TensorFlow.js speech commands** — Client-side, browser-only, limited to trained wake words. STT/TTS needs will be server-side services. 🔴
2. **Electron-specific IPC** — Not relevant for agent participants. 🔴
3. **STUN/TURN config** — Hardcoded credentials for human clients. Agents won't use these. 🔴

---

## 5. Key Architectural Questions (Open)

1. **Where does audio processing happen?**
   - Client-side (human's browser) → server STT → agent → server TTS → client playback?
   - Or does the agent join the WebRTC session via a media bridge?

2. **What is the agent runtime?**
   - Docker container alongside the server? Separate service cluster? Serverless functions?

3. **How do agents authenticate?**
   - Extend Auth0 with machine-to-machine? Separate API key system?

4. **What is the audio quality requirement?**
   - Is sub-500ms round-trip latency required for natural conversation?
   - Can agents operate with 1-2 second latency from STT→reasoning→TTS?

5. **How many concurrent agent conversations?**
   - Per team? Per agent? System-wide? This drives infrastructure sizing.

6. **Should agents hear all team audio or only directed conversations?**
   - Always-listening agent (like a human with door open) vs. invoked-only agent?

7. **What happens when an agent crashes mid-conversation?**
   - Graceful fallback? Retry? Escalate to human? Silence?
