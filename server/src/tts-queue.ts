/**
 * TtsQueue — sequenced TTS playback for multi-agent.
 *
 * Strategy:
 *   - Agents stream text deltas in parallel (fanned out by MultiAgentSession).
 *   - This queue consumes ONE agent's stream at a time (sequential playback).
 *   - It buffers text deltas into sentences, calls Kokoro TTS for each sentence,
 *     forwards binary PCM to the client wrapped in `agent_speaking_start` /
 *     `agent_speaking_end` JSON messages so the client knows whose voice it is.
 *   - On interrupt, flush() returns the agent_ids that were partway through
 *     speaking so the session can mark their history entries as interrupted.
 */
import { config } from './config.js';
import type { Agent } from './types.js';

interface SessionLike {
  send: (msg: any) => void;
  sendBinary: (data: Buffer) => void;
}

const SENTENCE_END = /[.!?]\s*$/;
const MAX_BUFFER = 200;

export class TtsQueue {
  private currentlySpeakingAgentIds: Set<string> = new Set();
  private sequence = 0;

  constructor(private cb: SessionLike, private getSampleRate: () => number) {}

  /**
   * Drain one agent's text stream end-to-end:
   *   - buffer deltas into sentences
   *   - synthesize each sentence via TTS
   *   - send binary PCM to the client (wrapped with start/end JSON)
   *
   * @returns the full concatenated reply (for history), or null if nothing was produced.
   */
  async consumeAgentStream(
    agent: Agent,
    stream: AsyncGenerator<string, void, void>,
    turn: number,
    currentTurn: () => number,
  ): Promise<string | null> {
    let sentenceBuffer = '';
    let fullReply = '';

    const flushSentence = async (): Promise<void> => {
      const text = sentenceBuffer.trim();
      sentenceBuffer = '';
      if (!text) return;
      if (turn !== currentTurn()) return;
      await this.synthesizeAndSend(agent, text);
    };

    try {
      for await (const delta of stream) {
        if (turn !== currentTurn()) break;
        sentenceBuffer += delta;
        fullReply += delta;
        if (SENTENCE_END.test(sentenceBuffer) || sentenceBuffer.length > MAX_BUFFER) {
          await flushSentence();
        }
      }
      await flushSentence();
    } catch (e) {
      // Re-throw so caller can decide; queue is robust either way.
      throw e;
    }

    return fullReply || null;
  }

  /**
   * Cancel everything currently audible. Returns the agent ids that were mid-speech.
   * (Caller annotates their history entries as interrupted.)
   */
  flush(): string[] {
    const ids = Array.from(this.currentlySpeakingAgentIds);
    for (const id of ids) {
      this.cb.send({ type: 'agent_speaking_end', agent_id: id, sequence: this.sequence });
    }
    this.currentlySpeakingAgentIds.clear();
    return ids;
  }

  private async synthesizeAndSend(agent: Agent, text: string): Promise<void> {
    const seq = ++this.sequence;
    const ac = new AbortController();
    let response: Response;
    try {
      response = await fetch(`${config.ttsUrl}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice_id: agent.voice_id, speed: 1.0 }),
        signal: ac.signal,
      });
    } catch (e: any) {
      console.error(`[TtsQueue] TTS fetch failed for ${agent.id}:`, e?.message ?? e);
      return;
    }

    if (!response.ok || !response.body) {
      console.error(`[TtsQueue] TTS returned ${response.status} for ${agent.id}`);
      return;
    }

    const sampleRate = parseInt(response.headers.get('X-Sample-Rate') || '24000');

    this.currentlySpeakingAgentIds.add(agent.id);
    this.cb.send({
      type: 'agent_speaking_start',
      agent_id: agent.id,
      agent_name: agent.name,
      text,
      sample_rate: sampleRate,
      sequence: seq,
    });

    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          this.cb.sendBinary(Buffer.from(value));
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error(`[TtsQueue] TTS stream error for ${agent.id}:`, e?.message ?? e);
      }
    } finally {
      try { reader.releaseLock(); } catch {}
      this.currentlySpeakingAgentIds.delete(agent.id);
      this.cb.send({ type: 'agent_speaking_end', agent_id: agent.id, sequence: seq });
    }
  }
}
