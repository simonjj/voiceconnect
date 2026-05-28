import { getAgent, updateAgentStatus, listAgents } from './db.js';
import type { Agent } from './types.js';

interface KnockEntry {
  agentId: string;
  resolve: (accepted: boolean) => void;
  timeout: NodeJS.Timeout;
}

export class PresenceManager {
  private knockQueue: Map<string, KnockEntry[]> = new Map();
  private onAgentUpdate: (agent: Agent) => void;

  constructor(onAgentUpdate: (agent: Agent) => void) {
    this.onAgentUpdate = onAgentUpdate;
  }

  getAgents(): Agent[] {
    return listAgents();
  }

  canConnect(agentId: string): boolean {
    const agent = getAgent(agentId);
    if (!agent) return false;
    return agent.door_open && agent.status === 'idle';
  }

  startSession(agentId: string): void {
    updateAgentStatus(agentId, 'listening', false);
    this.broadcastAgent(agentId);
  }

  setAgentThinking(agentId: string): void {
    updateAgentStatus(agentId, 'thinking');
    this.broadcastAgent(agentId);
  }

  setAgentSpeaking(agentId: string): void {
    updateAgentStatus(agentId, 'speaking');
    this.broadcastAgent(agentId);
  }

  endSession(agentId: string): void {
    updateAgentStatus(agentId, 'idle', true);
    this.broadcastAgent(agentId);
    this.processKnockQueue(agentId);
  }

  async knock(agentId: string, timeoutMs: number = 30000): Promise<boolean> {
    const agent = getAgent(agentId);
    if (!agent) return false;

    if (agent.door_open && agent.status === 'idle') return true;

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        this.removeKnock(agentId, resolve);
        resolve(false);
      }, timeoutMs);

      if (!this.knockQueue.has(agentId)) {
        this.knockQueue.set(agentId, []);
      }
      this.knockQueue.get(agentId)!.push({ agentId, resolve, timeout });
    });
  }

  private processKnockQueue(agentId: string): void {
    const queue = this.knockQueue.get(agentId);
    if (!queue || queue.length === 0) return;
    const next = queue.shift()!;
    clearTimeout(next.timeout);
    next.resolve(true);
  }

  private removeKnock(agentId: string, resolve: Function): void {
    const queue = this.knockQueue.get(agentId);
    if (!queue) return;
    const idx = queue.findIndex(k => k.resolve === resolve);
    if (idx !== -1) queue.splice(idx, 1);
  }

  private broadcastAgent(agentId: string): void {
    const agent = getAgent(agentId);
    if (agent) this.onAgentUpdate(agent);
  }
}
