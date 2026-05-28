# Phase 2 — Real-Time Multi-Agent Plan

> **Goal:** Make Connect feel like a natural, real-time conversation with **2 active agents
> simultaneously today, scaling to 4 in the future** — without exploding system complexity.
> **Scope:** No Electron. All in-browser, server orchestrated. Backend already on ACA + serverless GPU.
> **Agent type:** All agents are uniform "Sandbox agents" — generic service deployed N times,
> each backed by a dedicated ACA Sandbox running Copilot CLI. Different models become a future
> per-instance config flag.

---

## 1. Design principles

| Principle | Why |
|---|---|
| **One STT stream per user** | User is the only mic; reuse existing stream. Simple. |
| **Server-side fan-out** | Server is the single source of truth for conversation state; agents stay dumb. |
| **Shared transcript log** | Every agent sees what every other agent (and the user) said. Cheap context-passing. |
| **Sequential TTS playback** | Two voices overlapping = chaos. One speaks, then the other. Natural. |
| **Per-agent voice** | Already supported via `voice_id`. Different voices = clearly distinct speakers. |
| **Stateless agents** | Server passes full history each turn. Agents need no cross-talk wiring. |
| **No agent↔agent calls** | Avoids feedback loops, latency stacking, and combinatorial complexity. |
| **Opt-in addressing** | "Hey Claude, ..." routes to one agent only. Unaddressed = fan-out. |

The whole design fits in three new concepts: **MultiAgentSession**, **shared history**, **TTS playback queue**.

---

## 2. Architectural changes (overview)

```
                           ┌──────────────────────────┐
   Browser  ──ws──>        │  MultiAgentSession       │
   (mic)                   │   - activeAgents[]       │
                           │   - history[]            │
                           │   - addressing policy    │
                           └────────┬─────────────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                ▼                   ▼                   ▼
            STT (1)            Agent A /chat       Agent B /chat
        (user audio)           (parallel)          (parallel)
                ▲                   │                   │
                │                   └────┬──────────────┘
                │                        │
                │              ┌─────────▼──────────┐
                │              │  TTS Playback Queue│
                │              │  (per-agent voice, │
                │              │   sequential)       │
                │              └─────────┬──────────┘
                │                        │
                └────── ws audio out ────┘
```

**Key change:** Replace `clientSessions: Map<WebSocket, AudioRouter>` with
`Map<WebSocket, MultiAgentSession>`. The session owns all routers, the history, and the TTS queue.

---

## 3. Conversation modes

Configurable per session. Default: `addressed-with-fallback`.

| Mode | Behavior |
|---|---|
| **single** | Old behavior. One active agent. (Backward compat.) |
| **addressed** | Only the named agent responds. If no name detected → no one. |
| **addressed-with-fallback** ★ | Named agent responds; if no name → all active agents respond in round-robin order. |
| **panel** | Every utterance → every active agent responds in round-robin order. |
| **moderated** *(future)* | A "moderator" agent picks who responds. Defer. |

★ = default, the sweet spot for "feels natural with 2-4 agents".

---

## 4. Address detection (cheap)

Pure prefix match on transcript, case-insensitive, first 4 words:

```
"hey claude, what do you think?"   → addressed=[claude]
"claude:"                          → addressed=[claude]
"both of you, weigh in"            → addressed=[*] (all active)
"team, ..."                        → addressed=[*]
"what's the weather"               → addressed=[] → fallback to round-robin
```

Implementation: 30 lines, no NLP. Built from each agent's `name` + lowercased `id`.
Strip the address prefix before sending to the agent.

---

## 5. Shared history protocol

Extend the agent `POST /chat` contract:

```jsonc
// Before (phase 1):
{ "text": "hello", "session_id": "s-123" }

// After (phase 2):
{
  "text": "hello",
  "session_id": "s-123",
  "history": [
    { "role": "user", "content": "what's the weather" },
    { "role": "assistant", "name": "Claude", "content": "I don't have weather data." },
    { "role": "assistant", "name": "GPT",    "content": "I'll check — Stockholm is 18°C." },
    { "role": "user", "content": "hey claude, what would you wear?" }
  ],
  "self_name": "Claude"   // helps the agent know "name=Claude is me"
}
```

System prompt template the server prepends server-side (per agent):

> You are **{self_name}**, one of several AI assistants in a live voice conversation.
> Other participants you may see in `history`: {peer_names}.
> Keep replies short and conversational (1–2 sentences) since they are spoken aloud.
> Do not roleplay other speakers; only reply as yourself.

**Backward compat:** if an agent ignores `history`, it still works in single-agent mode.

---

## 6. TTS playback queue (the "natural" trick)

Each agent's response streams to the server → server hands chunks to TTS → TTS returns PCM →
server forwards to client tagged with `{ agent_id, sequence }`. Client plays PCM in order,
chunked by agent. While Agent A is playing, Agent B's chunks queue.

**Round-robin ordering when fanout:** server starts both `/chat` calls in parallel but
**chooses a primary speaker** (last-spoken alternation) and lets them speak first; the other
queues behind. Net effect: zero wasted thinking time — both have already started generating
when you hear the first one start talking.

Pseudocode:

