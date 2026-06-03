import type { Agent, AgentHealth } from '../types';
import { AgentVoiceConnect } from './AgentVoiceConnect';

interface Props {
  agents: Agent[];
  activeAgentIds: Set<string>;
  speakingAgentIds: Set<string>;
  thinkingAgentIds: Set<string>;
  agentHealth: Record<string, AgentHealth>;
  onAgentClick: (agent: Agent) => void;
}

export function Hallway({
  agents, activeAgentIds, speakingAgentIds, thinkingAgentIds, agentHealth, onAgentClick,
}: Props) {
  if (agents.length === 0) {
    return (
      <div className="hallway-empty">
        <p>NO AGENTS REGISTERED.</p>
      </div>
    );
  }
  return (
    <div className="hallway">
      {agents.map((agent) => (
        <AgentVoiceConnect
          key={agent.id}
          agent={agent}
          isActive={activeAgentIds.has(agent.id)}
          isSpeaking={speakingAgentIds.has(agent.id)}
          isThinking={thinkingAgentIds.has(agent.id)}
          health={agentHealth[agent.id]}
          onClick={() => onAgentClick(agent)}
        />
      ))}
    </div>
  );
}

