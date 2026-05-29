// SRE Agent — Connect-compatible voice agent backed by an Azure SRE Agent
// (Microsoft.App/agents) reached over its SignalR data plane.
//
// Env vars:
//   AGENT_ID            stable id, e.g. "sre"
//   AGENT_NAME          display name, e.g. "SRE"
//   AGENT_VOICE         Kokoro voice id, e.g. "am_michael"
//   AGENT_COLOR         hex color, e.g. "#10b981"
//   AGENT_PERSONA       short persona description (informational; SRE itself
//                       runs its own system prompt server-side)
//   SRE_ENDPOINT        per-agent FQDN, e.g.
//                       https://<name>--<hash>.<region-hash>.<region>.azuresre.ai
//                       (resolved by deploy.ps1 from Microsoft.App/agents.properties.agentEndpoint)
//   SRE_DISPLAY_NAME    user-side display name to send with messages
//                       (default: "VoiceConnect")
//   SRE_TURN_TIMEOUT_MS hard ceiling for one turn (default: 90000)
//   SRE_SILENCE_MS      idle timeout after first final-answer token (default: 8000)
//   AUTH_TOKEN          bearer token required on /chat (mirrors sandbox agent)
//   PORT                listen port (default 8080)
//
// Protocol (mirrors services/agents/sandbox/agent.py):
//   GET  /agent-card  → metadata
//   GET  /healthz     → liveness + SignalR connection status
//   POST /chat        → NDJSON stream { type: 'text'|'done'|'error', content }
//
// Per voiceconnect session, the SRE thread is reused across turns:
//   sessionId -> { threadId, lastUsed }
// First turn: CreateThread(threadId, {startMessage:{...}}, false)
// Subsequent: CreateMessage(threadId, {text,userId,displayName}, false)
//
// MessageUpdate filter (validated against live ticket-sre):
//   role:"user"                                  → echo, ignore
//   role:"assistant" + smt:"Reasoning"           → chain-of-thought, suppress
//   role:"assistant" + smt:other named           → tool args/results, suppress
//   role:"assistant" + smt:null + $type:"text"   → FINAL ANSWER → stream as {type:text}
//   role:"assistant" + len:0 + smt:null          → end-of-message terminator
import express from "express";
import { DefaultAzureCredential } from "@azure/identity";
import signalR from "@microsoft/signalr";
import { randomUUID } from "node:crypto";

const AGENT_ID       = process.env.AGENT_ID       || "sre";
const AGENT_NAME     = process.env.AGENT_NAME     || "SRE";
const AGENT_VOICE    = process.env.AGENT_VOICE    || "am_michael";
const AGENT_COLOR    = process.env.AGENT_COLOR    || "#10b981";
const AGENT_PERSONA  = process.env.AGENT_PERSONA  ||
  "You are SRE, an Azure operations expert who can read live telemetry, " +
  "resources, and code to answer questions about the running system.";
const SRE_ENDPOINT   = (process.env.SRE_ENDPOINT || "").replace(/\/+$/, "");
const SRE_DISPLAY    = process.env.SRE_DISPLAY_NAME || "VoiceConnect";
const SCOPE          = "https://azuresre.ai/.default";
const TURN_TIMEOUT   = Number(process.env.SRE_TURN_TIMEOUT_MS || "90000");
const SILENCE_MS     = Number(process.env.SRE_SILENCE_MS || "30000");
const AUTH_TOKEN     = process.env.AUTH_TOKEN || "";
const PORT           = Number(process.env.PORT || "8080");

if (!SRE_ENDPOINT) {
  console.error("[fatal] SRE_ENDPOINT not set");
  process.exit(1);
}

// ───────────────────────── Auth ─────────────────────────
const cred = new DefaultAzureCredential();
let cachedToken = null; // { token, expiresOnTimestamp }

async function getToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresOnTimestamp - now > 60_000) {
    return cachedToken.token;
  }
  const t = await cred.getToken(SCOPE);
  if (!t) throw new Error("DefaultAzureCredential returned no token");
  cachedToken = t;
  return t.token;
}

