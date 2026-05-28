import { useEffect, useRef, useState, useCallback } from 'react';
import type { Agent, ServerMessage, ClientMessage, TranscriptBubble, ConversationMode } from '../types';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

let bubbleId = 0;
const nextBubbleId = () => `b${++bubbleId}`;

export function useWebSocket(token: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [connected, setConnected] = useState(false);
  const [activeAgentIds, setActiveAgentIds] = useState<Set<string>>(new Set());
  const [speakingAgentIds, setSpeakingAgentIds] = useState<Set<string>>(new Set());
  const [thinkingAgentIds, setThinkingAgentIds] = useState<Set<string>>(new Set());
  const [bubbles, setBubbles] = useState<TranscriptBubble[]>([]);
  const [mode, setMode] = useState<ConversationMode>('addressed-with-fallback');
  const [autoDegraded, setAutoDegraded] = useState(false);
  const [knockStatus, setKnockStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ttsSampleRate, setTtsSampleRate] = useState(24000);
  // Debug: capture each agent turn as a downloadable WAV.
  const [debugClips, setDebugClips] = useState<Array<{
    id: string; agentName: string; text: string; sampleRate: number;
    bytes: number; url: string;
  }>>([]);
  const captureBufRef = useRef<{
    chunks: Uint8Array[]; total: number; sampleRate: number; agentName: string; text: string;
  } | null>(null);
  const audioCallbackRef = useRef<((data: ArrayBuffer, agentId: string | null) => void) | null>(null);
  const currentAudioAgentRef = useRef<string | null>(null);
  // Keep an open bubble per agent so we append rather than create per-sentence noise.
  const openAgentBubbleRef = useRef<Map<string, string>>(new Map());

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendAudio = useCallback((data: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const setAudioCallback = useCallback(
    (cb: (data: ArrayBuffer, agentId: string | null) => void) => {
      audioCallbackRef.current = cb;
    }, []);

  const connect = useCallback(() => {
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => { setConnected(true); setError(null); };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        // Capture for debug WAV
        if (captureBufRef.current) {
          captureBufRef.current.chunks.push(new Uint8Array(event.data.slice(0)));
          captureBufRef.current.total += event.data.byteLength;
        }
        audioCallbackRef.current?.(event.data, currentAudioAgentRef.current);
        return;
      }
      const msg: ServerMessage = JSON.parse(event.data);
      switch (msg.type) {
        case 'agents':
          setAgents(msg.agents);
          break;
        case 'agent_update':
          setAgents((prev) =>
            prev.some((a) => a.id === msg.agent.id)
              ? prev.map((a) => (a.id === msg.agent.id ? msg.agent : a))
              : [...prev, msg.agent],
          );
          break;
        case 'transcript':
          setBubbles((b) => [...b, { id: nextBubbleId(), role: 'user', text: msg.text }]);
          // New user turn → close any open agent bubbles.
          openAgentBubbleRef.current.clear();
          break;
        case 'agent_thinking':
          setThinkingAgentIds((s) => new Set(s).add(msg.agent_id));
          break;
        case 'agent_speaking_start': {
          setThinkingAgentIds((s) => { const n = new Set(s); n.delete(msg.agent_id); return n; });
          setSpeakingAgentIds((s) => new Set(s).add(msg.agent_id));
          setTtsSampleRate(msg.sample_rate);
          currentAudioAgentRef.current = msg.agent_id;
          // Open new debug capture for this clip.
          captureBufRef.current = {
            chunks: [], total: 0, sampleRate: msg.sample_rate,
            agentName: msg.agent_name, text: msg.text,
          };
          // Append to (or open) this agent's bubble.
          setBubbles((prev) => {
            const openId = openAgentBubbleRef.current.get(msg.agent_id);
            if (openId) {
              return prev.map((b) =>
                b.id === openId ? { ...b, text: (b.text + ' ' + msg.text).trim() } : b,
              );
            }
            const id = nextBubbleId();
            openAgentBubbleRef.current.set(msg.agent_id, id);
            const ag = agentsRefLookup(msg.agent_id);
            return [...prev, {
              id, role: 'agent',
              agentId: msg.agent_id,
              agentName: msg.agent_name,
              color: ag?.color,
              text: msg.text,
            }];
          });
          break;
        }
        case 'agent_speaking_end':
          setSpeakingAgentIds((s) => { const n = new Set(s); n.delete(msg.agent_id); return n; });
          if (currentAudioAgentRef.current === msg.agent_id) currentAudioAgentRef.current = null;
          // Seal debug capture into a downloadable WAV.
          if (captureBufRef.current && captureBufRef.current.total > 0) {
            const cap = captureBufRef.current;
            // Concatenate raw float32 PCM bytes
            const raw = new Uint8Array(cap.total);
            let off = 0;
            for (const c of cap.chunks) { raw.set(c, off); off += c.byteLength; }
            // float32 → int16 WAV
            const f32 = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4));
            const i16 = new Int16Array(f32.length);
            for (let i = 0; i < f32.length; i++) {
              const v = Math.max(-1, Math.min(1, f32[i]));
              i16[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
            }
            const dataLen = i16.byteLength;
            const wav = new ArrayBuffer(44 + dataLen);
            const dv = new DataView(wav);
            const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
            ws(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); ws(8, 'WAVE'); ws(12, 'fmt ');
            dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
            dv.setUint32(24, cap.sampleRate, true); dv.setUint32(28, cap.sampleRate * 2, true);
            dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
            ws(36, 'data'); dv.setUint32(40, dataLen, true);
            new Uint8Array(wav, 44).set(new Uint8Array(i16.buffer));
            // Also keep a raw float32 blob alongside.
            const wavBlob = new Blob([wav], { type: 'audio/wav' });
            const url = URL.createObjectURL(wavBlob);
            const id = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            setDebugClips((prev) => [
              { id, agentName: cap.agentName, text: cap.text, sampleRate: cap.sampleRate, bytes: cap.total, url },
              ...prev,
            ].slice(0, 20));
          }
          captureBufRef.current = null;
          break;
        case 'agent_done':
          setThinkingAgentIds((s) => { const n = new Set(s); n.delete(msg.agent_id); return n; });
          setSpeakingAgentIds((s) => { const n = new Set(s); n.delete(msg.agent_id); return n; });
          openAgentBubbleRef.current.delete(msg.agent_id);
          break;
        case 'mode':
          setMode(msg.mode); setAutoDegraded(msg.auto_degraded);
          break;
        case 'interrupted':
          setBubbles((prev) => prev.map((b) =>
            b.role === 'agent' && b.agentId && msg.agent_ids.includes(b.agentId)
              ? { ...b, interrupted: true } : b));
          setSpeakingAgentIds(new Set());
          openAgentBubbleRef.current.clear();
          break;
        case 'knock_queued': setKnockStatus('waiting'); break;
        case 'knock_accepted': setKnockStatus('accepted'); break;
        case 'knock_failed':
          setKnockStatus(`failed: ${msg.reason}`);
          setTimeout(() => setKnockStatus(null), 3000); break;
        case 'tts_config': setTtsSampleRate(msg.sample_rate); break;
        case 'error':
          setError(msg.message);
          setTimeout(() => setError(null), 5000); break;
      }
    };

    // Helper that captures latest agents via closure of state setter.
    function agentsRefLookup(id: string): Agent | undefined {
      return agentsLatest.current.find((a) => a.id === id);
    }

    ws.onclose = () => {
      setConnected(false);
      setActiveAgentIds(new Set());
      setSpeakingAgentIds(new Set());
      setThinkingAgentIds(new Set());
      setTimeout(connect, 2000);
    };
    ws.onerror = () => setError('WebSocket connection failed');
  }, [token]);

  // Track latest agents in a ref so the WS handler can look them up without re-creating.
  const agentsLatest = useRef<Agent[]>([]);
  useEffect(() => { agentsLatest.current = agents; }, [agents]);

  useEffect(() => { connect(); return () => wsRef.current?.close(); }, [connect]);

  const toggleAgent = useCallback((agentId: string) => {
    setActiveAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId); else next.add(agentId);
      send({ type: 'set_active_agents', agent_ids: Array.from(next) });
      return next;
    });
  }, [send]);

  const interrupt = useCallback(() => send({ type: 'interrupt' }), [send]);

  return {
    agents,
    connected,
    activeAgentIds,
    speakingAgentIds,
    thinkingAgentIds,
    bubbles,
    mode,
    autoDegraded,
    knockStatus,
    error,
    ttsSampleRate,
    debugClips,
    sendAudio,
    setAudioCallback,
    toggleAgent,
    interrupt,
  };
}
