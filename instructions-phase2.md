# Instructions — Phase 2 (Real-Time Multi-Agent)

> **Reference:** See [`phase2-plan.md`](./phase2-plan.md) for the full architectural plan,
> rationale, and design principles. This file is the **authoritative task list and detailed
> instructions** that drive Phase 2 implementation.

---

## 0. Status

- [ ] Instructions reviewed and finalized
- [ ] Implementation started
- [ ] Phase 2 deployed to ACA

---

## 1. Decisions (locked)

| # | Question | Decision |
|---|---|---|
| 1 | Second agent (GPT / Gemini / local) | **All agents are Sandbox agents** — single generic service, deployed N times. Each instance owns one ACA Sandbox running Copilot CLI. Different models become a config flag in a later phase. |
| 2 | Address grammar to support | **Standard** — `"hey {name}"`, `"{name},"`, `"{name}:"`, plus broadcast keywords `team` / `both` / `everyone`. |
| 3 | Default conversation mode | **Addressed-with-fallback (round-robin)** — un-addressed utterances trigger all active agents in alternating order. Auto-degrade to **addressed-only** when N ≥ 3 active agents. |
| 4 | Interruption barge-in threshold | **Balanced** — VAD ≥ 0.6 sustained ≥ 250 ms cancels playback + aborts in-flight `/chat`. |
| 5 | History cap (messages / tokens) | **30 messages** shared per session, FIFO eviction. Cap is per-session, all agents see the same window. |
| 6 | Mid-session agent add: carry history or cold start? | **Full carry-over** — newly added agent receives the full 30-msg window on its first call. |
| 7 | Client visual style for multi-active | **Door open** = user can address agent (selection state). **Halo glow** = ON only while agent is producing audio (no thinking pulse). Each agent gets an **accent color** driving halo + **color-coded transcript bubbles** with agent name. |

---

## 2. Detailed instructions

<!--
  Fill in the specifics below. Each section corresponds to a deliverable in §12 of the plan.
  Use the sub-headings as a skeleton; expand each with: behavior spec, file locations,
  data shapes, edge cases, acceptance criteria.
-->

### 2.1 Sandbox-agent service (`services/agents/sandbox/`)

This is the **only** agent service. Replaces the existing `services/agents/claude/`.
Deployed N times as separate container apps, each instance configured for one persona
and bound to one ACA Sandbox.

- **Runtime:** Python (FastAPI) or Node — TBD (Python keeps consistency with existing services).
- **Per-instance config (env vars):**
  - `AGENT_ID`        — logical id (e.g. `aria`)
  - `AGENT_NAME`      — display name (e.g. `Aria`)
  - `AGENT_VOICE`     — Kokoro voice id (e.g. `af_sky`)
  - `AGENT_COLOR`     — accent color hex (e.g. `#3b82f6`)
  - `SANDBOX_GROUP`   — name of the ACA sandbox group
  - `SANDBOX_DISK`    — name of pre-baked disk image with Copilot CLI installed (e.g. `copilot-cli-v1`)
  - `SANDBOX_NAME`    — stable name for this agent's sandbox (e.g. `aria-sb`); auto-create if missing
  - `AZURE_SUBSCRIPTION_ID`, `ACA_RESOURCE_GROUP`
  - `GH_TOKEN` (secret)  — Copilot-enabled token mounted into the sandbox
- **Identity:** user-assigned managed identity with `Container Apps SandboxGroup Data Owner` on the sandbox group.
- **Lifecycle:**
  - On startup: ensure sandbox exists (`aca sandbox get` → create if missing) and is running.
  - Idle timeout: ACA Sandbox `autoSuspendPolicy` (e.g. 600 s) handles cold-park; agent service detects suspended state and resumes on next `/chat`.
- **`/chat` flow per turn:**
  1. Receive `{ text, session_id, history, self_name }`
  2. Prepend system prompt (voice-friendly: "1–2 spoken sentences, summarize, don't dump command output").
  3. Render history into a single prompt block.
  4. `aca sandbox exec --id $SANDBOX_NAME -c "copilot -p '<prompt>' --allow-all-tools"` (exact flags TBD against current Copilot CLI version).
  5. Stream stdout → parse → emit NDJSON `{type:'text', content:...}` chunks.
  6. Emit `{type:'done'}` when sandbox process exits.
- **`GET /agent-card`:** returns `{ id, name, voice_id, color, capabilities }`.
- **Acceptance:** two instances (e.g. `Aria`, `Nova`) deploy and reply via voice, each from its own isolated sandbox, with distinct voices and accent colors.

### 2.2 Pre-baked Copilot CLI disk image

- Use `aca sandboxgroup disk create --image <base>` to bake an image with:
  - Node.js 22+
  - `@github/copilot` CLI installed globally
  - Any other tooling commonly needed (git, curl, jq)
- Name the disk image `copilot-cli-v1`. Versioned so future re-bakes don't break running agents.
- **Acceptance:** sandbox boots in <5s with Copilot CLI on PATH.

### 2.3 ACA Sandbox group + managed identity setup

