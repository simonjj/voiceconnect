"""
Sandbox Agent — universal Connect-compatible agent backed by GitHub Copilot CLI
running inside a dedicated Azure Container Apps Sandbox.

This variant targets ACA Express environments where Managed Identity and the
`aca` CLI auth flow are unavailable. Instead of using `aca sandbox exec`, the
agent calls a tiny HTTP wrapper (`sandbox_wrapper.py`) listening on an
anonymous port exposed by the sandbox itself.

Env vars (set at deploy time):
  AGENT_ID          stable id, e.g. "aria"
  AGENT_NAME        display name, e.g. "Aria"
  AGENT_VOICE       Kokoro voice id, e.g. "af_sky"
  AGENT_COLOR       hex color for UI, e.g. "#3b82f6"
  AGENT_PERSONA     short persona description used in the system prompt
  AGENT_MODEL       optional Copilot model override, e.g. "claude-sonnet-4.5"
  SANDBOX_ID        UUID of the dedicated sandbox (purely informational)
  SANDBOX_URL       https://<sandbox-id>--<port>.<region>.adcproxy.io
  SANDBOX_TIMEOUT   seconds for one /run call (default 180)

Protocol:
  GET  /agent-card  → metadata
  POST /chat        → NDJSON stream { type: 'text'|'done'|'error', content }
"""
import asyncio
import json
import logging
import os
from typing import AsyncIterator, Optional

import httpx
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("sandbox-agent")

AGENT_ID = os.environ.get("AGENT_ID", "agent")
AGENT_NAME = os.environ.get("AGENT_NAME", "Agent")
AGENT_VOICE = os.environ.get("AGENT_VOICE", "af_sky")
AGENT_COLOR = os.environ.get("AGENT_COLOR", "#3b82f6")
AGENT_PERSONA = os.environ.get(
    "AGENT_PERSONA",
    f"You are {AGENT_NAME}, a helpful voice assistant.",
)
AGENT_MODEL = os.environ.get("AGENT_MODEL", "").strip()
SANDBOX_ID = os.environ.get("SANDBOX_ID", "").strip()
SANDBOX_URL = os.environ.get("SANDBOX_URL", "").strip().rstrip("/")
SANDBOX_TIMEOUT = float(os.environ.get("SANDBOX_TIMEOUT", "180"))

# Voice-friendly system prompt fragments shared across agents.
VOICE_GUIDELINES = (
    "Your replies are spoken aloud. Keep them conversational and SHORT — "
    "1-3 sentences unless asked for detail. Avoid markdown, bullet lists, "
    "code blocks, and long URLs. Spell out tricky acronyms. "
    "If multiple agents are present, do not echo what another agent just said; "
    "build on it briefly or stay silent if you have nothing to add."
)

app = FastAPI(title=f"Sandbox Agent: {AGENT_NAME}")


class HistoryMessage(BaseModel):
    role: str
    name: Optional[str] = None
    agent_id: Optional[str] = None
    content: str
    interrupted: Optional[bool] = False


class ChatRequest(BaseModel):
    text: str
    session_id: str = "default"
    history: Optional[list[HistoryMessage]] = None
    self_name: Optional[str] = None


@app.get("/agent-card")
async def agent_card():
    return {
        "id": AGENT_ID,
        "name": AGENT_NAME,
        "description": AGENT_PERSONA,
        "voice_id": AGENT_VOICE,
        "color": AGENT_COLOR,
        "capabilities": ["chat"],
        "status": "available" if SANDBOX_URL else "unavailable",
    }


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "agent": AGENT_ID, "sandbox": SANDBOX_ID or None, "sandbox_url": SANDBOX_URL or None}


def _build_prompt(req: ChatRequest) -> str:
    """Render shared multi-agent history into a single prompt string."""
    self_name = req.self_name or AGENT_NAME
    lines: list[str] = []
    lines.append(AGENT_PERSONA)
    lines.append("")
    lines.append(VOICE_GUIDELINES)
    lines.append("")
    lines.append(f"Your name is {self_name}. Reply as {self_name}.")
    lines.append("")
    history = req.history or []
    if history:
        lines.append("Conversation so far:")
        for msg in history[:-1]:  # last message is the current user turn
            if msg.role == "user":
                lines.append(f"User: {msg.content}")
            else:
                speaker = msg.name or msg.agent_id or "Other"
                tag = " (interrupted)" if msg.interrupted else ""
                lines.append(f"{speaker}{tag}: {msg.content}")
        lines.append("")
    # Current user turn — explicit.
    last_user = history[-1].content if history and history[-1].role == "user" else req.text
    lines.append(f"User: {last_user}")
    lines.append(f"{self_name}:")
    return "\n".join(lines)


