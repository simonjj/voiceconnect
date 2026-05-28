# VoiceConnect

Real-time multi-agent voice assistant. Browser captures mic audio → Node server →
GPU STT → one or more sandbox agents (each running GitHub Copilot CLI in its own
Azure Container Apps **Sandbox**) → GPU TTS → browser playback.

![Architecture](docs/architecture.svg)

Two voices today (Aria and Nova). Each persona has its own colour, voice, system
prompt, and isolated sandbox so tool calls never collide.

## Layout

```
client/                  React + Vite UI
server/                  Node WS hub, addressing, TTS queue
services/
  stt/                   Whisper STT (FastAPI, GPU)
  tts/                   Kokoro TTS (FastAPI, GPU)
  agents/sandbox/        Agent app — forwards /chat to the sandbox HTTP wrapper
infra/
  main.bicep             Standard env (Sweden Central): server, STT, TTS, sandbox group
  express.bicep          Express env (West Central US): per-agent agent apps
  sandbox-bootstrap.sh   In-sandbox installer for wrapper + systemd unit
  deploy.ps1             One-shot (re)deploy orchestrator
```

## How it works

- **Sandbox per agent.** Each persona has its own ACA Sandbox running a small
  HTTP wrapper (`sandbox_wrapper.py`) under systemd on port 8080, reachable via
  the sandbox's `adcproxy.io` URL.
- **Agents on ACA Express.** Agent container apps live in an Express env in
  WCUS (Express isn't available in Sweden Central). They're thin CPU-only HTTP
  forwarders — the heavy lifting (Copilot CLI) is in the sandbox.
- **Audio path.** Browser `AudioWorklet` → WS → STT → agent → Copilot →
  agent → TTS queue → WS → scheduled-clock playback in the browser.
- **Addressing.** `server/src/addressing.ts` picks whether a turn is targeted
  ("hey Aria, …"), broadcast ("team, …"), or round-robin.

## Deploy

Prereqs: `az` logged in, `aca` CLI on PATH, `gh auth login`, an ACR you can
push to (default `simon.azurecr.io`).

### Fresh deploy

```powershell
./infra/deploy.ps1
```

The script picks the next free `voiceconnect-N` / `voiceconnect-express-N`
RGs, builds images, deploys both Bicep stacks, provisions sandboxes (running
`sandbox-bootstrap.sh` inside each), and registers agents with the server.

### Redeploy the captured demo from snapshots

```powershell
./infra/deploy.ps1 `
  -ImageTag demo-2026-05-28 `
  -AriaSnapshot aria-demo-2026-05-28 `
  -NovaSnapshot nova-demo-2026-05-28 `
  -SkipImageBuild
```

Sandbox snapshots freeze the Copilot CLI install + wrapper. Combined with the
dated ACR tags, this restores the captured demo exactly. See
`secrets.template.env` for overridable parameters.

## Local dev

`docker-compose up` brings up STT, TTS, server, and the Vite client. Sandbox
agents require real Azure.

## Operational notes

- **Auth.** Single shared `AUTH_TOKEN` (`dev-token` by default). Client passes
  it as `?token=…`. Replace before exposing publicly.
- **Debug audio.** Append `?debug=1` to the URL to expose per-turn `<audio>`
  controls + WAV download for diagnosing playback issues.
- **Server registry is ephemeral** (`server/connect-store.json` in writable
  layer). `deploy.ps1` always re-registers; manual `az containerapp update`
  needs a follow-up `POST /api/agents`.
- **Image refresh.** `containerapp update --image foo:latest` doesn't force a
  re-pull on unchanged tags — use `az acr import` to materialise a new tag.

## Known limitations

- No persistent server registry.
- No interrupt-during-speech UX (protocol supports it, UI doesn't).
- Adding more personas = one more entry in the `agentSpecs` array in
  `infra/deploy.ps1`.
