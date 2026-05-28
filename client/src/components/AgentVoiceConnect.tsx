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

export function AgentVoiceConnect({ agent, isActive, isSpeaking, isThinking, onClick }: Props) {
  const color = agent.color || '#6b7280';
  const doorIcon = isActive ? '🚪' : '🔒';
  const cls = [
    'agent-voiceconnect',
    isActive ? 'active' : '',
    isSpeaking ? 'speaking' : '',
    isThinking ? 'thinking' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      onClick={onClick}
      style={{ '--voiceconnect-color': color } as React.CSSProperties}
      title={`${agent.name}${isThinking ? ' (thinking...)' : isSpeaking ? ' (speaking)' : ''}`}
    >
      <div className="voiceconnect-circle">
        <span className="voiceconnect-initial">{agent.name.charAt(0)}</span>
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

