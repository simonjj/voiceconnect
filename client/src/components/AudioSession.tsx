import type { TranscriptBubble, ConversationMode } from '../types';

interface Props {
  bubbles: TranscriptBubble[];
  mode: ConversationMode;
  autoDegraded: boolean;
  /** Whether any agent door is open. Controls enabled/disabled state of the
   *  Interrupt / Leave-all buttons; the panel itself is always rendered so
   *  the prompt window stays visible (Phase 4 fix). */
  hasActive: boolean;
  onInterrupt: () => void;
  onLeaveAll: () => void;
}

export function AudioSession({ bubbles, mode, autoDegraded, hasActive, onInterrupt, onLeaveAll }: Props) {
  return (
    <div className="audio-session">
      <div className="session-header">
        <span className="session-title">
          Mode: {mode}{autoDegraded ? ' (auto)' : ''}
          {!hasActive && <span className="session-hint"> · Open an agent door to start</span>}
        </span>
        <div>
          <button
            className="end-button"
            onClick={onInterrupt}
            disabled={!hasActive}
            style={{ marginRight: 8 }}
          >
            Interrupt
          </button>
          <button className="end-button" onClick={onLeaveAll} disabled={!hasActive}>
            Leave all
          </button>
        </div>
      </div>
      <div className="session-content">
        {bubbles.length === 0 && (
          <div className="bubble-empty">
            {hasActive
              ? 'Listening… start talking when you are ready.'
              : 'Transcripts and replies will appear here once an agent is active.'}
          </div>
        )}
        {[...bubbles].reverse().map((b) => (
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

