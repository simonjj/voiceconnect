# 04 — Phased Transformation Plan

> **From**: Realtime human team voice app
> **To**: Multi-agent audio collaboration platform
> **Strategy**: Extend, don't replace. Preserve low-friction interaction model. Smallest credible path to first working prototype.

---

## Phase 0: Discovery Validation

### Objective
Confirm that the discovered codebase architecture actually runs and behaves as mapped. Resolve unknowns.

### Tasks

1. **Attempt local build and run**
   - Resolve private npm registry (`@touchto`) dependencies — fork or stub
   - Stand up Docker Compose development stack
   - Configure Auth0 test tenant (or stub auth for dev)
   - Verify client builds (Webpack) and launches (Electron)
   - Verify server starts, connects to MongoDB and Kafka

2. **Validate signaling path**
   - Confirm SSE connection establishment
   - Confirm Kafka event round-trip (produce → consume → SSE broadcast)
   - Confirm WebRTC peer connection between two clients

3. **Validate presence and conversation model**
   - Confirm door open/close propagates via SSE
   - Confirm conversation creation/leave lifecycle
   - Confirm knock flow end-to-end

4. **Document runtime gaps**
   - What breaks? What's missing? What assumptions were wrong?
   - Update system map with corrections

### Deliverables
- Working local development environment (or documented blockers)
- Validated/corrected system map
- List of codebase modifications needed before agent work

### Risks
- Private npm packages may be unavailable → need to stub or rewrite
- Auth0 tenant config may be unavailable → need test tenant
- STUN/TURN servers may be offline → use public alternatives

---

## Phase 1: Single Agent Audio Participant

### Objective
One agent can join a conversation with one human. The human speaks, the agent hears (via STT), reasons, and speaks back (via TTS). The existing Connect UI shows the agent as a team member.

### Architecture Changes

```
Existing:
  Human A ←── WebRTC P2P ──→ Human B

Phase 1:
  Human A ←── WebRTC ──→ Media Bridge ←── Audio API ──→ [STT] → Agent → [TTS]
```

### Tasks

#### 1.1 Agent Identity
- Extend User model with `type: 'agent'` field
- Create agent registration API (`POST /agents`, `GET /agents`, etc.)
- Implement agent auth (API key or client-credentials JWT)
- Agent appears in team member list with distinct visual indicator

#### 1.2 Media Bridge (Minimal)
- Implement server-side WebRTC endpoint that can join a conversation as a peer
- Options: LiveKit server SDK, Pion-based bridge, or headless Chromium
- Bridge receives audio from human, outputs audio to human
- Audio from bridge → STT service → text
- Text from agent → TTS service → audio → bridge

#### 1.3 Speech Pipeline
- Integrate streaming STT service (Deepgram, Azure Speech, or Whisper)
- Integrate streaming TTS service (Azure Speech, ElevenLabs, or OpenAI TTS)
- Wire: Media Bridge audio out → STT → text events
- Wire: Agent text → TTS → audio → Media Bridge audio in

#### 1.4 Agent Runtime (Simple)
- Create agent SDK/interface: `onTranscript(text)` → `emit(responseText)`
- Implement one demo agent (e.g., echo agent, Q&A agent, or LLM wrapper)
- Agent runs as a separate Node.js service
- Agent connects to platform via internal API (Kafka consumer or REST webhook)

#### 1.5 Conversation Integration
- Modify `POST /conversations` to accept agent as target
- When agent is conversation target, create Media Bridge instead of expecting WebRTC from agent
- Produce `agent-joined` SSE event
- Agent leaves conversation when human leaves

#### 1.6 UI Changes (Minimal)
- Show agents in team roster with distinct agent style (different shape or icon)
- Show agent presence states (idle, listening, thinking, speaking)
- No new UI needed for initiating — click agent agent just like a human

### Deliverables
- One working agent that can converse with one human via audio
- Agent visible in Connect UI as a team member
- Round-trip: human speaks → agent hears → agent responds → human hears

### Success Criteria
- End-to-end audio conversation between human and agent
- Latency < 3 seconds from end of human speech to start of agent audio response
- Agent correctly processes speech and generates relevant responses

### Risks
- Media Bridge complexity — may need to evaluate multiple technologies
- STT/TTS streaming latency — test early
- Kafka signaling latency for agent coordination

---

## Phase 2: Multiple Agents in Shared Audio Space

### Objective
Multiple agents can participate in the same conversation. A human can talk to several agents. Agents can hear each other.

### Architecture Changes

