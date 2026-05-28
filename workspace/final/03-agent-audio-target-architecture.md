# 03 — Target Architecture: Multi-Agent Audio Collaboration Platform

> **Design principle**: Extend Connect's low-friction, presence-aware, always-on voice model so that agents are first-class participants alongside humans.
> **Approach**: Preserve what works (presence, sessions, event bus), add what's missing (agent runtime, media bridge, speech pipeline, orchestration).

---

## 1. Architecture Overview

### Current State → Transitional → Target

```
CURRENT STATE                TRANSITIONAL STATE           TARGET STATE
─────────────                ──────────────────           ────────────
Human ←→ Human               Human ←→ Agent              Human ←→ Agent
(WebRTC P2P)                 (Media Bridge)               Agent ←→ Agent
                                                          Multi-party mixed
SSE + Kafka                  SSE + Kafka + WS             Event mesh + WS
(team events)                (+ agent control plane)      (separated planes)

No agents                    1 agent, 1:1 calls           N agents, M:M calls
No STT/TTS                   Cloud STT/TTS                Pluggable speech
No orchestration             Simple routing               Orchestrator + policies
```

### Target Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VoiceConnect Platform                              │
│                                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                     │
│  │ Human Client  │   │ Human Client  │   │ Human Client  │                   │
│  │ (Electron)    │   │ (Electron)    │   │ (Web/Future)  │                   │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘                     │
│         │ WebRTC P2P        │                   │                            │
│         ├───────────────────┤                   │                            │
│         │                   │                   │                            │
│  ┌──────▼───────────────────▼───────────────────▼────────┐                   │
│  │              Media Gateway / SFU                        │                  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                │                  │
│  │  │ Human   │  │ Agent   │  │ Agent   │  ... N peers    │                  │
│  │  │ Port    │  │ Port A  │  │ Port B  │                 │                  │
│  │  └────┬────┘  └────┬────┘  └────┬────┘                │                  │
│  └───────┼────────────┼────────────┼─────────────────────┘                   │
│          │            │            │                                          │
│  ┌───────▼────────────▼────────────▼─────────────────────┐                   │
│  │              Speech Pipeline                            │                  │
│  │                                                         │                  │
│  │  ┌─────────────┐    ┌──────────────┐                   │                  │
│  │  │ STT Service │    │ TTS Service  │                   │                  │
│  │  │ (audio→text)│    │ (text→audio) │                   │                  │
│  │  └──────┬──────┘    └──────▲──────┘                   │                  │
│  └─────────┼──────────────────┼──────────────────────────┘                   │
│            │                  │                                               │
│  ┌─────────▼──────────────────┼──────────────────────────┐                   │
│  │              Agent Runtime Layer                        │                  │
│  │                                                         │                  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │                  │
│  │  │ Agent A  │  │ Agent B  │  │ Agent C  │  ... N       │                  │
│  │  │ (LLM +   │  │ (Tool +  │  │ (Custom  │  agents     │                  │
│  │  │  tools)  │  │  API)    │  │  logic)  │             │                  │
│  │  └──────────┘  └──────────┘  └──────────┘             │                  │
│  └────────────────────────────────────────────────────────┘                   │
│                                                                              │
│  ┌────────────────────────────────────────────────────────┐                   │
│  │              Orchestration Layer                         │                  │
│  │                                                         │                  │
│  │  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │                  │
│  │  │ Router       │  │ Turn Mgr    │  │ Supervisor   │  │                  │
│  │  │ (who joins?) │  │ (who speaks │  │ (policies,   │  │                  │
│  │  │              │  │  when?)     │  │  escalation) │  │                  │
│  │  └──────────────┘  └─────────────┘  └──────────────┘  │                  │
│  └────────────────────────────────────────────────────────┘                   │
│                                                                              │
│  ┌────────────────────────────────────────────────────────┐                   │
│  │              Control Plane (existing + extended)         │                  │
│  │                                                         │                  │
│  │  ┌────────┐  ┌────────┐  ┌─────────┐  ┌────────────┐  │                  │
│  │  │ Express│  │ Kafka  │  │ MongoDB │  │ Auth       │  │                  │
│  │  │ API    │  │ Events │  │ State   │  │ (Auth0 +   │  │                  │
│  │  │        │  │        │  │         │  │  Agent Keys)│  │                  │
│  │  └────────┘  └────────┘  └─────────┘  └────────────┘  │                  │
│  └────────────────────────────────────────────────────────┘                   │
│                                                                              │
│  ┌────────────────────────────────────────────────────────┐                   │
│  │              Observability                               │                  │
│  │  Logging · Metrics · Tracing · Cost Tracking · Audit    │                  │
│  └────────────────────────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Role Model

