Below is a high-level operating brief you can hand to two sub-agents. I’m basing this on the project tree you shared plus the Connect deck, which describes the product as a realtime, voice-first team collaboration app built around React UI, WebRTC/`RTCPeerConnection`, client-side speech command ML, and server-side Node/Python services with Mongo, Kafka/Zookeeper, Auth0, AWS, and Terraform.  The deck also makes clear the core product behavior: always-on connectivity, instant voice interactions, “door open / closed” presence, and trigger-word or shortcut based conversation initiation. 

## Goal for the two-agent effort

Discover the client and server repos, produce a map of the current system, and then produce a consolidated high-level plan to evolve it from a human team voice app into a **multi-agent audio communication platform** where:

* humans can talk to agents by audio
* agents can talk back by audio
* multiple agents can talk to each other by audio
* the system still preserves the original low-friction, realtime, presence-aware interaction model suggested by Connect’s concept. 

---

# Recommended staging structure

Tell both models to keep the staging area clean and deterministic.

```text
voiceconnect/
├── README.md
├── Connect72220.pdf
├── connect-client-repo.tar.gz
├── connect-server-repo.tar.gz
├── workspace/
│   ├── source/
│   │   ├── client/
│   │   └── server/
│   ├── discovery/
│   │   ├── codex/
│   │   │   ├── notes/
│   │   │   ├── inventories/
│   │   │   ├── diagrams/
│   │   │   └── outputs/
│   │   └── opus/
│   │       ├── notes/
│   │       ├── analyses/
│   │       ├── architecture/
│   │       └── outputs/
│   ├── shared/
│   │   ├── repo-map/
│   │   ├── interface-catalog/
│   │   ├── runtime-model/
│   │   ├── assumptions/
│   │   └── risks/
│   └── final/
│       ├── 01-system-map.md
│       ├── 02-gap-analysis.md
│       ├── 03-agent-audio-target-architecture.md
│       └── 04-phased-transformation-plan.md
```

## Extraction and normalization rules

1. Extract both tarballs into `workspace/source/client` and `workspace/source/server`.
2. Do not modify original extracted code.
3. Put any scripts, notes, diagrams, inventories, and synthesized artifacts only under `workspace/discovery`, `workspace/shared`, and `workspace/final`.
4. Preserve a plain-text inventory of:

   * repo roots
   * package manifests
   * lockfiles
   * infra/config/auth files
   * audio/media/WebRTC code
   * ML/speech code
   * messaging/eventing code
   * presence/state/session code
   * API surface
5. Record uncertainties explicitly instead of guessing.

---

# Division of labor

## Codex: implementation discovery and mechanical mapping

Codex should behave like the **code cartographer**.

### Mission

Inspect the extracted client and server repos and produce a grounded map of how the current application actually works.

### What Codex should focus on

* repository structure
* build/run flow
* package ecosystem and languages
* entry points
* network surfaces
* auth model
* audio capture/playback paths
* WebRTC and signaling paths
* state/presence/session logic
* speech-trigger / ML components
* persistence and eventing dependencies
* deployment/runtime assumptions

### Codex deliverables

1. **Repo inventory**

   * top-level directories
   * key manifests
   * major frameworks/libraries
   * notable scripts and dev commands

2. **Executable architecture map**

   * client entrypoint(s)
   * server entrypoint(s)
   * background workers, if any
   * API endpoints
   * websocket/signaling endpoints
   * database/event bus integrations
   * external services used

3. **Audio path map**

   * how microphone input is captured
   * where audio is encoded/decoded
   * how streams are established
   * where playback occurs
   * where mute/presence/focus state is enforced

4. **Conversation/session map**

   * how a user starts a voice interaction
   * how peers are discovered
   * how sessions/rooms/channels are represented
   * where permissions/team tokens/auth gates live

5. **Interface catalog**

   * APIs
   * events
   * message schemas
   * websocket payloads
   * Kafka topics if present
   * DB collections/tables if inferable

6. **Reality check**

   * what is implemented vs what appears only in the deck
   * dead code / stubs / TODO-heavy areas
   * missing local dependencies needed to run

### Codex output format

Ask Codex to write:

* `workspace/final/01-system-map.md`
* `workspace/shared/interface-catalog/interfaces.md`
* `workspace/shared/runtime-model/current-runtime.md`

### Codex prompt you can use

