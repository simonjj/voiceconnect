import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from './config.js';
import { initDb, listAgents, getAgent, registerAgent, removeAgent } from './db.js';
import { PresenceManager } from './presence.js';
import { MultiAgentSession } from './multi-agent-session.js';
import { handleTurn } from './api-turn.js';
import type { Agent, ClientMessage } from './types.js';

// Initialize
initDb();
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Middleware
app.use(cors());
app.use(express.json());

// Serve built React client if present
const publicDir = resolve(import.meta.dirname, '../public');
if (existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// Track connected clients
const clients = new Set<WebSocket>();
const clientSessions = new Map<WebSocket, MultiAgentSession>();

// Presence manager
const presence = new PresenceManager((agent: Agent) => {
  broadcast({ type: 'agent_update', agent });
});

function broadcast(msg: any): void {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

function sendJson(ws: WebSocket, msg: any): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

// ── REST API ──────────────────────────────────────────────

app.get('/api/agents', (_req, res) => {
  res.json(listAgents());
});

app.post('/api/agents', (req, res) => {
  const { id, name, url, voice_id, color, description, capabilities } = req.body;
  if (!id || !name || !url) {
    res.status(400).json({ error: 'id, name, and url are required' });
    return;
  }
  const agent = registerAgent({
    id,
    name,
    url,
    voice_id: voice_id || 'af_sky',
    color,
    description: description || '',
    capabilities: capabilities || ['chat'],
  });
  broadcast({ type: 'agent_update', agent });
  res.json(agent);
});

app.delete('/api/agents/:id', (req, res) => {
  const id = req.params.id;
  removeAgent(id);
  res.json({ ok: true });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', agents: listAgents().length, clients: clients.size });
});

// Text-only turn (used by Twilio bridge). Auth via ?token=... query (matches WS).
app.post('/api/turn', (req, res, next) => {
  if (req.query.token !== config.authToken) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  handleTurn(req, res).catch(next);
});

// ── WebSocket auth ────────────────────────────────────────

function authenticateWs(req: any): boolean {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  return url.searchParams.get('token') === config.authToken;
}

// ── WebSocket handler ─────────────────────────────────────

wss.on('connection', (ws, req) => {
  if (!authenticateWs(req)) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  console.log('[WS] Client connected');
  clients.add(ws);
  sendJson(ws, { type: 'agents', agents: listAgents() });

  // Lazily-instantiated multi-agent session for this WS.
  function getOrCreateSession(): MultiAgentSession {
    let session = clientSessions.get(ws);
    if (!session) {
      session = new MultiAgentSession(ws, {
        send: (m) => sendJson(ws, m),
        sendBinary: (data) => { if (ws.readyState === WebSocket.OPEN) ws.send(data); },
      });
      clientSessions.set(ws, session);
    }
    return session;
  }

  ws.on('message', async (data, isBinary) => {
    // Binary = audio from mic
    if (isBinary) {
      const session = clientSessions.get(ws);
      if (session) session.handleAudio(Buffer.from(data as ArrayBuffer));
      return;
    }

    // JSON = control message
    try {
      const msg: ClientMessage = JSON.parse(data.toString());

      switch (msg.type) {
        case 'set_active_agents': {
          const ids = Array.isArray(msg.agent_ids) ? msg.agent_ids : [];
          const agents = ids
            .map((id) => getAgent(id))
            .filter((a): a is Agent => !!a);
          // Mark each currently-active agent as listening; others idle.
          for (const a of listAgents()) {
            const isActive = agents.find((x) => x.id === a.id);
            if (isActive && a.status !== 'listening') {
              presence.startSession(a.id);
            } else if (!isActive && a.status !== 'idle') {
              presence.endSession(a.id);
            }
          }
          getOrCreateSession().setActiveAgents(agents);
          break;
        }

        case 'interrupt': {
          const session = clientSessions.get(ws);
          if (session) session.interrupt();
          break;
        }

        // ── legacy single-agent path (kept for back-compat with existing client) ──
        case 'start_session': {
          const agent = getAgent(msg.agent_id);
          if (!agent) {
            sendJson(ws, { type: 'error', message: 'Agent not found' });
            break;
          }
          if (!presence.canConnect(msg.agent_id)) {
            sendJson(ws, { type: 'knock_queued', agent_id: msg.agent_id });
            const accepted = await presence.knock(msg.agent_id);
            if (!accepted) {
              sendJson(ws, { type: 'knock_failed', agent_id: msg.agent_id, reason: 'timeout' });
              break;
            }
            sendJson(ws, { type: 'knock_accepted', agent_id: msg.agent_id });
          }
          presence.startSession(msg.agent_id);
          getOrCreateSession().setActiveAgents([agent]);
          sendJson(ws, { type: 'session_started', agent_id: agent.id, agent_name: agent.name });
          break;
        }

        case 'end_session': {
          const session = clientSessions.get(ws);
          if (session) {
            session.stop();
            clientSessions.delete(ws);
          }
          for (const a of listAgents()) {
            if (a.status === 'listening' || a.status === 'speaking' || a.status === 'thinking') {
              presence.endSession(a.id);
            }
          }
          sendJson(ws, { type: 'session_ended' });
          break;
        }

        case 'knock': {
          const agent = getAgent(msg.agent_id);
          if (!agent) {
            sendJson(ws, { type: 'error', message: 'Agent not found' });
            break;
          }
          sendJson(ws, { type: 'knock_queued', agent_id: msg.agent_id });
          const accepted = await presence.knock(msg.agent_id);
          sendJson(ws, accepted
            ? { type: 'knock_accepted', agent_id: msg.agent_id }
            : { type: 'knock_failed', agent_id: msg.agent_id, reason: 'timeout' },
          );
          break;
        }
      }
    } catch (err: any) {
      console.error('[WS] Message error:', err);
      sendJson(ws, { type: 'error', message: 'Invalid message' });
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
    const session = clientSessions.get(ws);
    if (session) session.stop();
    clientSessions.delete(ws);
    clients.delete(ws);
    for (const a of listAgents()) {
      if (a.status === 'listening' || a.status === 'speaking' || a.status === 'thinking') {
        presence.endSession(a.id);
      }
    }
  });
});

// ── Start ─────────────────────────────────────────────────

server.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════╗
║   Connect Server v1.0                ║
║   Port: ${String(config.port).padEnd(28)}║
║   STT:  ${config.sttUrl.padEnd(28)}║
║   TTS:  ${config.ttsUrl.padEnd(28)}║
╚══════════════════════════════════════╝`);
});
