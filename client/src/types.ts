export interface Agent {
  id: string;
  name: string;
  url: string;
  voice_id: string;
  color: string;
  description: string;
  capabilities: string[];
  door_open: boolean;
  status: 'idle' | 'listening' | 'thinking' | 'speaking' | 'unavailable' | 'error';
  created_at: string;
}

export type ConversationMode = 'addressed-only' | 'addressed-with-fallback' | 'single';

export type ServerMessage =
  | { type: 'agents'; agents: Agent[] }
  | { type: 'agent_update'; agent: Agent }
  | { type: 'session_started'; agent_id: string; agent_name: string }
  | { type: 'session_ended' }
  | { type: 'transcript'; text: string }
  | { type: 'agent_speaking_start'; agent_id: string; agent_name: string; text: string; sample_rate: number; sequence: number }
  | { type: 'agent_speaking_end'; agent_id: string; sequence: number }
  | { type: 'agent_thinking'; agent_id: string }
  | { type: 'agent_done'; agent_id: string }
  | { type: 'agent_speaking'; text: string }
  | { type: 'knock_queued'; agent_id: string }
  | { type: 'knock_accepted'; agent_id: string }
  | { type: 'knock_failed'; agent_id: string; reason: string }
  | { type: 'error'; message: string }
  | { type: 'tts_config'; sample_rate: number }
  | { type: 'mode'; mode: ConversationMode; auto_degraded: boolean }
  | { type: 'interrupted'; agent_ids: string[] };

export type ClientMessage =
  | { type: 'start_session'; agent_id: string }
  | { type: 'end_session' }
  | { type: 'knock'; agent_id: string }
  | { type: 'set_active_agents'; agent_ids: string[] }
  | { type: 'interrupt' };

export interface TranscriptBubble {
  id: string;
  role: 'user' | 'agent';
  agentId?: string;
  agentName?: string;
  color?: string;
  text: string;
  interrupted?: boolean;
}