```text
You are Codex acting as a code cartographer.

Your task is to inspect the extracted client and server repositories for voiceconnect and produce a factual, implementation-grounded map of the system.

Context:
- The product deck describes Connect as a realtime, voice-first team collaboration app with React UI, WebRTC/RTCPeerConnection, client-side speech command ML, and server-side Node/Python services, plus AWS/Auth0/Mongo/Kafka/Terraform.
- Your job is not to trust the deck blindly. Use the code as source of truth and note where the deck and code differ.

Objectives:
1. Inventory the client and server repos.
2. Identify entrypoints, run/build flows, frameworks, and dependencies.
3. Map audio, signaling, presence, auth, storage, and eventing flows.
4. Produce a current-state system map and an interface catalog.
5. Highlight uncertainty, missing pieces, and likely stale code.

Rules:
- Keep extracted source read-only.
- Put all notes and outputs under workspace/discovery/codex or workspace/shared/workspace/final.
- Do not propose major redesigns yet; focus on discovery.
- Be explicit about evidence for each claim.
- When something is unclear, say “unclear” and point to likely files.

Output files:
- workspace/final/01-system-map.md
- workspace/shared/interface-catalog/interfaces.md
- workspace/shared/runtime-model/current-runtime.md

Success criteria:
- A human can understand how the current system is assembled.
- Another agent can use your map to plan a transformation.
- The map clearly separates verified facts, inferred facts, and unknowns.
```

---

## Opus: architectural synthesis and transformation planning

Opus should behave like the **systems architect and planner**.

### Mission

Use the PDF, Codex’s map, and selective repo inspection to design a high-level transformation plan from “voice team app” to “multi-agent audio collaboration fabric.”

### What Opus should focus on

* preserving the product’s low-friction interaction model
* identifying the minimal viable architectural shifts
* defining how agents become first-class participants
* deciding where audio is native vs where text/semantic intermediates are acceptable internally
* separating control plane from media plane
* mapping human identity/presence concepts to agent identity/presence concepts
* designing orchestration patterns for agent-to-agent audio exchange

### Key design questions for Opus

1. **What is an agent in this system?**

   * a peer on the same media fabric?
   * a server-side participant?
   * a bridge attached through adapters?

2. **How should agent audio work?**

   * native audio in/audio out per agent
   * STT → internal reasoning → TTS at boundaries only
   * pure audio relay between agents vs semantic relay with audio rendering

3. **How do agents join conversations?**

   * room/channel based
   * direct call based
   * supervisor-orchestrated conference
   * trigger-word or routing-intent based

4. **How is presence represented?**

   * available / busy / do-not-disturb
   * listening / speaking / thinking / muted
   * human “door open/closed” analog for agents

5. **How do we avoid chaos in agent-to-agent voice?**

   * arbitration
   * turn-taking
   * interruption rules
   * timeouts
   * moderator/supervisor agent
   * audio mixing vs sequential speaking

6. **What has to change least, and what likely must be reworked?**

   * can existing WebRTC/session signaling be reused?
   * can presence/team/token concepts be extended?
   * should agent execution live beside server or as separate services?

### Opus deliverables

1. **Gap analysis**

   * current app capabilities vs target multi-agent audio system

2. **Target architecture**

   * current state
   * transitional state
   * target state

3. **Role model**

   * human participant
   * agent participant
   * orchestrator/supervisor
   * media bridge
   * speech pipeline
   * tool/runtime adapter

4. **Phased plan**

   * phase 0: discovery validation
   * phase 1: single agent audio participant
   * phase 2: multiple agents in shared audio space
   * phase 3: routing/orchestration/policies
   * phase 4: production hardening

5. **Risks and architectural bets**

   * latency
   * echo/looping
   * agent cross-talk
   * auth/isolation
   * observability
   * cost
   * realtime QoS

### Opus output format

Ask Opus to write:

* `workspace/final/02-gap-analysis.md`
* `workspace/final/03-agent-audio-target-architecture.md`
* `workspace/final/04-phased-transformation-plan.md`

### Opus prompt you can use

