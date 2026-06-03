import WebSocket from 'ws';
import { config } from './config.js';
import { voicify } from './voicify.js';
import type { Agent } from './types.js';

// Per-turn cap on how many *spoken* characters we'll synthesize. Mirrors the
// TtsQueue guardrail so single-agent (audio-router) and multi-agent paths
// behave the same. UI still gets the full text via onAgentSpeaking().
const VOICE_TTS_BUDGET = Number(process.env.VOICE_TTS_BUDGET_CHARS ?? '600');

export class AudioRouter {
  private clientWs: WebSocket;
  private sttWs: WebSocket | null = null;
  private agent: Agent;
  private sessionId: string;
  private sampleRate: number = 48000;
  private isActive: boolean = false;

  private onTranscript: (text: string) => void;
  private onAgentSpeaking: (text: string) => void;
  private onAgentThinking: () => void;
  private onAgentDone: () => void;
  private onTtsConfig: (sampleRate: number) => void;
  private onError: (error: string) => void;

  get agentId(): string {
    return this.agent.id;
  }

  constructor(
    clientWs: WebSocket,
    agent: Agent,
    callbacks: {
      onTranscript: (text: string) => void;
      onAgentSpeaking: (text: string) => void;
      onAgentThinking: () => void;
      onAgentDone: () => void;
      onTtsConfig: (sampleRate: number) => void;
      onError: (error: string) => void;
    },
  ) {
    this.clientWs = clientWs;
    this.agent = agent;
    this.sessionId = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.onTranscript = callbacks.onTranscript;
    this.onAgentSpeaking = callbacks.onAgentSpeaking;
    this.onAgentThinking = callbacks.onAgentThinking;
    this.onAgentDone = callbacks.onAgentDone;
    this.onTtsConfig = callbacks.onTtsConfig;
    this.onError = callbacks.onError;
  }

  async start(sampleRate: number = 48000): Promise<void> {
    this.sampleRate = sampleRate;
    this.isActive = true;

    const sttUrl = `${config.sttUrl}/transcribe`;
    this.sttWs = new WebSocket(sttUrl);

    this.sttWs.on('open', () => {
      this.sttWs!.send(JSON.stringify({ sample_rate: this.sampleRate }));
      console.log(`[AudioRouter] STT connected for ${this.agent.name}`);
    });

    this.sttWs.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'transcript' && msg.is_final && msg.text) {
          this.onTranscript(msg.text);
          await this.sendToAgent(msg.text);
        }
      } catch (e) {
        console.error('[AudioRouter] STT message parse error:', e);
      }
    });

    this.sttWs.on('error', (err) => {
      console.error('[AudioRouter] STT error:', err.message);
      this.onError('STT service connection failed');
    });

    this.sttWs.on('close', () => {
      console.log('[AudioRouter] STT disconnected');
    });
  }

  handleAudio(data: Buffer): void {
    if (this.sttWs?.readyState === WebSocket.OPEN) {
      this.sttWs.send(data);
    }
  }

  private async sendToAgent(text: string): Promise<void> {
    if (!this.isActive) return;
    this.onAgentThinking();

    try {
      const response = await fetch(`${this.agent.url}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, session_id: this.sessionId }),
      });

      if (!response.ok || !response.body) {
        this.onError(`Agent returned ${response.status}`);
        this.onAgentDone();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let sentenceBuffer = '';
      let spokenChars = 0;
      let budgetExceededLogged = false;

      const flushSentence = async (): Promise<void> => {
        const t = sentenceBuffer.trim();
        sentenceBuffer = '';
        if (!t) return;
        if (VOICE_TTS_BUDGET > 0 && spokenChars >= VOICE_TTS_BUDGET) {
          if (!budgetExceededLogged) {
            console.log(
              `[AudioRouter] agent=${this.agent.id} hit voice budget ${VOICE_TTS_BUDGET}, ` +
              `dropping remaining sentences from TTS.`,
            );
            budgetExceededLogged = true;
          }
          // Surface text to UI even when we stop speaking, so user sees the rest.
          this.onAgentSpeaking(t);
          return;
        }
        spokenChars += t.length;
        await this.synthesizeAndSend(t);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'text') {
              sentenceBuffer += event.content;
              if (/[.!?]\s*$/.test(sentenceBuffer) || sentenceBuffer.length > 200) {
                await flushSentence();
              }
            } else if (event.type === 'done') {
              if (sentenceBuffer.trim()) {
                await flushSentence();
              }
            } else if (event.type === 'error') {
              this.onError(event.content);
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      this.onAgentDone();
    } catch (err: any) {
      this.onError(`Agent communication failed: ${err.message}`);
      this.onAgentDone();
    }
  }

  private async synthesizeAndSend(text: string): Promise<void> {
    if (!this.isActive) return;
    const spoken = voicify(text);
    if (!spoken) return;
    this.onAgentSpeaking(spoken);

    try {
      const response = await fetch(`${config.ttsUrl}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: spoken, voice_id: this.agent.voice_id, speed: 1.0 }),
      });

      if (!response.ok || !response.body) {
        console.error(`[AudioRouter] TTS returned ${response.status}`);
        return;
      }

      const ttsSampleRate = parseInt(response.headers.get('X-Sample-Rate') || '24000');
      this.onTtsConfig(ttsSampleRate);

      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (this.clientWs.readyState === WebSocket.OPEN) {
          this.clientWs.send(value);
        }
      }
    } catch (err: any) {
      console.error('[AudioRouter] TTS error:', err.message);
    }
  }

  stop(): void {
    this.isActive = false;
    if (this.sttWs) {
      this.sttWs.close();
      this.sttWs = null;
    }
  }
}
