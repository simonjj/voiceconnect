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
    bubbles, mode, autoDegraded, knockStatus, error, ttsSampleRate, debugClips,
    sendAudio, setAudioCallback, toggleAgent, interrupt,
  } = useWebSocket(TOKEN);

  const hasActive = activeAgentIds.size > 0;
  const { isMicActive } = useAudio(sendAudio, setAudioCallback, hasActive, ttsSampleRate);
  const debugMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

  const handleAgentClick = (agent: Agent) => toggleAgent(agent.id);

  const leaveAll = () => {
    Array.from(activeAgentIds).forEach((id) => toggleAgent(id));
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔮 Connect</h1>
        <div className="status">
          <span className={`dot ${connected ? 'online' : 'offline'}`} />
          {connected ? 'Connected' : 'Reconnecting...'}
          {isMicActive && <span className="mic-indicator">🎙️</span>}
          {hasActive && <span style={{ marginLeft: 12 }}>{activeAgentIds.size} active</span>}
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {knockStatus && <div className="knock-banner">Knock: {knockStatus}</div>}

      <main className="app-main">
        <Hallway
          agents={agents}
          activeAgentIds={activeAgentIds}
          speakingAgentIds={speakingAgentIds}
          thinkingAgentIds={thinkingAgentIds}
          onAgentClick={handleAgentClick}
        />
        {hasActive && (
          <AudioSession
            bubbles={bubbles}
            mode={mode}
            autoDegraded={autoDegraded}
            onInterrupt={interrupt}
            onLeaveAll={leaveAll}
          />
        )}
        {debugMode && debugClips.length > 0 && (
          <section className="debug-clips">
            <h3>🔍 Audio debug clips ({debugClips.length})</h3>
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