```text
You are Opus acting as a systems architect.

Your task is to use:
1. the Connect product deck,
2. the discovered codebase structure,
3. Codex’s current-state map,

to produce a high-level transformation plan for evolving Connect from a realtime human team voice app into a multi-agent audio collaboration system.

Context:
- Connect is described as a low-friction, always-on, voice-first collaboration app using React, WebRTC, speech commands, Node/Python services, and cloud infrastructure.
- The target future is a system where humans can talk to agents via audio, agents can talk back via audio, and multiple agents can communicate with each other via audio.
- Stay high-level and architectural. Do not go deep into implementation yet.

What to produce:
1. A gap analysis between current state and target state.
2. A target architecture that introduces agents as first-class participants.
3. A phased transformation plan.
4. Architectural decisions, tradeoffs, and open questions.
5. Recommendations on what should be preserved, extended, or replaced.

Design principles:
- Preserve the product’s original low-friction voice interaction model.
- Minimize unnecessary rewrites if existing signaling/media/presence systems can be extended.
- Distinguish media plane, control plane, orchestration plane, and agent runtime plane.
- Make human and agent participants conceptually consistent where possible.
- Be explicit about assumptions and unknowns.

Output files:
- workspace/final/02-gap-analysis.md
- workspace/final/03-agent-audio-target-architecture.md
- workspace/final/04-phased-transformation-plan.md

Success criteria:
- The final plan is coherent enough that a human can review it and decide whether to proceed.
- It identifies the smallest credible path to a first working agent-audio prototype.
- It avoids overcommitting to detailed implementation before discovery is complete.
```

---

# Shared instructions for both models

Give both models these common guardrails:

```text
Shared operating rules:

1. Source of truth priority:
   code > config > docs > deck assumptions

2. Mark each important statement as one of:
   - Verified
   - Inferred
   - Unknown

3. Preserve a clean workspace:
   - never write into extracted source except optional non-committed local run artifacts
   - put generated docs, maps, and diagrams into workspace/

4. Explicitly identify:
   - media plane
   - signaling/control plane
   - auth/identity plane
   - presence/state plane
   - persistence/eventing plane
   - deployment/infrastructure plane

5. Keep focus on the target outcome:
   “turn this realtime team communications app into a system where multiple different agents can communicate with humans and with each other via audio.”

6. Stay high-level for transformation planning.
   Do not prematurely lock in vendors, frameworks, or protocols unless the existing codebase strongly implies them.

7. When inspecting code, pay special attention to:
   - WebRTC
   - WebSocket/signaling
   - speech command / wake word logic
   - microphone capture and audio playback
   - room/session models
   - user presence / availability / focus mode
   - auth/team token concepts
   - server-side real-time messaging
   - any bridge points where agents could be inserted
```

---

# What the consolidated final answer should contain

After both agents finish, ask for one merged summary with this shape:

## 1. Current system map

* what the app is today
* how client/server interact
* how audio and presence work
* what infrastructure/services exist

## 2. Reusable foundations

* existing capabilities that likely carry forward
* signaling/media/presence pieces that could support agents

## 3. Capability gaps

* missing abstractions for agents
* missing orchestration
* missing speech pipeline boundaries
* missing policy/governance/observability

## 4. Target architecture

* humans
* agents
* media transport
* agent runtime adapters
* orchestration/supervision
* identity/presence
* logging/telemetry

## 5. Phased plan

* first prototype
* second milestone
* production-oriented milestone

## 6. Open questions

* product questions
* architectural questions
* codebase unknowns

---

# My high-level take before code inspection

Based on the deck alone, the most likely transformation path is **not** to replace the realtime voice substrate, but to **extend it** so that agents become another class of participant on top of the same presence/session model. The strongest reusable parts are likely the app’s low-latency voice/session handling, presence concepts like availability and “door open/closed,” and any existing signaling/channel abstractions. 

The main conceptual shift will be from “humans connected by audio” to “participants connected by audio,” where participants may be humans or agents. From there, a clean architecture probably wants:

* a **media layer** for realtime audio transport,
* a **speech layer** for STT/TTS and optional audio-native handling,
* an **agent runtime layer** for model/tool execution,
* and an **orchestration layer** that decides which agent joins, when it speaks, and how multiple agents avoid talking over each other.

The biggest risks are likely latency, conversational turn-taking, feedback loops between speaking agents, and whether the current codebase truly supports reusable room/signaling abstractions versus hard-coding for human desktop clients. The repo inspection will answer that.

Upload the two tarballs and I’ll turn this into a sharper, repo-aware set of instructions with a first-pass map.
