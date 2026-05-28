import { readFileSync, writeFileSync, existsSync } from 'fs';
import { config } from './config.js';
import type { Agent } from './types.js';

// Simple JSON file store — no native deps, perfect for a personal agent hub
interface Store {
  agents: Record<string, Agent>;
}

let store: Store = { agents: {} };

export function initDb(): void {
  const path = config.dbPath;
  if (existsSync(path)) {
    try {
      store = JSON.parse(readFileSync(path, 'utf-8'));
    } catch {
      store = { agents: {} };
    }
  }
  save();
}

function save(): void {
  writeFileSync(config.dbPath, JSON.stringify(store, null, 2));
}

export function listAgents(): Agent[] {
  return Object.values(store.agents).sort((a, b) => a.name.localeCompare(b.name));
}

export function getAgent(id: string): Agent | null {
  return store.agents[id] ?? null;
}

export function registerAgent(agent: {
  id: string;
  name: string;
  url: string;
  voice_id: string;
  color?: string;
  description: string;
  capabilities: string[];
}): Agent {
  // Deterministic palette fallback if color not provided.
  const palette = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b'];
  const fallback = palette[Object.keys(store.agents).length % palette.length];
  store.agents[agent.id] = {
    ...agent,
    color: agent.color || store.agents[agent.id]?.color || fallback,
    door_open: true,
    status: 'idle',
    created_at: new Date().toISOString(),
  };
  save();
  return store.agents[agent.id];
}

export function updateAgentStatus(id: string, status: Agent['status'], doorOpen?: boolean): void {
  const agent = store.agents[id];
  if (!agent) return;
  agent.status = status;
  if (doorOpen !== undefined) agent.door_open = doorOpen;
  save();
}

export function updateAgentDoor(id: string, doorOpen: boolean): void {
  const agent = store.agents[id];
  if (!agent) return;
  agent.door_open = doorOpen;
  save();
}

export function removeAgent(id: string): void {
  if (store.agents[id]) {
    delete store.agents[id];
    save();
  }
}
