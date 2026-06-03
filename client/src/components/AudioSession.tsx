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
  // Render the mode in uppercase and append the "open an agent door" prompt
  // when nothing is active. Auto-mode flag stays as a small inline tag.
  const modeText = (mode || 'unknown').toString().toUpperCase();
  const titleParts = [
    `MODE: ${modeText}${autoDegraded ? ' (AUTO)' : ''}`,
    !hasActive ? 'OPEN AN AGENT DOOR TO START' : null,
  ].filter(Boolean);

  return (
    <div className="audio-session">
      <div className="session-header">
        <span className="session-title">{titleParts.join(' :: ')}</span>
        <div>
          <button
            className="end-button"
            onClick={onInterrupt}
            disabled={!hasActive}
            style={{ marginRight: 8 }}
          >
            [INTERRUPT]
          </button>
          <button className="end-button" onClick={onLeaveAll} disabled={!hasActive}>
            [LEAVE ALL]
          </button>
        </div>
      </div>
      <div className="session-content">
        {bubbles.length === 0 && (
          <div className="bubble-empty">
            {hasActive
              ? 'LISTENING… START TALKING WHEN YOU ARE READY.'
              : 'TRANSCRIPTS AND REPLIES WILL APPEAR HERE ONCE AN AGENT IS ACTIVE.'}
          </div>
        )}
        {[...bubbles].reverse().map((b) => {
          // Terminal-style speaker label:
          //   user         → "YOU"
          //   sre agent    → "SRE_AGENT"
          //   other agents → upper-cased name (e.g. "ARIA", "NOVA")
          const speakerLabel =
            b.role === 'user'
              ? 'YOU'
              : (b.agentName ?? 'AGENT')
                  .toUpperCase()
                  .replace(/^SRE AGENT$/, 'SRE_AGENT')
                  .replace(/^SRE$/, 'SRE_AGENT');
          return (
            <div
              key={b.id}
              className={`bubble ${b.role === 'user' ? 'user-bubble' : 'agent-bubble'}${
                b.interrupted ? ' interrupted' : ''
              }`}
              style={
                b.role === 'agent' && b.color
                  ? { opacity: b.interrupted ? 0.6 : 1 }
                  : undefined
              }
            >
              <span className="bubble-label">
                {speakerLabel}
                {b.interrupted ? ' (INTERRUPTED)' : ''}
              </span>
              <p>{b.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