async def _copilot_run(prompt: str) -> AsyncIterator[dict]:
    """
    Execute one copilot turn by POSTing to the sandbox HTTP wrapper.
    The wrapper runs `copilot -p` inside the sandbox and streams back NDJSON.
    """
    if not SANDBOX_URL:
        yield {"type": "error", "content": "SANDBOX_URL not configured"}
        return

    payload = {"prompt": prompt}
    if AGENT_MODEL:
        payload["model"] = AGENT_MODEL

    try:
        async with httpx.AsyncClient(timeout=SANDBOX_TIMEOUT, verify=False) as client:
            async with client.stream("POST", f"{SANDBOX_URL}/run", json=payload) as resp:
                if resp.status_code != 200:
                    body = (await resp.aread()).decode(errors="replace")[:500]
                    yield {"type": "error", "content": f"sandbox HTTP {resp.status_code}: {body}"}
                    return
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        evt = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    yield evt
    except httpx.TimeoutException:
        yield {"type": "error", "content": f"sandbox call timed out after {SANDBOX_TIMEOUT}s"}
    except httpx.HTTPError as e:
        yield {"type": "error", "content": f"sandbox call failed: {e}"}


def _extract_assistant_text(evt: dict) -> Optional[str]:
    """
    Map a Copilot CLI JSONL event to a plain text delta, if any.

    Real shapes emitted by `copilot --output-format json`:
      {"type":"assistant.message","data":{"content":"...", "toolRequests":[...]}}  ← final
      {"type":"assistant.message_delta","data":{"deltaContent":"..."}}             ← streaming
    """
    if not isinstance(evt, dict):
        return None
    t = evt.get("type")
    data = evt.get("data") if isinstance(evt.get("data"), dict) else {}

    # Real Copilot CLI shapes (preferred — final message is canonical)
    if t == "assistant.message":
        c = data.get("content")
        return c if isinstance(c, str) and c else None
    # Note: we deliberately ignore assistant.message_delta — the final
    # `assistant.message` event carries the complete content string, so
    # consuming both would double every reply. (aca exec is synchronous; all
    # events arrive together, so we don't lose any streaming benefit here.)

    # Legacy / fallback shapes for safety
    if t in ("text", "assistant_message", "message"):
        text = evt.get("content") or evt.get("text")
        if isinstance(text, str):
            return text
        if isinstance(text, list):
            parts = [p.get("text") for p in text if isinstance(p, dict) and p.get("type") == "text"]
            return "".join(p for p in parts if p) or None
    if evt.get("role") == "assistant":
        content = evt.get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = [p.get("text") for p in content if isinstance(p, dict) and p.get("type") == "text"]
            return "".join(p for p in parts if p) or None
    return None


@app.post("/chat")
async def chat(req: ChatRequest):
    prompt = _build_prompt(req)

    async def generate():
        try:
            full_text = ""
            async for evt in _copilot_run(prompt):
                if evt.get("type") == "error":
                    yield json.dumps({"type": "error", "content": evt.get("content", "unknown")}) + "\n"
                    return
                delta = _extract_assistant_text(evt)
                if delta:
                    full_text += delta
                    yield json.dumps({"type": "text", "content": delta}) + "\n"
            if not full_text.strip():
                # Nothing extractable — surface raw fallback so the user hears *something* useful.
                yield json.dumps({"type": "text", "content": "(no response)"}) + "\n"
            yield json.dumps({"type": "done"}) + "\n"
        except asyncio.TimeoutError:
            yield json.dumps({"type": "error", "content": "Agent timed out"}) + "\n"
        except Exception as e:
            logger.exception("chat error")
            yield json.dumps({"type": "error", "content": str(e)}) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8020"))
    uvicorn.run(app, host="0.0.0.0", port=port)
