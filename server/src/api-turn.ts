/**
 * /api/turn — text-only turn handler used by the Twilio bridge (and any other
 * text-channel client). Reuses the addressing + fan-out logic from
 * MultiAgentSession but without WS, STT, or TTS — just NDJSON text in, NDJSON
 * text out.
 *
 * Request:
 *   POST /api/turn?token=...
 *   { session_id: string, transcript: string, agent_ids?: string[] }
 *
 * agent_ids defaults to every registered agent — Twilio callers don't need to
 * know who's online.
 *
 * Response (application/x-ndjson, one JSON object per line):
 *   { type: 'transcript', text }                            — cleaned user turn
 *   { type: 'agent_thinking', agent_id }                    — before /chat call
 *   { type: 'text', agent_id, content }                     — streaming delta
 *   { type: 'agent_done', agent_id, reply }                 — full assistant reply
 *   { type: 'error', agent_id?, message }                   — non-fatal per agent
 *   { type: 'done' }                                         — turn complete
 *
 * Per-session state (history, lastSpeakerId, mode) is kept in memory keyed by
 * session_id with a 30-minute idle TTL. The bridge uses the Twilio CallSid as
 * session_id, so all turns in one phone call share context.
 */
import type { Request, Response } from 'express';
import { listAgents, getAgent } from './db.js';
import {
  detectAddressees,
  resolveTargets,
  roundRobinOrder,
  type ConversationMode,
} from './addressing.js';
import type { Agent, HistoryMessage } from './types.js';

const HISTORY_CAP = 30;
const SESSION_TTL_MS = 30 * 60 * 1000;
const ADDRESSED_ONLY_AT_N = 3;

interface TurnState {
  history: HistoryMessage[];
  lastSpeakerId: string | null;
  lastUsed: number;
}

const sessions = new Map<string, TurnState>();

function getOrCreateState(sessionId: string): TurnState {
  let s = sessions.get(sessionId);
  if (s && Date.now() - s.lastUsed > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    s = undefined;
  }
  if (!s) {
    s = { history: [], lastSpeakerId: null, lastUsed: Date.now() };
    sessions.set(sessionId, s);
  }
  s.lastUsed = Date.now();
  return s;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of sessions) {
    if (now - v.lastUsed > SESSION_TTL_MS) sessions.delete(k);
  }
}, 5 * 60 * 1000).unref();

function appendHistory(state: TurnState, m: HistoryMessage): void {
  state.history.push(m);
  if (state.history.length > HISTORY_CAP) {
    state.history.splice(0, state.history.length - HISTORY_CAP);
  }
}

function ndjson(res: Response, obj: unknown): void {
  if (!res.writableEnded) res.write(JSON.stringify(obj) + '\n');
}

async function* streamAgentChat(
  agent: Agent,
  history: HistoryMessage[],
  sessionId: string,
  signal: AbortSignal,
): AsyncGenerator<{ type: 'text'; content: string } | { type: 'debug'; kind?: string; content: string }, void, void> {
  const response = await fetch(`${agent.url}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: history[history.length - 1]?.content ?? '',
      session_id: sessionId,
      history,
      self_name: agent.name,
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Agent ${agent.id} returned ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const evt = JSON.parse(trimmed);
          if (evt.type === 'text' && typeof evt.content === 'string') {
            yield { type: 'text', content: evt.content };
          } else if (evt.type === 'debug' && typeof evt.content === 'string') {
            yield { type: 'debug', kind: typeof evt.kind === 'string' ? evt.kind : undefined, content: evt.content };
          } else if (evt.type === 'error' && evt.content) {
            throw new Error(evt.content);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
}

export async function handleTurn(req: Request, res: Response): Promise<void> {
  const sessionId = String(req.body?.session_id ?? '').trim();
  const transcript = String(req.body?.transcript ?? '').trim();
  if (!sessionId || !transcript) {
    res.status(400).json({ error: 'session_id and transcript are required' });
    return;
  }

  // Resolve active agents — caller-provided IDs if any, else everything registered.
  const requestedIds: string[] | undefined = Array.isArray(req.body?.agent_ids)
    ? req.body.agent_ids
    : undefined;
  const allAgents = listAgents();
  const active: Agent[] = (requestedIds
    ? requestedIds.map((id) => getAgent(id)).filter((a): a is Agent => !!a)
    : allAgents);
  if (active.length === 0) {
    res.status(503).json({ error: 'no agents available' });
    return;
  }

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const state = getOrCreateState(sessionId);
  const detection = detectAddressees(transcript, active);
  const mode: ConversationMode =
    active.length >= ADDRESSED_ONLY_AT_N ? 'addressed-only' : 'addressed-with-fallback';
  const targets = resolveTargets(detection, active, mode, state.lastSpeakerId ?? undefined);

  ndjson(res, { type: 'transcript', text: detection.cleanedText || transcript });

  if (targets.length === 0) {
    // addressed-only with no addressee → silence; close cleanly.
    ndjson(res, { type: 'done' });
    res.end();
    return;
  }

  const ordered = roundRobinOrder(targets, state.lastSpeakerId ?? undefined);
  appendHistory(state, { role: 'user', content: detection.cleanedText || transcript });

  const ac = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ac.abort(); });

  // Run agents sequentially so the bridge can stream their replies to TTS in
  // order. Parallel fan-out would jumble Twilio audio output.
  for (const agent of ordered) {
    ndjson(res, { type: 'agent_thinking', agent_id: agent.id });
    let reply = '';
    try {
      for await (const evt of streamAgentChat(agent, state.history.slice(), sessionId, ac.signal)) {
        if (ac.signal.aborted) break;
        if (evt.type === 'text') {
          reply += evt.content;
          ndjson(res, { type: 'text', agent_id: agent.id, content: evt.content });
        } else if (evt.type === 'debug') {
          ndjson(res, { type: 'debug', agent_id: agent.id, kind: evt.kind, content: evt.content });
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes('abort')) break;
      ndjson(res, { type: 'error', agent_id: agent.id, message: msg });
      continue;
    }
    if (reply.trim()) {
      appendHistory(state, { role: 'assistant', name: agent.name, agent_id: agent.id, content: reply });
      state.lastSpeakerId = agent.id;
    }
    ndjson(res, { type: 'agent_done', agent_id: agent.id, reply });
  }

  ndjson(res, { type: 'done' });
  res.end();
}
