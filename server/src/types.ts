// Shared types for Connect server and client

export interface Agent {
  id: string;
  name: string;
  url: string;
  voice_id: string;
  /** Accent color (hex) used for halo + transcript bubble. */
  color: string;
  description: string;
  capabilities: string[];
  door_open: boolean;
  status: 'idle' | 'listening' | 'thinking' | 'speaking' | 'unavailable' | 'error';
  created_at: string;
}

export interface AgentCard {
  id: string;
  name: string;
  description: string;
  voice_id: string;
  color?: string;
  capabilities: string[];
  status: string;
}

export type ConversationMode = 'addressed-only' | 'addressed-with-fallback' | 'single';

// WebSocket messages: browser → server
export type ClientMessage =
  // Phase 1 (kept for backward compat)
  | { type: 'start_session'; agent_id: string }
  | { type: 'end_session' }
  | { type: 'knock'; agent_id: string }
  // Phase 2 multi-agent
  | { type: 'set_active_agents'; agent_ids: string[] }
  | { type: 'interrupt' };

// WebSocket messages: server → browser (JSON; binary frames are TTS audio)
export type ServerMessage =
  | { type: 'agents'; agents: Agent[] }
  | { type: 'agent_update'; agent: Agent }
  | { type: 'session_started'; agent_id: string; agent_name: string }
  | { type: 'session_ended' }
  | { type: 'transcript'; text: string }
  // Phase 2: who's about to speak / done speaking. Drives client halo + audio routing.
  | { type: 'agent_speaking_start'; agent_id: string; agent_name: string; text: string; sample_rate: number; sequence: number }
  | { type: 'agent_speaking_end'; agent_id: string; sequence: number }
  | { type: 'agent_thinking'; agent_id: string }
  | { type: 'agent_done'; agent_id: string }
  | { type: 'agent_speaking'; text: string } // legacy single-agent
  | { type: 'knock_queued'; agent_id: string }
  | { type: 'knock_accepted'; agent_id: string }
  | { type: 'knock_failed'; agent_id: string; reason: string }
  | { type: 'error'; message: string }
  | { type: 'tts_config'; sample_rate: number }
  | { type: 'mode'; mode: ConversationMode; auto_degraded: boolean }
  | { type: 'interrupted'; agent_ids: string[] };

/**
 * Shared conversation history entry.
 * Sent to each agent's /chat call so they can see what others said.
 */
export interface HistoryMessage {
  role: 'user' | 'assistant';
  /** When role='assistant', the agent's display name (so each agent knows who said what). */
  name?: string;
  /** Agent id when role='assistant'. */
  agent_id?: string;
  content: string;
  /** True if a partial reply was cut off by user interruption. */
  interrupted?: boolean;
}