### 2.1 Human Participant

| Aspect | Current | Target |
|--------|---------|--------|
| Identity | Auth0 user, MongoDB User model | No change |
| Audio | WebRTC P2P via Electron | WebRTC P2P (direct human-human) or via Media Gateway (when agents involved) |
| Presence | online, doorOpen, muted | No change |
| Interaction | Click agent, knock, voice command | + "Ask agent", direct-to-agent audio |

### 2.2 Agent Participant

| Aspect | Design |
|--------|--------|
| Identity | MongoDB model extending User (type: 'agent'), API key auth, capability declarations |
| Audio input | Receives transcribed text from STT pipeline (or raw audio stream if audio-native) |
| Audio output | Emits text → TTS service → audio stream into conversation via Media Gateway |
| Presence | `idle`, `listening`, `thinking`, `speaking`, `unavailable`, `error` |
| Lifecycle | Registered in agent registry, started/stopped by platform, health-checked |
| Capabilities | Declared at registration: topics, languages, tools, max concurrent conversations |

### 2.3 Orchestrator / Supervisor

| Aspect | Design |
|--------|--------|
| Role | Meta-agent that manages conversation flow, agent selection, turn-taking, escalation |
| Inputs | Conversation events, agent states, user intents, policies |
| Outputs | Agent join/leave commands, speaking turn grants, timeout enforcements |
| Where it runs | Server-side service, consumes Kafka events, produces control commands |

### 2.4 Media Gateway / Bridge

| Aspect | Design |
|--------|--------|
| Role | Bridges WebRTC audio (human clients) with server-side audio streams (agents) |
| Implementation options | Janus Gateway, Pion (Go), LiveKit, MediaSoup, or headless Chromium |
| Capabilities | WebRTC peer for each participant, audio mixing/forwarding, stream recording |
| Key property | Acts as a "virtual peer" — human clients see it as another WebRTC peer |

### 2.5 Speech Pipeline

| Aspect | Design |
|--------|--------|
| STT | Receives audio stream from Media Gateway, emits text with timestamps and speaker ID |
| TTS | Receives text from agent, emits audio stream into Media Gateway |
| Options | Cloud: Azure Speech, Google Cloud Speech, AWS Transcribe, Deepgram, OpenAI Whisper/TTS. Self-hosted: Whisper, Coqui, Piper |
| Key property | Must be streaming (not batch) for conversational latency |

### 2.6 Agent Runtime Adapter

| Aspect | Design |
|--------|--------|
| Role | Standardized interface between the platform and individual agent implementations |
| Interface | `onTranscript(text, speaker, context)` → agent processes → `emit(responseText)` |
| Agent types | LLM-based (GPT, Claude), tool-calling, rule-based, hybrid |
| Isolation | Each agent runs in its own container/process with resource limits |

---

## 3. Architectural Layers

### Layer 1: Media Plane

**Responsibility**: Realtime audio transport between all participants (human and agent).

**Current**: WebRTC P2P between Electron clients. Server not in audio path.

**Target**:
- **Human-to-human (no agent)**: Keep WebRTC P2P (no change needed)
- **Human-to-agent**: Human WebRTC ↔ Media Gateway ↔ Speech Pipeline ↔ Agent
- **Agent-to-agent**: Speech Pipeline A → text → Agent A → text → Speech Pipeline B (or direct audio relay for audio-native agents)
- **Mixed (human + agents)**: Media Gateway acts as SFU, bridging all streams

**Key decisions**:
- Media Gateway is only inserted when agents are part of a conversation
- Gateway acts as transparent bridge — human clients don't need changes for basic agent audio
- Audio recording/logging happens at the Gateway level