```
Phase 2:
  Human A ──→ Media Gateway (SFU) ←──→ Agent 1 (via Speech Pipeline)
                    ↕                  ←──→ Agent 2 (via Speech Pipeline)
  Human B ──→ ─────┘                  ←──→ Agent 3 (via Speech Pipeline)
```

### Tasks

#### 2.1 Multi-Agent Conversations
- Allow multiple agents in `Conversation.members`
- Support adding/removing agents from active conversations
- Each agent gets its own STT/TTS channel through the Media Gateway

#### 2.2 Turn-Taking Manager
- Implement server-side turn manager
- Rules: only one agent speaks at a time (humans can always interrupt)
- Turn queue: when multiple agents want to respond, order by priority/relevance
- Timeout: if agent doesn't respond within N seconds, release turn

#### 2.3 Agent-to-Agent Communication
- Agents can send text messages to each other via internal bus (semantic relay)
- Optionally render agent-to-agent as audio for human observers
- Prevent feedback loops: agent doesn't process its own TTS output

#### 2.4 Agent Routing
- When human speaks, determine which agent(s) should respond
- Routing strategies: keyword-based, capability-based, LLM-classified intent
- Support "directed" speech ("Hey Agent-A, ...") and "open" speech (best agent responds)

#### 2.5 Media Gateway Upgrade
- Move from minimal bridge to SFU architecture
- Support N concurrent audio streams
- Per-agent audio isolation (each agent hears only relevant streams)
- Speaker diarization for multi-party STT

#### 2.6 Extended Presence
- Agent states: idle, listening, thinking, speaking (visible in UI)
- Speaking indicator on agent agents (reuse amplitude visualization)
- "Agent is thinking..." indicator during processing

### Deliverables
- Conversations with 1+ humans and 2+ agents
- Turn-taking prevents agent cross-talk
- Agent-to-agent semantic relay working
- Agent routing selects appropriate responder

### Success Criteria
- Multi-agent conversation without chaos (no overlapping agent speech)
- Correct agent routing (right agent answers the right question)
- Agent-to-agent communication demonstrably works

### Risks
- Turn-taking complexity with multiple agents + humans
- Audio feedback loops between agents
- Increased latency from routing + queuing
- STT speaker diarization accuracy

---

## Phase 3: Routing, Orchestration, and Policies

### Objective
Robust orchestration layer that manages complex multi-agent workflows, enforces policies, and supports advanced interaction patterns.

### Tasks

#### 3.1 Supervisor Agent
- Meta-agent that monitors all conversations
- Detects failures, timeouts, confusion
- Escalates to human when agents can't resolve
- Enforces conversation-level policies

#### 3.2 Advanced Routing
- Intent-based routing: NLU classifies user intent → routes to capable agent
- Skill-based routing: agents declare capabilities, router matches
- Handoff: agent A transfers conversation to agent B with context
- Conference: orchestrator assembles ad-hoc agent groups for complex tasks

