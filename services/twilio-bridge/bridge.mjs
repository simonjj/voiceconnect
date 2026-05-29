// VoiceConnect Twilio bridge — terminates ConversationRelay and forwards each
// caller turn to the server's POST /api/turn endpoint.
//
// Twilio voice webhook for the number should point at:
//   https://<this-app>/twiml
//
// TwiML returned:
//   <Response>
//     <Connect>
//       <ConversationRelay url="wss://<this-app>/ws" welcomeGreeting="..." voice="..." />
//     </Connect>
//   </Response>
//
// ConversationRelay WS protocol (the subset we use):
//   Twilio → us:
//     { type:"setup", callSid, from, to, ... }       (first frame)
//     { type:"prompt", voicePrompt, last:true, ... } (each user turn)
//     { type:"interrupt" }                            (barge-in)
//   us → Twilio:
//     { type:"text", token, last }                    (assistant chunks)
//
// Env vars:
//   SERVER_URL          e.g. https://voiceconnect-server-XXX.swedencentral.azurecontainerapps.io
//   AUTH_TOKEN          server's AUTH_TOKEN (passed as ?token= on /api/turn)
//   WELCOME_GREETING    optional welcome message (default: "Hi! You're on with the VoiceConnect agents. Who would you like to talk to?")
//   TWILIO_VOICE        ConversationRelay voice id (default: "en-US-AriaNeural")
//   PUBLIC_HOSTNAME     optional override; if unset, derived from Host: header
//   PORT                listen port (default 8080)
//   RESUME_WINDOW_MS    caller-resume window (default 900000 = 15 min, 0 disables)

import express from "express";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const SERVER_URL      = (process.env.SERVER_URL || "").replace(/\/+$/, "");
const AUTH_TOKEN      = process.env.AUTH_TOKEN || "";
const WELCOME         = process.env.WELCOME_GREETING ||
  "Hi! You're on with the VoiceConnect agents. Who would you like to talk to?";
const VOICE           = process.env.TWILIO_VOICE || "en-US-Journey-O";
const TTS_PROVIDER    = process.env.TTS_PROVIDER || "Google";
const PUBLIC_HOSTNAME = (process.env.PUBLIC_HOSTNAME || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const PORT            = Number(process.env.PORT || "8080");
// If the same phone number calls back within this window, reuse the previous
// session_id so the agents remember the prior conversation. 0 disables.
const RESUME_WINDOW_MS = Number(process.env.RESUME_WINDOW_MS || `${15 * 60 * 1000}`);

if (!SERVER_URL) {
  console.error("[fatal] SERVER_URL is required");
  process.exit(1);
}
if (!AUTH_TOKEN) {
  console.error("[fatal] AUTH_TOKEN is required");
  process.exit(1);
}

function xmlEscape(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]));
}

