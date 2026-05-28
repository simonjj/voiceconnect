# Testing Phase 1 — Shot 1 Deployment & Verification

## Step 1 — Test the Server Image (no GPU needed)

```bash
# Pull & run just the server (already on your registry)
docker run -p 3000:3000 \
  -e AUTH_TOKEN=dev-token \
  -e STT_URL=ws://localhost:8001 \
  -e TTS_URL=http://localhost:8002 \
  simon.azurecr.io/connect-server:latest

# Verify:
curl http://localhost:3000/api/health        # → {"status":"ok"}
curl http://localhost:3000                     # → React SPA HTML
```

This validates the server + client static serving work without any GPU.

## Step 2 — Test the Claude Agent (no GPU needed)

```bash
docker build -t connect-claude ./services/agents/claude
docker run -p 8010:8010 -e ANTHROPIC_API_KEY=sk-ant-... connect-claude

# Verify:
curl http://localhost:8010/agent-card         # → agent metadata JSON
curl -X POST http://localhost:8010/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test","text":"hello"}'   # → streaming NDJSON tokens
```

## Step 3 — Test STT + TTS on a GPU Box

Requires: `nvidia-container-toolkit` + NVIDIA GPU on the host.

```bash
# STT
docker build -t connect-stt ./services/stt
docker run --gpus all -p 8001:8001 connect-stt
# First run: downloads Whisper large-v3 (~3GB), then "Ready on :8001"

# TTS
docker build -t connect-tts ./services/tts
docker run --gpus all -p 8002:8002 connect-tts
# First run: downloads Kokoro model (~80MB), then "Ready on :8002"

# Verify TTS:
curl -X POST http://GPU_BOX:8002/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","voice":"af_sky"}' \
  --output test.pcm    # → raw PCM float32 @ 24kHz
```

STT verification requires a WebSocket client (wscat or Python script) to send audio frames.

## Step 4 — Full Stack Integration

### Option A: Everything on one GPU box

```bash
export ANTHROPIC_API_KEY=sk-ant-...
docker compose --profile gpu up --build
```

### Option B: GPU services remote, server local

```bash
# On GPU box: run STT + TTS containers (see Step 3)

# Locally: run the server pointing at the remote GPU services
docker run -p 3000:3000 \
  -e STT_URL=ws://GPU_BOX:8001 \
  -e TTS_URL=http://GPU_BOX:8002 \
  -e AUTH_TOKEN=dev-token \
  simon.azurecr.io/connect-server:latest

# Run the Claude agent locally or wherever
docker run -p 8010:8010 -e ANTHROPIC_API_KEY=sk-ant-... connect-claude
```

## Step 5 — End-to-End Voice Test

1. Open `http://localhost:3000` in Chrome
2. Register the Claude agent (POST to `/api/agents` or have it self-register)
3. Click the Claude agent → door opens → mic activates
4. Speak → you should see transcript appear → then hear Claude's voice reply

## Troubleshooting

| Symptom | Check |
|---------|-------|
| No mic | Browser needs HTTPS or localhost, check permissions |
| STT silent | WebSocket connection to :8001, check CUDA loaded |
| No agent response | `ANTHROPIC_API_KEY` set? Agent registered with server? |
| No audio back | TTS reachable? Check browser console for AudioContext errors |
| GPU container crash | `nvidia-smi` works on host? `nvidia-container-toolkit` installed? |
| Model download slow | First boot pulls models from HuggingFace; subsequent runs use cached Docker volumes |
