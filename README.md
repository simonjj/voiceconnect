# VoiceConnect

Real-time multi-agent voice assistant. The browser captures mic audio, streams it
through a Node server to a GPU-backed STT service, then dispatches the transcript
to one or more **sandbox agents** (each running GitHub Copilot CLI inside a
dedicated Azure Container Apps **Sandbox**). Replies are streamed back through a
GPU TTS service and played in the browser.

![Architecture](docs/architecture.svg)

Two voices today (Aria and Nova); the design scales to 4. Each persona has its
own colour, voice, system prompt, and isolated sandbox so tool calls never
collide.

## Repository layout

```
client/                 React + Vite browser UI
server/                 Node WS hub, addressing, TTS queue
services/
  stt/                  Whisper-based STT (FastAPI, GPU)
  tts/                  Kokoro TTS (FastAPI, GPU, float32 PCM @ 24 kHz)
  agents/sandbox/       Generic agent that proxies /chat → sandbox `copilot` CLI
infra/
  main.bicep              Standard-env Azure resources (env, GPU CAs, server, sandbox group)
  express.bicep           Express-env Azure resources (per-agent agent apps in WCUS)
  acr-role.bicep          AcrPull role assignment for the user-assigned MI (standard env only)
  sandbox-bootstrap.sh    Installs the HTTP wrapper + systemd unit inside a fresh sandbox
  deploy.ps1              One-shot end-to-end (re)deploy
Dockerfile              connect-server image (builds client and bundles dist/)
docker-compose.yml      Local dev (without sandboxes)
```

## Architecture highlights

- **Sandbox-per-agent.** Each persona gets a dedicated ACA Sandbox in a
  sandbox group. A small HTTP wrapper (`services/agents/sandbox/sandbox_wrapper.py`)
  runs inside the sandbox under systemd, exposing `/chat` and `/health` on
  port 8080. The agent container app calls the wrapper over HTTPS via the
  per-sandbox `adcproxy.io` URL.