// Convert agent markdown/code/URL text into something TTS can read aloud
// without speaking the literal "asterisk", "backtick", or a raw URL. Applied
// per sentence-buffered chunk before sending to ConversationRelay.
function voicify(s) {
  let t = String(s ?? "");
  // Fenced code blocks ```...``` and inline code `...` — drop the markers,
  // keep short content, replace very long blocks with "(code omitted)".
  t = t.replace(/```[\s\S]*?```/g, (block) => {
    const inner = block.slice(3, -3).replace(/^[a-zA-Z0-9_-]+\n/, "").trim();
    return inner.length > 200 ? " (code omitted) " : ` ${inner} `;
  });
  t = t.replace(/`([^`]+)`/g, "$1");
  // Markdown links [label](url) → "label". Bare URLs → "(link)".
  t = t.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, "$1");
  t = t.replace(/\bhttps?:\/\/\S+/gi, "(link)");
  // Headings, blockquotes, bold/italic markers.
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  t = t.replace(/^\s{0,3}>\s?/gm, "");
  t = t.replace(/\*\*(.+?)\*\*/g, "$1");
  t = t.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, "$1");
  t = t.replace(/__(.+?)__/g, "$1");
  t = t.replace(/~~(.+?)~~/g, "$1");
  // Bullet markers at the start of a line.
  t = t.replace(/^\s*[-*+]\s+/gm, "");
  t = t.replace(/^\s*\d+\.\s+/gm, "");
  // Collapse whitespace + leftover newlines.
  t = t.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, ". ").replace(/\n/g, " ").trim();
  return t;
}

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// In-memory log ring buffer + console intercept. Lets us GET /logs over HTTP
// to read recent stdout/stderr without relying on Log Analytics ingestion
// latency or `az containerapp exec` (which has been flaky on Express envs).
const LOG_MAX = 500;
const logRing = [];
function pushLog(level, args) {
  try {
    const line = args.map((a) => (typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })())).join(" ");
    logRing.push({ t: new Date().toISOString(), level, line });
    if (logRing.length > LOG_MAX) logRing.splice(0, logRing.length - LOG_MAX);
  } catch { /* ignore */ }
}
for (const level of ["log", "info", "warn", "error"]) {
  const orig = console[level].bind(console);
  console[level] = (...args) => { pushLog(level, args); orig(...args); };
}
app.get("/logs", (req, res) => {
  const n = Math.min(Number(req.query.n || LOG_MAX), LOG_MAX);
  res.json({ count: logRing.length, logs: logRing.slice(-n) });
});

app.get("/healthz", (_req, res) => res.json({ status: "ok" }));

// In-memory ring buffer of the most recent Twilio Debugger Webhook events.
// Configure this URL in Twilio Console → Monitor → Debugger → Webhook:
//   https://<bridge-host>/twilio-debug
// Then GET /twilio-debug to view the last 50 events. Saves a trip to logs.
const TWILIO_DEBUG_MAX = 50;
const twilioDebugEvents = [];
app.post("/twilio-debug", (req, res) => {
  const evt = {
    receivedAt: new Date().toISOString(),
    level: req.body?.Level,
    sid: req.body?.Sid,
    timestamp: req.body?.Timestamp,
    payloadType: req.body?.PayloadType,
    payload: req.body?.Payload,
    raw: req.body,
  };
  twilioDebugEvents.unshift(evt);
  if (twilioDebugEvents.length > TWILIO_DEBUG_MAX) twilioDebugEvents.length = TWILIO_DEBUG_MAX;
  console.warn(`[twilio-debug] ${evt.level || "?"} sid=${evt.sid || "?"} payload=${typeof evt.payload === "string" ? evt.payload.slice(0, 400) : JSON.stringify(evt.payload).slice(0, 400)}`);
  res.json({ ok: true });
});
app.get("/twilio-debug", (_req, res) => res.json({ count: twilioDebugEvents.length, events: twilioDebugEvents }));

// Twilio voice webhook → TwiML pointing at our WSS endpoint.
app.all("/twiml", (req, res) => {
  const host = PUBLIC_HOSTNAME || req.get("host");
  const wsUrl = `wss://${host}/ws`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay url="${xmlEscape(wsUrl)}" welcomeGreeting="${xmlEscape(WELCOME)}" ttsProvider="${xmlEscape(TTS_PROVIDER)}" voice="${xmlEscape(VOICE)}" />
  </Connect>