### Layer 2: Speech Plane

**Responsibility**: Convert between audio and text at agent boundaries.

**Components**:
- **STT Service**: Streaming speech-to-text. Receives audio from Media Gateway per-speaker, emits text events.
- **TTS Service**: Text-to-speech. Receives text from agents, emits audio into Media Gateway.
- **Speaker diarization**: Identify who is speaking (for multi-party STT).

**Design choices**:
- STT/TTS are **shared infrastructure services**, not per-agent
- Support multiple providers behind a unified API (swap Deepgram for Whisper, etc.)
- Streaming is mandatory — no batch transcription for live conversation
- TTS voice selection per agent (each agent has a distinct voice)

### Layer 3: Agent Runtime Plane

**Responsibility**: Execute agent logic in response to conversation events.

**Components**:
- **Agent Registry**: Database of registered agents with capabilities, config, health
- **Agent Host**: Container orchestrator that runs agent processes
- **Agent SDK**: Standard interface for agent developers
- **Tool System**: Agents can call tools (APIs, databases, code execution)

**Agent interface** (conceptual):
```
interface AgentParticipant {
    id: string
    name: string
    capabilities: string[]
    presence: AgentPresence

    onJoinConversation(conversation: Conversation): void
    onTranscript(speaker: Participant, text: string): void
    onLeaveConversation(): void
    emit(text: string): void       // → TTS → audio
    emitAudio(stream: AudioStream): void  // Direct audio (optional)
}
```

### Layer 4: Orchestration Plane

**Responsibility**: Decide which agents join which conversations, manage turn-taking, enforce policies.

**Components**:
- **Router**: Determines which agent(s) should respond to a user request
- **Turn Manager**: Prevents simultaneous speaking, manages interruptions, enforces timeouts
- **Supervisor**: Monitors conversation health, escalates failures, enforces policies
- **Policy Engine**: Rules for agent behavior (max response time, max speaking duration, forbidden topics)

**Turn-taking protocol** (proposed):
```
1. Human speaks → STT → transcript event
2. Orchestrator evaluates which agent(s) should respond
3. Orchestrator grants "speaking turn" to selected agent
4. Agent receives transcript, processes, emits response text
5. TTS converts to audio, plays into conversation
6. Orchestrator releases turn, listens for next speaker
7. Timeout: if agent doesn't respond in N seconds, release turn
```

**Agent-to-agent protocol**:
```
1. Agent A emits text directed at Agent B
2. Orchestrator routes to Agent B (may or may not go through TTS/STT)
3. Agent B processes, emits response
4. Orchestrator manages turn alternation
5. Configurable: semantic (text) relay vs audio relay between agents
```

### Layer 5: Control Plane (Extended)

**Responsibility**: API, state, events, auth — the existing Express/Kafka/MongoDB layer, extended.

**Extensions needed**:
- **Agent CRUD API**: Register, update, delete, list agents
- **Agent auth**: API key or client-credentials JWT for agent services
- **Agent presence API**: Agent reports its state changes
- **Conversation extensions**: `members` array includes agents; `type` field for human/agent
- **New Kafka topics**: `AGENT_CONTROL` (commands), `AGENT_EVENTS` (agent state), `CONVERSATION_AUDIO` (audio events)
- **Agent-specific SSE events**: `agent-joined`, `agent-left`, `agent-speaking`, `agent-thinking`

---

## 4. Identity and Presence Model

### Extended User Model

```javascript
// Extend existing User schema
{
    // ... existing fields ...
    type: {
        type: String,
        enum: ['human', 'agent'],
        default: 'human'
    },
    // Agent-specific fields (only when type === 'agent')
    agentConfig: {
        capabilities: [String],      // e.g., ['customer-support', 'code-review']
        voiceId: String,             // TTS voice identifier
        maxConcurrentConversations: Number,
        triggerWords: [String],      // Words that activate this agent
        autoJoinTeam: Boolean,       // Agent automatically joins team conversations
        responseTimeout: Number,     // Max ms to respond before turn released
        owner: ObjectId,             // Who registered this agent
        endpoint: String,            // Agent service URL (for remote agents)
        runtimeType: String          // 'local', 'remote', 'function'
    }
}
```