- One sandbox group (e.g. `voiceconnect-sb`) shared by all agents in the same RG.
- System-assigned identity on the sandbox group with `Container Apps SandboxGroup Data Owner`.
- Each agent container app uses its own user-assigned MI to call the ACA control plane (`aca sandbox exec`).
- Egress policy on each sandbox: deny by default; allow `*.github.com`, `api.githubcopilot.com`, anything Copilot CLI needs.
- **Acceptance:** `aca doctor` passes from inside an agent container.

### 2.4 Updated `/chat` protocol (sandbox agent)

- Accept new optional fields: `history`, `self_name`
- Backward-compatible if omitted (single-agent fallback)
- Schema: see `phase2-plan.md` §5

### 2.5 `server/src/multi-agent-session.ts`

- Replaces `AudioRouter` as the per-WebSocket session owner
- Owns: `activeAgents`, `history`, `mode`, `lastSpeaker`, single STT connection, TTS queue
- Implements addressed-with-fallback round-robin (Q3 decision)
- 30-message FIFO history cap (Q5 decision)
- Newly-added agents receive full window on first call (Q6 decision)

### 2.6 `server/src/addressing.ts`

- Pure function `detectAddressees(transcript, agents) → { addressees: Agent[], cleanedText: string }`
- Recognizes `"hey {name}"`, `"{name},"`, `"{name}:"`, broadcast `team`/`both`/`everyone`
- Strips the address prefix from `cleanedText` so agents don't repeat back "hey Aria"
- Case-insensitive, normalizes whitespace, matches first 4 words only

### 2.7 `server/src/tts-queue.ts`

- Fan-out parallel `/chat` calls (all addressees start generating at once)
- Sequential TTS playback in round-robin order (last-speaker-first alternation)
- Each chunk tagged `{ agent_id, sequence }` for client-side attribution
- Abort on `interrupt` message: cancel in-flight `/chat` AbortControllers, flush queue
- Single Kokoro voice param per agent (`voice_id` from registration)

### 2.8 Client UX

- **Multi-select:** clicking an agent toggles its door (open = active, closed = inactive). Multiple doors can be open at once.
- **Speaking indicator:** halo glow ON only while that agent's TTS is actively playing; OFF otherwise. No thinking-state visual.
- **Transcript:** color-coded bubble per message, agent name + accent color from `AGENT_COLOR`.
- **Mode selector:** small dropdown showing current mode (`addressed-with-fallback` / `addressed-only` / `single`); mostly auto-managed.
- **Auto-degrade visualisation:** if N ≥ 3 active agents, show a small "addressed-only" hint below the mode pill.

### 2.9 Interruption (Q4 decision)

- Client VAD threshold ≥ 0.6 sustained ≥ 250 ms while playback is active
- Client emits `{ type: 'interrupt' }` on the WS, immediately stops audio playback locally
- Server: abort all in-flight `/chat` streams; clear TTS queue; mark partial messages in history with `interrupted: true`
- Begin new STT capture immediately

### 2.10 Bicep / deploy

- New `infra/agent.bicep` module — parameterized container app for one sandbox-agent instance
- `infra/main.bicep` — loops over an `agents[]` parameter to deploy N instances
- Add ACA sandbox group + disk image bake step (one-time, scripted in `infra/bake-disk.ps1`)
- Remove or convert `voiceconnect-claude` (replaced by sandbox-agent instances)
- `infra/deploy.ps1` updated: registers each deployed agent with the server via `POST /api/agents`

### 2.11 Test plan (`testing-phase2.md`)

Manual verification matrix:

- Single-agent regression (only one agent selected)
- Two agents, "hey {name}" → only that agent replies, in its voice
- Two agents, un-addressed utterance → both reply in alternating order (round-robin)
- Broadcast: "team, ..." → both reply
- Mid-conversation barge-in: agent stops within ~250 ms of user speaking
- Add a second agent mid-session → it gets full carry-over and joins coherently
- Drop an agent (close door) mid-session → no more replies from it
- N=3: confirm auto-degrade to addressed-only kicks in
- N=4: stress test; confirm no audio overlap, history bounded
- Sandbox auto-suspend → resume on next turn (cold path latency acceptable)

---

## 3. Out of scope for Phase 2 (explicit non-goals)

- Electron / desktop packaging
- Agent-to-agent direct calls
- Moderated mode (orchestrator agent)
- Tool use / function calling integration
- Shared persistent memory across sessions
- Mobile-specific UI

---

## 4. Acceptance criteria (Phase 2 done = all true)

- [ ] Two sandbox-agent instances (e.g. `Aria` + `Nova`) registered, each backed by its own ACA Sandbox running Copilot CLI
- [ ] User can open multiple agent doors simultaneously to make them active
- [ ] User says "hey {name}, ..." → only that agent replies, in its own voice + accent color
- [ ] Un-addressed utterance → both agents reply in round-robin (alternating across turns), with full shared context
- [ ] Audio never overlaps; per-agent halo glow lights up only while that agent is speaking
- [ ] Transcript shows color-coded bubbles per agent
- [ ] User can interrupt any agent by speaking; playback stops within ~250 ms
- [ ] Mid-session add: closed door → opened door, agent receives full 30-msg history on first call
- [ ] Single-agent flow still works (close one of the two doors → single-agent regression OK)
- [ ] N=3 active agents → auto-degrade hint visible; un-addressed utterances do not trigger any agent
- [ ] Deployed and reachable at the public ACA URL
