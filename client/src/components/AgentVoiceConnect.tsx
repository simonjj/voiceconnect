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

// Per-agent image avatars served from /avatars/ in the bundle. Falls back
// to an emoji, then to the first letter of the agent name for unknowns.
const IMAGE_AVATAR_BY_ID: Record<string, string> = {
  aria: '/avatars/aria.png',
  nova: '/avatars/nova.png',
  sre: '/avatars/sre.jpg',
  sage: '/avatars/sre.jpg',
};

const EMOJI_AVATAR_BY_ID: Record<string, string> = {
  echo: '🔊',
};

type AvatarChoice =
  | { kind: 'image'; src: string }
  | { kind: 'emoji'; glyph: string }
  | { kind: 'initial'; glyph: string };

function avatarFor(agent: Agent): AvatarChoice {
  const idKey = agent.id?.toLowerCase() ?? '';
  const nameKey = agent.name?.toLowerCase() ?? '';
  const src = IMAGE_AVATAR_BY_ID[idKey] || IMAGE_AVATAR_BY_ID[nameKey];
  if (src) return { kind: 'image', src };
  const emoji = EMOJI_AVATAR_BY_ID[idKey] || EMOJI_AVATAR_BY_ID[nameKey];
  if (emoji) return { kind: 'emoji', glyph: emoji };
  return { kind: 'initial', glyph: agent.name.charAt(0).toUpperCase() || '?' };
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
  const avatar = avatarFor(agent);

  return (
    <div
      className={cls}
      onClick={onClick}
      style={{ '--voiceconnect-color': color } as React.CSSProperties}
      title={`${agent.name}${isThinking ? ' (thinking...)' : isSpeaking ? ' (speaking)' : ''}`}
    >
      <div className="voiceconnect-circle">
        {avatar.kind === 'image' ? (
          <img className="voiceconnect-avatar-img" src={avatar.src} alt={agent.name} />
        ) : (
          <span className={avatar.kind === 'emoji' ? 'voiceconnect-avatar' : 'voiceconnect-initial'}>
            {avatar.glyph}
          </span>
        )}
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

