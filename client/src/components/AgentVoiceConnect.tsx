import type { Agent, AgentHealth } from '../types';

interface Props {
  agent: Agent;
  /** Door opened by the user — agent is in the active set. */
  isActive: boolean;
  /** Halo is ON only while audio is currently playing (Q7 decision). */
  isSpeaking: boolean;
  /** Subtle indicator while the agent is generating a response. */
  isThinking: boolean;
  /** Latest health probe from the server-side HealthMonitor (undefined until
   *  the first probe lands ~10s after the agent registers). */
  health?: AgentHealth;
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

export function AgentVoiceConnect({ agent, isActive, isSpeaking, isThinking, health, onClick }: Props) {
  const color = agent.color || '#ffb000';
  const cls = [
    'agent-voiceconnect',
    isActive ? 'active' : '',
    isSpeaking ? 'speaking' : '',
    isThinking ? 'thinking' : '',
  ].filter(Boolean).join(' ');
  const avatar = avatarFor(agent);

  // Display name conventions for the terminal UI:
  //   sre → "SRE AGENT", everything else → upper-cased agent name.
  const displayName = (agent.id?.toLowerCase() === 'sre' ? 'SRE AGENT' : agent.name).toUpperCase();

  // Status line: lock when door closed, otherwise live state. Uppercase only.
  const statusText = isSpeaking
    ? '> SPEAKING'
    : isThinking
    ? '> THINKING'
    : isActive
    ? '> LISTENING'
    : '🔒 DOOR CLOSED';

  // Health dot: 'ok' (green), 'degraded' (amber), 'down' (red), undefined (dim
  // gray = "no probe yet"). Hovering shows last error / latency in a tooltip.
  const healthState = health?.state ?? 'unknown';
  const healthTitle = health
    ? `health: ${health.state} · ${health.latency_ms}ms${health.last_error ? ` · ${health.last_error}` : ''}`
    : 'health: probing…';
  const tileTitle = `${displayName}${isThinking ? ' (thinking...)' : isSpeaking ? ' (speaking)' : ''} — ${healthTitle}`;

  return (
    <div
      className={cls}
      onClick={onClick}
      style={{ '--voiceconnect-color': color } as React.CSSProperties}
      title={tileTitle}
    >
      <div className="voiceconnect-circle">
        {avatar.kind === 'image' ? (
          <img className="voiceconnect-avatar-img" src={avatar.src} alt={displayName} />
        ) : (
          <span className={avatar.kind === 'emoji' ? 'voiceconnect-avatar' : 'voiceconnect-initial'}>
            {avatar.glyph}
          </span>
        )}
        <span
          className={`voiceconnect-health-dot health-${healthState}`}
          aria-label={healthTitle}
          title={healthTitle}
        />
      </div>
      <div className="voiceconnect-info">
        <span className="voiceconnect-name">{displayName}</span>
        <span className="voiceconnect-status">{statusText}</span>
      </div>
    </div>
  );
}

