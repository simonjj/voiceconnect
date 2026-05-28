/**
 * MultiAgentSession — replaces single-agent AudioRouter for Phase 2.
 *
 * One instance per WebSocket. Owns:
 *   - shared transcript history (FIFO, capped at HISTORY_CAP)
 *   - the active agents (those with their door open)
 *   - the single STT websocket (one user, one mic)
 *   - the TTS playback queue (sequential per agent, parallel /chat fanout)
 *   - addressing + mode resolution
 *   - interruption handling (abort streams + flush queue)
 *
 * Decisions encoded:
 *   Q3: addressed-with-fallback round-robin, auto-degrade to addressed-only at N>=3
 *   Q5: 30-message FIFO history cap
 *   Q6: full carry-over for newly added agents
 */
import WebSocket from 'ws';
import { config } from './config.js';
import {
  detectAddressees,
  resolveTargets,
  roundRobinOrder,
  type ConversationMode,
} from './addressing.js';
import { TtsQueue } from './tts-queue.js';
import type { Agent, HistoryMessage } from './types.js';

const HISTORY_CAP = 30;
const ADDRESSED_ONLY_AT_N = 3; // Q3 auto-degrade threshold.

export interface SessionCallbacks {
  send: (msg: any) => void;        // JSON msg → client
  sendBinary: (data: Buffer) => void; // PCM frames → client
}

export class MultiAgentSession {
  private clientWs: WebSocket;
  private sttWs: WebSocket | null = null;
  private active: Agent[] = [];
  private history: HistoryMessage[] = [];
  private lastSpeakerId: string | null = null;
  private mode: ConversationMode = 'addressed-with-fallback';
  private sessionId: string;
  private sampleRate: number = 48000;
  private ttsQueue: TtsQueue;
  private inflightAborts: Set<AbortController> = new Set();
  private currentTurnGen = 0;

  constructor(ws: WebSocket, private cb: SessionCallbacks) {
    this.clientWs = ws;
    this.sessionId = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.ttsQueue = new TtsQueue(cb, () => this.sampleRate);
  }

  // ── public API used by index.ts WS handler ──

  setActiveAgents(agents: Agent[]): void {
    const wereActive = new Set(this.active.map((a) => a.id));
    const nowActive = new Set(agents.map((a) => a.id));

    // Q6: full carry-over — newly active agents see full history on first /chat.
    // Implemented implicitly: history is shared, fresh agents read it on next turn.

    // If active set changed at all, ensure STT is connected when N>=1, disconnected when N=0.
    this.active = agents;
    if (this.active.length === 0) {
      this.disconnectStt();
    } else if (!this.sttWs) {
      this.connectStt().catch((e) => this.cb.send({ type: 'error', message: `STT connect failed: ${e?.message ?? e}` }));
    }

    // Auto-degrade mode at N>=3 (Q3).
    const desired: ConversationMode =
      this.active.length >= ADDRESSED_ONLY_AT_N ? 'addressed-only' : 'addressed-with-fallback';
    const autoDegraded = desired !== 'addressed-with-fallback';
    if (this.mode !== desired) {
      this.mode = desired;
    }
    this.cb.send({ type: 'mode', mode: this.mode, auto_degraded: autoDegraded });

    // Notify removed agents went idle (UI clears halo etc.)
    for (const id of wereActive) {
      if (!nowActive.has(id)) this.cb.send({ type: 'agent_done', agent_id: id });
    }
  }

  handleAudio(data: Buffer): void {
    if (this.sttWs?.readyState === WebSocket.OPEN) {
      this.sttWs.send(data);
    }
  }

  /** User barged-in: cancel everything in flight, flush playback. */
  interrupt(): void {
    const turn = this.currentTurnGen;
    this.currentTurnGen++; // invalidate any in-flight closures

    const interruptedIds: string[] = [];
    for (const ac of this.inflightAborts) {
      try { ac.abort(); } catch {}
    }
    this.inflightAborts.clear();
    interruptedIds.push(...this.ttsQueue.flush());

    // Annotate any partial assistant messages we emitted during this turn as interrupted.
    for (const msg of this.history) {
      if (msg.role === 'assistant' && msg.agent_id && interruptedIds.includes(msg.agent_id) && !msg.interrupted) {
        msg.interrupted = true;
      }
    }

    if (interruptedIds.length > 0) {
      this.cb.send({ type: 'interrupted', agent_ids: interruptedIds });
    }
    void turn; // silence unused
  }

  stop(): void {
    this.interrupt();
    this.disconnectStt();
  }