- **Agents on ACA Express.** The two agent container apps live in an Express
  environment in West Central US (Express isn't available in Sweden Central).
  Express envs have no managed identity, no internal ingress, and no GPU —
  fine for these small CPU-only HTTP forwarders.
- **Streaming reply parsing.** The agent reads the Copilot CLI JSONL output and
  emits an NDJSON `{type:"text",content}` event when it sees an
  `assistant.message`. `assistant.message_delta` events are ignored to avoid
  double emission.
- **Addressing.** `server/src/addressing.ts` decides whether a turn is targeted
  at one agent ("hey Aria, …"), broadcast to all ("team, …"), or routed to a
  fallback agent. Mode (`addressed`, `addressed-with-fallback`, or `round-robin`)
  is exposed in the UI.
- **TTS queue.** `server/src/tts-queue.ts` serialises audio output across agents
  so they don't talk over each other. It frames each turn with
  `agent_speaking_start { sample_rate, sequence }` JSON, then forwards binary
  PCM frames verbatim, then `agent_speaking_end`.
- **Scheduled-clock playback.** `client/src/hooks/useAudio.ts` schedules each
  PCM chunk on the `AudioContext` clock (`source.start(nextStartTime)` with
  `nextStartTime = max(currentTime, prevTail)`). It also linearly upsamples to
  the device rate in JS so the browser doesn't independently resample tiny
  buffers and add fade-in/out artifacts at every chunk boundary.
- **Mic.** `AudioWorklet` captures float32 PCM and posts ArrayBuffers up the WS.

## Deploy to Azure

Prereqs:

- `az` logged in to a subscription with sandbox-group support enabled.
- `aca` CLI on PATH (typically at `~/.aca/bin`). See
  [aca-cli docs](https://github.com/microsoft/azure-container-apps/tree/main/docs/early/aca-cli).
- `gh` CLI logged in (we source `gh auth token` for Copilot CLI inside sandboxes).
- An ACR you can push to. The default is `simon.azurecr.io`.

### Fresh deploy

```powershell
cd infra
.\deploy.ps1
# Useful flags:
#   -ResourceGroupPrefix voiceconnect    # creates voiceconnect-N + voiceconnect-express-N
#   -ImageTag latest                     # tag to build/deploy
#   -SkipImageBuild                      # reuse images already in ACR
```

The script:

1. Picks the next free `voiceconnect-N` (and `voiceconnect-express-N`) RGs.
2. Builds and pushes `connect-server`, `connect-sandbox-agent`, `connect-stt`,
   `connect-tts` via ACR tasks (unless `-SkipImageBuild`).
3. Deploys `main.bicep` → standard env, server, STT, TTS, and the sandbox group.
4. For each agent, either restores a sandbox from a snapshot (when
   `-AriaSnapshot` / `-NovaSnapshot` are passed) or creates a fresh sandbox and
   runs `sandbox-bootstrap.sh` to install the HTTP wrapper.
5. Opens port 8080 anonymously on each sandbox and pins auto-suspend to 1 year
   (so the demo doesn't get suspended mid-conversation).
6. Deploys `express.bicep` to the Express RG with the freshly-minted sandbox
   URLs baked into each agent's env.
7. Registers each agent with the server's `/api/agents` endpoint.
8. Prints `https://<server>?token=dev-token` to open in Chrome.

### Redeploy a captured demo from snapshots

```powershell
./infra/deploy.ps1 `
  -ImageTag demo-2026-05-28 `
  -AriaSnapshot aria-demo-2026-05-28 `
  -NovaSnapshot nova-demo-2026-05-28 `
  -SkipImageBuild
```

Snapshots freeze the sandbox disk (Copilot CLI install, wrapper, systemd
unit, env file). Combined with the dated `connect-*:demo-2026-05-28` ACR
tags, this gets the exact captured demo back online from scratch in one
command. See `secrets.template.env` for the full list of overridable values.

## Local dev

`docker-compose up` brings up STT, TTS, server, and the Vite client. Sandbox
agents need real Azure to run, so for local dev point the server at remote
agent FQDNs (the server has env-driven registration, but currently we register
via the deploy script — see *Known limitations* below).

## Operational notes

- **Voices.** Kokoro voices are configured per-agent (`af_sky` for Aria,
  `am_adam` for Nova). Available voices live in `services/tts/`.
- **Authentication.** Single shared `AUTH_TOKEN` (default `dev-token`). The
  client passes it as `?token=…`. Replace before exposing.
- **Server registry.** `server/connect-store.json` is currently written into
  the container's writable layer, so a server image redeploy wipes registered
  agents. The deploy script always re-registers, but if you `az containerapp
  update --image` manually you must re-`POST /api/agents`.
- **Image refresh.** `az containerapp update --image foo:latest` doesn't force
  a re-pull when the tag is unchanged. Use `az acr import` to materialise a new
  tag, then update with that tag.
- **Logs.** `az containerapp logs show --format text` may hit a `'charmap'
  codec` crash on Windows pwsh. Workaround: `--format json | Out-File -Encoding
  utf8`.

## Debugging audio

Append `?debug=1` to the URL to enable a per-turn audio capture panel that
exposes `<audio controls>` plus a download link for each agent reply. The
captured WAV is byte-identical to what was streamed over the wire — useful when
diagnosing playback vs. transport issues.

## Known limitations / TODO

- Server registry isn't persistent. Either mount a volume on
  `connect-store.json` or move to env-driven registration via Bicep.
- No interrupt-during-speech UX yet (the protocol supports it; UI is minimal).
- Round-robin and broadcast modes work but haven't been tuned for long
  multi-turn conversations.
- Only Aria and Nova ship today; adding Pip / Vox / etc. is just another entry
  in the `agentSpecs` array of `infra/deploy.ps1`.