### Agent Presence States

```
┌─────────┐    register    ┌──────────┐    conversation    ┌───────────┐
│  IDLE   │───────────────→│ LISTENING │──────────────────→│ THINKING  │
│ (ready) │←───────────────│ (in conv) │←──────────────────│(processing│
└─────────┘    leave       └──────────┘    response ready  └───────────┘
     │                          │                               │
     │                          │                               │
     ▼                          ▼                               ▼
┌─────────┐               ┌──────────┐                    ┌───────────┐
│UNAVAIL- │               │ SPEAKING │                    │  ERROR    │
│ ABLE    │               │(TTS out) │                    │ (failed)  │
└─────────┘               └──────────┘                    └───────────┘
```

Mapping to existing presence concepts:
| Human Concept | Agent Equivalent |
|---------------|-----------------|
| online | idle or listening |
| doorOpen | autoJoinTeam or responsive to triggers |
| muted | not emitting audio (idle, unavailable) |
| in conversation | listening, thinking, or speaking |

---

## 5. Media Gateway Design

### Option A: Selective Gateway (Recommended for Phase 1)

```
Human A ←──── WebRTC P2P ────→ Human B     (no gateway, keep existing)

Human A ←── WebRTC ──→ Media Gateway ←── Audio Stream ──→ Agent
                            │
                            └── Records audio (optional)
```

- Gateway only created when an agent joins a conversation
- Human-to-human calls remain pure P2P (no infrastructure cost)
- Gateway acts as a single WebRTC peer to each human client

### Option B: Always-On SFU (Target State)

```
All participants ←── WebRTC ──→ SFU/MCU ←── Audio ──→ All agents
                                   │
                                   ├── STT per speaker
                                   ├── TTS per agent
                                   ├── Recording
                                   └── Analytics
```

- All conversations route through SFU
- Enables recording, analytics, monitoring for all calls
- Higher infrastructure cost but uniform architecture

### Recommended Implementation

| Technology | Fit | Notes |
|------------|-----|-------|
| **LiveKit** | Strong | Open-source WebRTC SFU, server-side SDK, agent framework, built-in recording |
| **Janus Gateway** | Strong | Mature, C-based, plugin architecture, well-documented |
| **MediaSoup** | Good | Node.js-native SFU, low-level but flexible |
| **Pion** | Good | Go-based WebRTC, lightweight, good for custom bridge |
| **Headless Chromium** | Quick prototype | Run agent as a "browser" — easy but resource-heavy |

---

## 6. Tradeoffs and Open Decisions

### Audio Fidelity vs Latency

| Approach | Latency | Fidelity | Complexity |
|----------|---------|----------|------------|
| Audio-native (agent directly processes audio) | Lowest (~200ms) | Highest | Very high |
| STT → text → LLM → text → TTS | Medium (~1-3s) | Good | Moderate |
| STT → text → LLM → text → TTS (streaming) | Lower (~500ms-1s) | Good | Higher |

**Recommendation**: Start with streaming STT → LLM → streaming TTS. This gives conversational latency (~1s) with proven technology. Audio-native agents can be added later as an optimization.

### Agent-to-Agent Communication

| Approach | Pros | Cons |
|----------|------|------|
| **Semantic relay** (text only between agents) | Fast, cheap, no audio overhead | Loses prosody, tone; not "audio communication" |
| **Audio relay** (agent A TTS → agent B STT) | True audio communication | High latency, expensive, information loss |
| **Hybrid** (text internally, audio externally) | Best of both | Complexity; "audio" claim is partially artificial |

**Recommendation**: Default to semantic relay between agents for efficiency. Optionally render agent-to-agent communication as audio for human observers (so humans can hear the agents "talking to each other").

### Conversation Topology

| Topology | Use Case | Complexity |
|----------|----------|------------|
| 1 human + 1 agent | Personal assistant, Q&A | Lowest |
| N humans + 1 agent | Team assistant, meeting scribe | Medium |
| 1 human + N agents | Agent panel, multi-tool | Medium-high |
| N humans + M agents | Full collaboration | Highest |

**Recommendation**: Build for 1 human + 1 agent first. The conversation model already supports N members, so scaling is additive.