function decodeJwt(jwt) {
  try {
    const p = jwt.split(".")[1];
    return JSON.parse(Buffer.from(p, "base64").toString("utf8"));
  } catch { return {}; }
}

let cachedCallerId = null;
async function getCallerId() {
  if (cachedCallerId) return cachedCallerId;
  const claims = decodeJwt(await getToken());
  cachedCallerId = claims.puid || claims.oid || "voiceconnect";
  return cachedCallerId;
}

// ───────────────────────── SignalR connection (singleton) ─────────────────────────
// One long-lived HubConnection per process. Active turns subscribe to
// MessageUpdate via a per-turn listener so multiple concurrent /chat calls
// (different sessions) don't cross-contaminate streams.
let conn = null;
let connStarting = null;

function buildConnection() {
  const c = new signalR.HubConnectionBuilder()
    .withUrl(`${SRE_ENDPOINT}/agentHub`, {
      accessTokenFactory: getToken,
      transport: signalR.HttpTransportType.WebSockets,
      skipNegotiation: false,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10_000, 30_000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();
  c.onclose((err) => {
    console.warn("[signalr] connection closed:", err?.message || "");
    if (conn === c) conn = null;
  });
  c.onreconnected(() => console.log("[signalr] reconnected"));
  return c;
}

async function ensureConnected() {
  if (conn && conn.state === signalR.HubConnectionState.Connected) return conn;
  if (connStarting) return connStarting;
  const c = conn || (conn = buildConnection());
  connStarting = (async () => {
    try {
      if (c.state === signalR.HubConnectionState.Disconnected) {
        await c.start();
        console.log("[signalr] connected to", SRE_ENDPOINT);
      }
      return c;
    } finally {
      connStarting = null;
    }
  })();
  return connStarting;
}

// ───────────────────────── Thread registry ─────────────────────────
// voiceconnect session_id -> { threadId, lastUsed }.
// We keep threads alive for 30 minutes of idle then drop the mapping so
// the next turn starts a fresh SRE thread (avoids unbounded growth).
const THREAD_TTL_MS = 30 * 60 * 1000;
const threads = new Map();

function getThread(sessionId) {
  const entry = threads.get(sessionId);
  if (!entry) return null;
  if (Date.now() - entry.lastUsed > THREAD_TTL_MS) {
    threads.delete(sessionId);
    return null;
  }
  return entry;
}

function setThread(sessionId, threadId) {
  threads.set(sessionId, { threadId, lastUsed: Date.now() });
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of threads) {
    if (now - v.lastUsed > THREAD_TTL_MS) threads.delete(k);
  }
}, 5 * 60 * 1000).unref();

// ───────────────────────── HTTP app ─────────────────────────
const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/agent-card", (_req, res) => {
  res.json({
    id: AGENT_ID,
    name: AGENT_NAME,
    description: AGENT_PERSONA,
    voice_id: AGENT_VOICE,
    color: AGENT_COLOR,
    capabilities: ["chat"],
    status: conn?.state === signalR.HubConnectionState.Connected ? "available" : "connecting",
  });
});

app.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    agent: AGENT_ID,
    endpoint: SRE_ENDPOINT,
    signalr: conn?.state || "disconnected",
  });
});

function checkAuth(req, res) {
  if (!AUTH_TOKEN) return true;
  const hdr = req.get("authorization") || "";
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  if (m && m[1] === AUTH_TOKEN) return true;
  res.status(401).json({ error: "unauthorized" });
  return false;
}

function ndjson(res, obj) {
  res.write(JSON.stringify(obj) + "\n");
}

