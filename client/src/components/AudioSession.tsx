import type { TranscriptBubble } from '../types';

interface Props {
  bubbles: TranscriptBubble[];
  /** Whether any agent door is open. Controls enabled/disabled state of the
   *  Interrupt / Leave-all buttons; the panel itself is always rendered so
   *  the prompt window stays visible (Phase 4 fix). */
  hasActive: boolean;
  onInterrupt: () => void;
  onLeaveAll: () => void;
}

export function AudioSession({ bubbles, hasActive, onInterrupt, onLeaveAll }: Props) {
  // Header shows the "open an agent door" prompt only when nothing is active.
  // The conversation mode used to be displayed here but was removed (phase 7) —
  // it's an internal detail that doesn't need to be surfaced to the caller.
  const titleParts = [
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