  // ── STT connection (single, shared across all agents) ──

  private async connectStt(): Promise<void> {
    const url = `${config.sttUrl}/transcribe`;
    const ws = new WebSocket(url);
    this.sttWs = ws;

    ws.on('open', () => {
      ws.send(JSON.stringify({ sample_rate: this.sampleRate }));
      console.log(`[MultiAgent ${this.sessionId}] STT connected`);
    });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'transcript' && msg.is_final && msg.text) {
          await this.onTranscriptFinal(msg.text);
        }
      } catch (e) {
        console.error('[MultiAgent] STT message parse error:', e);
      }
    });

    ws.on('error', (err) => {
      console.error('[MultiAgent] STT error:', err.message);
      this.cb.send({ type: 'error', message: 'STT service connection failed' });
    });

    ws.on('close', () => {
      console.log(`[MultiAgent ${this.sessionId}] STT disconnected`);
      if (this.sttWs === ws) this.sttWs = null;
    });
  }

  private disconnectStt(): void {
    if (this.sttWs) {
      try { this.sttWs.close(); } catch {}
      this.sttWs = null;
    }
  }

  // ── core turn handling ──

  private async onTranscriptFinal(rawText: string): Promise<void> {
    const turn = ++this.currentTurnGen;
    this.cb.send({ type: 'transcript', text: rawText });

    if (this.active.length === 0) return; // nothing to do

    const detection = detectAddressees(rawText, this.active);
    const targets = resolveTargets(detection, this.active, this.mode, this.lastSpeakerId ?? undefined);
    if (targets.length === 0) return; // addressed-only with no addressee → silence

    const orderedTargets = roundRobinOrder(targets, this.lastSpeakerId ?? undefined);

    // Append user turn to history (use cleaned text so agents don't have to parse "hey X,").
    this.appendHistory({ role: 'user', content: detection.cleanedText || rawText });

    // Fan out parallel /chat calls. Each yields a sentence-streaming generator.
    const streams = orderedTargets.map((agent) =>
      this.startAgentChat(agent, this.history.slice(), turn));

    // Process them in order: first agent fully drained → second, etc.
    for (let i = 0; i < orderedTargets.length; i++) {
      if (turn !== this.currentTurnGen) return; // interrupted
      const agent = orderedTargets[i];
      const stream = streams[i];
      try {
        const fullReply = await this.ttsQueue.consumeAgentStream(agent, stream, turn, () => this.currentTurnGen);
        if (fullReply) {
          this.appendHistory({ role: 'assistant', name: agent.name, agent_id: agent.id, content: fullReply });
          this.lastSpeakerId = agent.id;
        }
        this.cb.send({ type: 'agent_done', agent_id: agent.id });
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          console.error(`[MultiAgent] agent ${agent.id} failed:`, e?.message ?? e);
          this.cb.send({ type: 'error', message: `${agent.name}: ${e?.message ?? 'failed'}` });
        }
      }
    }
  }

  /**
   * Starts a /chat HTTP call to an agent and returns an async iterator of text deltas.
   * Aborts cleanly on interrupt.
   */
  private async *startAgentChat(
    agent: Agent,
    history: HistoryMessage[],
    turn: number,
  ): AsyncGenerator<string, void, void> {
    this.cb.send({ type: 'agent_thinking', agent_id: agent.id });

    const ac = new AbortController();
    this.inflightAborts.add(ac);

    let response: Response;
    try {
      response = await fetch(`${agent.url}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: history[history.length - 1]?.content ?? '',
          session_id: this.sessionId,
          history,
          self_name: agent.name,
        }),
        signal: ac.signal,
      });
    } catch (e: any) {
      this.inflightAborts.delete(ac);
      throw e;
    }

    if (!response.ok || !response.body) {
      this.inflightAborts.delete(ac);
      throw new Error(`Agent returned ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        if (turn !== this.currentTurnGen) {
          try { ac.abort(); } catch {}
          break;
        }
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
              yield evt.content;
            } else if (evt.type === 'error' && evt.content) {
              throw new Error(evt.content);
            }
            // 'done' is implicit when stream closes.
          } catch (e) {
            if (e instanceof SyntaxError) continue; // tolerate stray non-JSON lines
            throw e;
          }
        }
      }
    } finally {
      this.inflightAborts.delete(ac);
      try { reader.releaseLock(); } catch {}
    }
  }

  private appendHistory(m: HistoryMessage): void {
    this.history.push(m);
    if (this.history.length > HISTORY_CAP) {
      this.history = this.history.slice(-HISTORY_CAP);
    }
  }
}
