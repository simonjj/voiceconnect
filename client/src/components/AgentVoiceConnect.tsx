import type { Agent } from '../types';

interface Props {
  agent: Agent;
  /** Door opened by the user — agent is in the active set. */
  isActive: boolean;
  /** Halo is ON only while audio is currently playing (Q7 decision). */
  isSpeaking: boolean;
  /** Subtle indicator while the agent is generating a response. */
  isThinking: boolean;
  onClick: () => void;
}

// Per-agent emoji avatars. Matched first by id, then by name (so 'sre' and
// the older display 'Sage' both pick up the wrench). Falls back to the first
// letter of the name for unknown agents.
const AVATAR_BY_ID: Record<string, string> = {
  aria: '🌸',
  nova: '⚡',
  sre: '🛠️',
  sage: '🛠️',
  echo: '🔊',
};

function avatarFor(agent: Agent): { glyph: string; isEmoji: boolean } {
  const idKey = agent.id?.toLowerCase();
  const nameKey = agent.name?.toLowerCase();
  const glyph = AVATAR_BY_ID[idKey] || (nameKey ? AVATAR_BY_ID[nameKey] : undefined);
  if (glyph) return { glyph, isEmoji: true };
  return { glyph: agent.name.charAt(0).toUpperCase() || '?', isEmoji: false };
}

export function AgentVoiceConnect({ agent, isActive, isSpeaking, isThinking, onClick }: Props) {
  const color = agent.color || '#6b7280';
  const doorIcon = isActive ? '🚪' : '🔒';
  const cls = [
    'agent-voiceconnect',
    isActive ? 'active' : '',
    isSpeaking ? 'speaking' : '',
    isThinking ? 'thinking' : '',
  ].filter(Boolean).join(' ');
  const { glyph, isEmoji } = avatarFor(agent);

  return (
    <div
      className={cls}
      onClick={onClick}
      style={{ '--voiceconnect-color': color } as React.CSSProperties}
      title={`${agent.name}${isThinking ? ' (thinking...)' : isSpeaking ? ' (speaking)' : ''}`}
    >
      <div className="voiceconnect-circle">
        <span className={isEmoji ? 'voiceconnect-avatar' : 'voiceconnect-initial'}>{glyph}</span>
      </div>
      <div className="voiceconnect-info">
        <span className="voiceconnect-name">{agent.name}</span>
        <span className="voiceconnect-status">
          {doorIcon} {isSpeaking ? 'speaking' : isThinking ? 'thinking' : isActive ? 'listening' : 'idle'}
        </span>
      </div>
    </div>
  );
}