#### 3.3 Policy Engine
- Rate limiting per agent (max responses/min, max concurrent conversations)
- Content filtering (block certain topics, PII handling)
- Cost budgets (max STT/TTS/LLM spend per conversation)
- Access control (which agents can join which team's conversations)

#### 3.4 Conversation Patterns
- Sequential: Human → Agent A → Human → Agent B
- Panel: Human asks, multiple agents discuss, synthesize answer
- Delegation: Agent A assigns subtask to Agent B, collects result
- Escalation: Agent → human supervisor when confidence is low

#### 3.5 Context Management
- Conversation memory: agents share context within a conversation
- Cross-conversation context: agent remembers prior interactions
- Context handoff: when transferring between agents

### Deliverables
- Supervisor agent with escalation capability
- Intent-based routing with agent skill matching
- Policy enforcement (rate limits, cost budgets, access control)
- At least 2 conversation patterns working (sequential + delegation)

---

## Phase 4: Production Hardening

### Objective
Make the platform reliable, observable, secure, and cost-effective for production use.

### Tasks

#### 4.1 Observability
- Structured logging for all agent interactions
- Metrics: conversation duration, agent response time, STT/TTS latency, error rate
- Distributed tracing across Media Gateway → STT → Agent → TTS → Gateway
- Conversation recording (optional, policy-controlled)
- Dashboard for team admins

#### 4.2 Reliability
- Agent health checks and auto-restart
- Graceful degradation when STT/TTS services are degraded
- Fallback to text-only mode if audio pipeline fails
- Connection recovery for Media Gateway
- Kafka partition strategy for scaling

#### 4.3 Security
- Agent sandboxing (resource limits, network isolation)
- Audio encryption at rest (recordings)
- Audit logging for agent actions
- PII detection and masking in transcripts
- Agent permission model (scoped access to tools and data)

#### 4.4 Performance
- Target latency: <1s end-to-end (human speech end → agent speech start)
- Streaming STT + streaming TTS for pipeline parallelism
- Connection pooling for STT/TTS services
- Media Gateway scaling (multiple instances, load balancing)
- Caching for common agent responses

#### 4.5 Cost Management
- Per-conversation cost tracking (STT minutes + TTS characters + LLM tokens)
- Budget alerts and auto-cutoff
- Model selection optimization (use cheaper models for simple tasks)
- Audio compression optimization

#### 4.6 Multi-Tenancy
- Team-scoped agent registries
- Per-team cost budgets
- Agent marketplace (optional — share agents across teams)

### Deliverables
- Production-ready deployment with monitoring and alerting
- <1s end-to-end latency for standard interactions
- Cost tracking and budget enforcement
- Security audit complete
- Load testing with N concurrent agent conversations

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **STT/TTS latency too high for natural conversation** | Medium | High | Use streaming APIs; evaluate multiple providers; cache common phrases |
| **Audio feedback loops** (agent hears own TTS) | High | High | Audio isolation per agent; mute agent input during own output; echo cancellation |
| **Agent cross-talk in multi-agent conversations** | Medium | High | Turn-taking protocol; orchestrator enforces one-at-a-time |
| **WebRTC Media Bridge complexity** | Medium | Medium | Start with headless Chromium (simple); migrate to Janus/LiveKit later |
| **Private npm packages unavailable** | High | Medium | Fork or stub `@touchto/*` packages |
| **Auth0 tenant unavailable** | Medium | Medium | Create test tenant or stub auth for development |
| **Cost overrun from STT/TTS/LLM** | Medium | Medium | Budget caps, model selection, conversation limits |
| **Kafka single-topic bottleneck** | Low | Medium | Add topics as needed; current volume is likely fine for Phase 1-2 |
| **Agent hallucination or unsafe output** | Medium | High | Output filtering, supervisor agent, human escalation |
| **Realtime QoS degradation under load** | Low | High | Load test early; SFU scaling; prioritize audio over other traffic |

---

## Architectural Bets

1. **Bet: SSE + Kafka signaling is sufficient for agent coordination.**
   Rationale: Signaling frequency for agents is lower than for humans (seconds, not milliseconds). If too slow, upgrade to WebSocket later.

2. **Bet: STT → LLM → TTS gives acceptable conversational UX.**
   Rationale: Current cloud STT/TTS can achieve ~500ms-1s latency with streaming. Good enough for most use cases. Audio-native agents are a future optimization.

3. **Bet: Extending the User model (type: 'agent') is simpler than a separate Agent entity.**
   Rationale: Conversations, teams, presence already work with Users. Adding a type field reuses all existing logic. If agent needs diverge significantly, extract later.

4. **Bet: A Media Gateway is needed (not just a signaling relay).**
   Rationale: Agents can't run WebRTC natively. Even with headless Chromium, a gateway provides recording, mixing, and stream management. This is the core infrastructure investment.

5. **Bet: Semantic (text) relay between agents is better than audio relay.**
   Rationale: Audio → STT → text → STT → audio between agents adds latency and loses information. Text relay is faster, cheaper, and more reliable. Render as audio only for human observation.

---

## Smallest Credible Prototype

The absolute minimum to demonstrate "human talks to agent by audio through Connect":

1. Stub Auth0 (hardcode test user)
2. Add `type: 'agent'` to User model
3. Register one agent as a team member
4. Run headless Chromium as agent's "browser" — connects to same SSE/WebRTC as a human
5. Headless browser captures audio → pipe to cloud STT API
6. STT text → simple LLM agent → response text
7. Response text → cloud TTS API → pipe audio back to headless browser
8. Human hears agent response through existing WebRTC

**Why this works**: By faking the agent as another Electron/browser client, zero changes are needed to the signaling, WebRTC, or SSE infrastructure. The "agent" is just a headless browser with STT/TTS plumbing. This proves the concept before investing in a real Media Gateway.

**Why this isn't the final architecture**: Headless Chromium is resource-heavy (1 browser per agent), doesn't scale, and doesn't support recording, mixing, or fine-grained audio control. But it's the fastest path to a demo.
