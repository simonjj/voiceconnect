import { useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudio } from './hooks/useAudio';
import { Hallway } from './components/Hallway';
import { AudioSession } from './components/AudioSession';
import type { Agent } from './types';
import './App.css';

const TOKEN = 'dev-token';

function App() {
  const {
    agents, connected, activeAgentIds, speakingAgentIds, thinkingAgentIds,
    bubbles, knockStatus, error, ttsSampleRate, debugClips,
    sendAudio, setAudioCallback, toggleAgent, interrupt,
  } = useWebSocket(TOKEN);

  const hasActive = activeAgentIds.size > 0;
  const [muted, setMuted] = useState(false);
  const { isMicActive } = useAudio(sendAudio, setAudioCallback, hasActive, ttsSampleRate, muted);
  const debugMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

  const handleAgentClick = (agent: Agent) => toggleAgent(agent.id);

  const leaveAll = () => {
    Array.from(activeAgentIds).forEach((id) => toggleAgent(id));
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>VOICECONNECT TERMINAL V1.0</h1>
        <div className="status">
          <span>
            <span className={`dot ${connected ? 'online' : 'offline'}`} />{' '}
            LINK: {connected ? 'CONNECTED' : 'RECONNECTING…'}
          </span>
          {isMicActive && <span className="mic-indicator">MIC: ON</span>}
          {hasActive && <span>{activeAgentIds.size} ACTIVE</span>}
          <button
            className={`mute-button ${muted ? 'muted' : ''}`}
            onClick={() => setMuted((m) => !m)}
            title={muted ? 'Unmute agents' : 'Mute agents'}
            aria-pressed={muted}
          >
            [SOUND: {muted ? 'OFF' : 'ON'}]
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {knockStatus && <div className="knock-banner">{knockStatus}</div>}

      <main className="app-main">
        <Hallway
          agents={agents}
          activeAgentIds={activeAgentIds}
          speakingAgentIds={speakingAgentIds}
          thinkingAgentIds={thinkingAgentIds}
          onAgentClick={handleAgentClick}
        />
        <AudioSession
          bubbles={bubbles}
          hasActive={hasActive}
          onInterrupt={interrupt}
          onLeaveAll={leaveAll}
        />
        {debugMode && debugClips.length > 0 && (
          <section className="debug-clips">
            <h3>AUDIO DEBUG CLIPS ({debugClips.length})</h3>
            <ol>
              {debugClips.map((c) => (
                <li key={c.id}>
                  <strong>{c.agentName}</strong> · {c.sampleRate}Hz · {c.bytes} B ·{' '}
                  <em>{c.text.slice(0, 60)}{c.text.length > 60 ? '…' : ''}</em>
                  <br />
                  <audio controls src={c.url} style={{ width: 320, marginTop: 4 }} />
                  <a href={c.url} download={`${c.agentName}-${c.id}.wav`}>⬇ download</a>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;

