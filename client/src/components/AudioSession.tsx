import type { TranscriptBubble, ConversationMode } from '../types';

interface Props {
  bubbles: TranscriptBubble[];
  mode: ConversationMode;
  autoDegraded: boolean;
  onInterrupt: () => void;
  onLeaveAll: () => void;
}

export function AudioSession({ bubbles, mode, autoDegraded, onInterrupt, onLeaveAll }: Props) {
  return (
    <div className="audio-session">
      <div className="session-header">
        <span className="session-title">
          Mode: {mode}{autoDegraded ? ' (auto)' : ''}
        </span>
        <div>
          <button className="end-button" onClick={onInterrupt} style={{ marginRight: 8 }}>
            Interrupt
          </button>
          <button className="end-button" onClick={onLeaveAll}>
            Leave all
          </button>
        </div>
      </div>
      <div className="session-content">
        {bubbles.map((b) => (
          <div
            key={b.id}
            className={`bubble ${b.role === 'user' ? 'user-bubble' : 'agent-bubble'}`}
            style={b.role === 'agent' && b.color ? {
              borderLeft: `4px solid ${b.color}`,
              opacity: b.interrupted ? 0.6 : 1,
            } : undefined}
          >
            <span className="bubble-label">
              {b.role === 'user' ? 'You' : (b.agentName ?? 'Agent')}
              {b.interrupted ? ' (interrupted)' : ''}
            </span>
            <p>{b.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

