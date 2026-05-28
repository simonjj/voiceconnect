"""
Claude Agent — wraps Anthropic Claude API as a Connect-compatible agent.
Receives text, streams response as NDJSON.

Protocol:
  GET  /agent-card  → agent metadata
  POST /chat { "text": "...", "session_id": "..." } → streaming NDJSON
"""
import json
import logging
import os
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import anthropic

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("claude-agent")

app = FastAPI(title="Claude Agent")

client = None
AGENT_ID = os.environ.get("AGENT_ID", "claude-sonnet")
AGENT_NAME = os.environ.get("AGENT_NAME", "Claude")
AGENT_VOICE = os.environ.get("AGENT_VOICE", "af_sky")
MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-20250514")

# Conversation history per session
sessions: dict[str, list] = {}


class ChatRequest(BaseModel):
    text: str
    session_id: str = "default"


@app.on_event("startup")
async def startup():
    global client
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set — agent will not function.")
    else:
        client = anthropic.Anthropic(api_key=api_key)
    logger.info(f"Claude agent started: {AGENT_NAME} ({AGENT_ID})")


@app.get("/agent-card")
async def agent_card():
    return {
        "id": AGENT_ID,
        "name": AGENT_NAME,
        "description": "General-purpose AI assistant powered by Claude",
        "voice_id": AGENT_VOICE,
        "capabilities": ["chat", "code", "analysis", "writing"],
        "status": "available" if client else "unavailable",
    }


@app.post("/chat")
async def chat(req: ChatRequest):
    if not client:
        async def error_gen():
            yield json.dumps({"type": "error", "content": "Agent not configured"}) + "\n"
        return StreamingResponse(error_gen(), media_type="application/x-ndjson")

    # Maintain conversation history
    if req.session_id not in sessions:
        sessions[req.session_id] = []
    history = sessions[req.session_id]
    history.append({"role": "user", "content": req.text})

    # Keep last 20 messages
    if len(history) > 20:
        history = history[-20:]
        sessions[req.session_id] = history

    def generate():
        full_response = ""
        try:
            with client.messages.stream(
                model=MODEL,
                max_tokens=1024,
                system=(
                    "You are a helpful voice assistant. Keep responses concise and "
                    "conversational since they will be spoken aloud. Aim for 1-3 "
                    "sentences unless the user asks for detail."
                ),
                messages=history,
            ) as stream:
                for text in stream.text_stream:
                    full_response += text
                    yield json.dumps({"type": "text", "content": text}) + "\n"

            history.append({"role": "assistant", "content": full_response})
            yield json.dumps({"type": "done"}) + "\n"
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            yield json.dumps({"type": "error", "content": str(e)}) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    sessions.pop(session_id, None)
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8010"))
    uvicorn.run(app, host="0.0.0.0", port=port)