</Response>`;
  console.log(`[twiml] ${req.method} ${req.path} → ${wsUrl} (from=${req.body?.From || "?"} sid=${req.body?.CallSid || "?"})`);
  res.type("application/xml").send(xml);
});

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

// Phone-number → { sessionId, lastSeen } map for caller-resume within RESUME_WINDOW_MS.
const callerResume = new Map();
setInterval(() => {
  const cutoff = Date.now() - RESUME_WINDOW_MS;
  for (const [k, v] of callerResume) if (v.lastSeen < cutoff) callerResume.delete(k);
}, 60_000).unref();

function pickSessionId(callSid, from) {
  if (RESUME_WINDOW_MS > 0 && from) {
    const prev = callerResume.get(from);
    if (prev && Date.now() - prev.lastSeen < RESUME_WINDOW_MS) {
      console.log(`[resume] ${from} → ${prev.sessionId} (last seen ${Math.round((Date.now() - prev.lastSeen) / 1000)}s ago)`);
      return prev.sessionId;
    }
  }
  return callSid || `anon-${Date.now()}`;
}

function rememberCaller(from, sessionId) {
  if (RESUME_WINDOW_MS > 0 && from) {
    callerResume.set(from, { sessionId, lastSeen: Date.now() });
  }
}

wss.on("connection", (ws, req) => {
  let callSid = null;
  let callerFrom = null;
  let sessionId = null;
  let inflight = null;     // AbortController for the active /api/turn call
  let turnCount = 0;
  const remote = req.socket.remoteAddress;
  console.log(`[ws] connected from ${remote}`);

  const sendJson = (obj) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  };

  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "setup") {
      callSid = msg.callSid || `anon-${Date.now()}`;
      callerFrom = msg.from || null;
      sessionId = pickSessionId(callSid, callerFrom);
      rememberCaller(callerFrom, sessionId);
      console.log(`[setup] callSid=${callSid} from=${callerFrom} to=${msg.to} session=${sessionId}`);
      return;
    }

    if (msg.type === "interrupt") {
      if (inflight) {
        try { inflight.abort(); } catch { /* ignore */ }
        inflight = null;
      }
      return;
    }

    if (msg.type !== "prompt" || !msg.voicePrompt) return;

    // Twilio may emit partial prompts; we only act on `last:true`.
    if (msg.last === false) return;

    const sid = sessionId || pickSessionId(callSid, callerFrom);
    sessionId = sid;
    rememberCaller(callerFrom, sid);
    const transcript = String(msg.voicePrompt).trim();
    if (!transcript) return;

    if (inflight) {
      try { inflight.abort(); } catch { /* ignore */ }
    }
    inflight = new AbortController();
    const myAbort = inflight;
    const turnNo = ++turnCount;

    console.log(`[turn ${turnNo} ${sid}] "${transcript.slice(0, 80)}"`);

    let response;
    try {
      response = await fetch(`${SERVER_URL}/api/turn?token=${encodeURIComponent(AUTH_TOKEN)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid, transcript }),
        signal: myAbort.signal,
      });
    } catch (e) {
      const cause = e?.cause;
      console.warn(`[turn ${turnNo}] fetch error: ${e?.name || ""} ${e?.message || e} cause=${cause?.code || cause?.message || ""} stack=${(e?.stack || "").split("\n")[1] || ""}`);
      sendJson({ type: "text", token: "Sorry, I couldn't reach the agents.", last: true });
      return;
    }

    if (!response.ok || !response.body) {
      console.warn(`[turn ${turnNo}] server HTTP ${response.status}`);
      sendJson({ type: "text", token: "Sorry, the agents are unavailable right now.", last: true });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let lastAgent = null;
    let saidAnything = false;
    // Buffer raw agent text and only flush voicify'd output at sentence
    // boundaries (or on stream end) so markdown markers that span chunks
    // (e.g. ** spread across two tokens) are stripped before TTS.
    let pendingText = "";
    const flushPending = (final = false) => {
      if (!pendingText) return;
      const m = pendingText.match(/^([\s\S]*[.!?\n])\s+/);
      let toSpeak;
      if (m) {
        toSpeak = m[1];
        pendingText = pendingText.slice(m[0].length);
      } else if (final) {
        toSpeak = pendingText;
        pendingText = "";
      } else {
        return;
      }
      const spoken = voicify(toSpeak);
      if (!spoken) return;
      saidAnything = true;
      sendJson({ type: "text", token: spoken + " ", last: false });
    };

    try {
      while (true) {
        if (myAbort.signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          let evt;
          try { evt = JSON.parse(t); } catch { continue; }
          if (evt.type === "text" && typeof evt.content === "string") {
            // Emit a small lead-in when a new agent starts speaking. Helps the
            // caller follow multi-agent replies without a visual cue.
            if (lastAgent && evt.agent_id && evt.agent_id !== lastAgent) {
              flushPending(true);
              sendJson({ type: "text", token: " ", last: false });
            }
            lastAgent = evt.agent_id || lastAgent;
            pendingText += evt.content;
            // Flush as many complete sentences as we have buffered.
            let prev;
            do { prev = pendingText; flushPending(false); } while (pendingText !== prev);
          } else if (evt.type === "debug" && evt.content) {
            // Server-side observability of what agents are doing during long
            // reasoning + tool calls. Not spoken to the caller.
            console.log(`[turn ${turnNo}] debug[${evt.agent_id || "?"}/${evt.kind || "?"}]: ${String(evt.content).slice(0, 120)}`);
          } else if (evt.type === "error" && evt.message) {
            console.warn(`[turn ${turnNo}] agent error: ${evt.message}`);
          }
        }
      }
    } catch (e) {
      if (!myAbort.signal.aborted) {
        console.warn(`[turn ${turnNo}] stream error:`, e?.message || e);
      }
    } finally {
      try { reader.releaseLock(); } catch { /* ignore */ }
    }

    if (!myAbort.signal.aborted) {
      flushPending(true);
      if (!saidAnything) {
        sendJson({ type: "text", token: "Hmm, no one spoke up. Try addressing someone, like 'hey Aria'.", last: true });
      } else {
        sendJson({ type: "text", token: "", last: true });
      }
    }
    if (inflight === myAbort) inflight = null;
    console.log(`[turn ${turnNo}] done`);
  });

  ws.on("close", () => {
    if (inflight) { try { inflight.abort(); } catch { /* ignore */ } }
    console.log(`[ws] closed callSid=${callSid}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[twilio-bridge] :${PORT} → ${SERVER_URL}`);
});

process.on("SIGTERM", () => {
  console.log("[twilio-bridge] SIGTERM");
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
});