```ts
async function onTranscriptFinal(text) {
  const targets = pickAddressees(text, session.activeAgents); // [a,b] or [a] or []
  if (targets.length === 0) targets.push(...session.activeAgents); // fallback
  session.history.push({ role: 'user', content: text });

  // Fan out in parallel — all agents start thinking immediately
  const streams = targets.map(a =>
    startAgentChat(a, text, session.history, session.activeAgents));

  // But play TTS in deterministic round-robin order
  const orderedTargets = roundRobinOrder(targets, session.lastSpeaker);
  for (const [agent, stream] of zip(orderedTargets, streams)) {
    const reply = await ttsAndForward(agent, stream); // streams to client, waits for done
    session.history.push({ role: 'assistant', name: agent.name, content: reply });
    session.lastSpeaker = agent.id;
  }
}
```

Key win: **agents think in parallel, audio plays in sequence**. With 2 agents this halves
perceived latency compared to fully serial.

---

## 7. Client UX changes (small)

Today: pick one agent → door opens → talk.

Phase 2: pick **multiple agents** (Shift+click, or toggle) → all selected agents glow as "active".
While talking:
- Agent pulses ring color = `thinking` (their /chat call is mid-flight)
- Agent radiates outward = `speaking` (their TTS is playing now)
- Transcript pane shows who said what, color-coded per agent

Add a small **"active panel" bar** at the top: `[Claude] [GPT]   mode: panel▾`.

No drag-and-drop, no chat windows per agent — just per-message attribution.

---

## 8. Interruption (real-time feel booster)

When user starts speaking while agent audio is playing:
1. Client: stop playback, send `{ type: 'interrupt' }`
2. Server: abort any in-flight `/chat` streams; flush TTS queue
3. Mark interrupted message in history: `{ role: 'assistant', name: 'X', content: '(partial: ...)', interrupted: true }`
4. Begin new STT capture

Implementation: ~50 lines. AbortController on the fetch + queue.clear().
Big payoff for "natural" feel — you can talk over an agent like a human.

---

## 9. Scaling to 4 agents

Things that change with N>2:
- **Fanout cost**: 4× /chat calls in parallel. Each is cheap (NDJSON stream), GPU TTS is the bottleneck. Mitigate with TTS streaming + audio prefetch.
- **Cacophony risk**: panel mode with 4 voices = exhausting. At N=3+, change default mode to `addressed` and only fan out when user says "team" / "everyone".
- **Token budget**: history grows linearly. Cap to last 30 messages.
- **Visual real estate**: 4 agents already fits the current UI. >4 would need redesign.

No code changes needed at N=4 if these defaults are in place from day one.

---

## 10. Cost / complexity dial

| Feature | Lines of code (est.) | User-perceived value |
|---|---|---|
| MultiAgentSession + history | 200 | high (foundation) |
| Add second agent service (GPT) | 80 + Dockerfile | high (proves it) |
| Address detection | 40 | high |
| Sequential TTS queue with parallel /chat | 120 | high |
| Client agent multi-select + attribution | 150 | high |
| Interruption | 60 | high |
| Moderated mode | 200 | medium (defer) |
| Agent-to-agent calls | (don't) | trap |

Total Phase 2 core: ~650 LOC across 6 files. Manageable.

---

## 11. Migration / rollout

1. **Keep single-agent mode working** — `MultiAgentSession` with `activeAgents.length===1` ≡ today's behavior.
2. **Ship GPT agent service** alongside Claude. Two agents = real test.
3. **Default new sessions to `addressed-with-fallback`**.
4. **Feature-flag panel mode** in the client UI.
5. **No breaking changes to existing `/api/agents` registration** — multi-agent is purely additive on top of the WebSocket protocol.

---

## 12. Phase 2 deliverables (high-level checklist)

- [ ] `services/agents/gpt/` — second agent (OpenAI proxy, mirrors Claude shape)
- [ ] Agent `/chat` protocol bump: accept `history`, `self_name`; tolerate omission
- [ ] `server/src/multi-agent-session.ts` — replaces single `AudioRouter`
- [ ] `server/src/addressing.ts` — name-prefix detector
- [ ] `server/src/tts-queue.ts` — sequenced playback orchestration
- [ ] Client: multi-select agents, color-coded transcript, "speaking" indicator
- [ ] Client: interruption handling (mic priority over playback)
- [ ] Bicep: add `voiceconnect-gpt` container app to deployment
- [ ] Update `testing-phase2.md` with the new manual test matrix

---

## 13. Open questions for instructions-phase2.md

Things to lock down before implementation begins:

1. **Second agent: GPT, Gemini, or a local model?** (affects service Dockerfile + auth)
2. **Address grammar**: only "hey {name}" or also "{name}:" + "{name}, ..." + "team" + "both"?
3. **Mode default**: `addressed-with-fallback` (what I'm proposing) or `panel` (always fan out)?
4. **Interruption barge-in threshold**: any mic activity above VAD threshold, or only after a full STT-final transcript?
5. **History cap**: 30 messages? Token budget per agent?
6. **Should disabled agents still see history when you "add" them mid-session?** (carry-over vs cold start)
7. **Visual style**: panel-bar at top vs agents only? Color palette per agent?