app.post("/chat", async (req, res) => {
  if (!checkAuth(req, res)) return;
  const { text, session_id: sessionIdRaw } = req.body || {};
  const sessionId = sessionIdRaw || "default";
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required" });
  }

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache");

  let finished = false;
  const finish = (kind, content) => {
    if (finished) return;
    finished = true;
    if (kind === "error") ndjson(res, { type: "error", content });
    ndjson(res, { type: "done" });
    res.end();
  };

  let messageUpdateHandler = null;
  let silenceTimer = null;
  let hardTimer = null;
  let sawFinalToken = false;
  let totalFinalChars = 0;

  try {
    const c = await ensureConnected();
    const userId = await getCallerId();

    const armSilence = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => finish("done"), SILENCE_MS);
    };

    messageUpdateHandler = (msg) => {
      try {
        if (!msg || msg.role !== "assistant") return;
        const content0 = (msg.contents || [])[0];
        const smt = msg.additionalProperties?.streamMessageType;
        // End-of-message terminator: empty assistant chunk with no streamMessageType
        if (!content0 || (smt == null && content0.$type === "text" && !content0.text)) {
          if (sawFinalToken) finish("done");
          return;
        }
        // Reasoning + tool chunks: surface as {type:"debug",...} for observability.
        // The server's /chat consumer ignores non-text/error events, but the
        // twilio-bridge logs them and a future UI can surface them.
        if (smt != null) {
          const preview = (content0.text || "").slice(0, 140).replace(/\s+/g, " ").trim();
          if (preview) ndjson(res, { type: "debug", agent_id: AGENT_ID, kind: String(smt), content: preview });
          // Tool/reasoning activity is liveness — keep the connection open
          // while SRE is still working (az calls, KQL queries can take 20-90s).
          if (sawFinalToken) armSilence();
          return;
        }
        if (content0.$type === "functionCall" || content0.$type === "functionResult") {
          ndjson(res, { type: "debug", agent_id: AGENT_ID, kind: content0.$type, content: content0.name || "" });
          if (sawFinalToken) armSilence();
          return;
        }
        if (content0.$type !== "text") return;
        const delta = content0.text;
        if (!delta) return;
        sawFinalToken = true;
        totalFinalChars += delta.length;
        ndjson(res, { type: "text", content: delta });
        armSilence();
      } catch (e) {
        console.warn("[chat] handler error:", e?.message || e);
      }
    };

    c.on("MessageUpdate", messageUpdateHandler);

    hardTimer = setTimeout(() => {
      if (!finished) {
        if (sawFinalToken) finish("done");
        else finish("error", `SRE turn timed out after ${TURN_TIMEOUT}ms`);
      }
    }, TURN_TIMEOUT);

    res.on("close", () => {
      // Client disconnected — clean up listener but leave SRE thread intact.
      finished = true;
      if (messageUpdateHandler) c.off("MessageUpdate", messageUpdateHandler);
      if (silenceTimer) clearTimeout(silenceTimer);
      if (hardTimer) clearTimeout(hardTimer);
    });

    const existing = getThread(sessionId);
    if (existing) {
      await c.invoke(
        "CreateMessage",
        existing.threadId,
        { text, userId, displayName: SRE_DISPLAY },
        false,
      );
      existing.lastUsed = Date.now();
    } else {
      const threadId = randomUUID();
      await c.invoke(
        "CreateThread",
        threadId,
        { startMessage: { text, userId, displayName: SRE_DISPLAY } },
        false,
      );
      setThread(sessionId, threadId);
    }
    // Stream now driven by MessageUpdate; finish() is called from the handler
    // or by the timers.
  } catch (e) {
    console.error("[chat] error:", e);
    finish("error", e?.message || String(e));
  } finally {
    // Cleanup listener once finished is set by either path.
    const cleanup = () => {
      if (messageUpdateHandler && conn) {
        try { conn.off("MessageUpdate", messageUpdateHandler); } catch {}
      }
      if (silenceTimer) clearTimeout(silenceTimer);
      if (hardTimer) clearTimeout(hardTimer);
      console.log(`[chat] session=${sessionId} done finalChars=${totalFinalChars}`);
    };
    // Defer cleanup until the response finishes.
    res.on("finish", cleanup);
  }
});

// ───────────────────────── Bootstrap ─────────────────────────
app.listen(PORT, () => {
  console.log(`[sre-agent] listening on :${PORT} → ${SRE_ENDPOINT}`);
  // Kick the SignalR connection eagerly so the first turn is fast.
  ensureConnected().catch((e) => console.error("[signalr] initial connect failed:", e?.message || e));
});

process.on("SIGTERM", async () => {
  console.log("[sre-agent] SIGTERM, shutting down");
  try { await conn?.stop(); } catch {}
  process.exit(0);
});
