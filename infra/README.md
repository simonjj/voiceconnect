# Azure Deployment — VoiceConnect on ACA Serverless GPU

## What this deploys
- **Resource Group**: `voiceconnect-N` (auto-incremented) in **swedencentral**
- **ACA Environment** with two workload profiles:
  - `Consumption` (CPU) — server, claude
  - `gpu-t4` (Consumption-GPU-NC8as-T4) — stt, tts
- **4 Container Apps**:
  - `voiceconnect-server` (public ingress :3000) — TS server + React SPA
  - `voiceconnect-claude` (internal :8010) — Anthropic Claude proxy
  - `voiceconnect-stt`    (internal :8001, GPU) — Whisper large-v3 + Silero VAD
  - `voiceconnect-tts`    (internal :8002, GPU) — Kokoro-82M
- **User-assigned MI** with `AcrPull` on `simon.azurecr.io`
- **Log Analytics** workspace for diagnostics

Images are pulled from `simon.azurecr.io/connect-{server,claude,stt,tts}:latest`.

## Files
- `main.bicep`     — main template
- `acr-role.bicep` — module that grants AcrPull on the (cross-RG) ACR
- `deploy.ps1`     — one-shot deploy script

## Deploy

```powershell
cd infra
.\deploy.ps1 -AnthropicApiKey 'sk-ant-...'
```

Or manually:

```powershell
$rg = 'voiceconnect-1'
az group create -n $rg -l swedencentral
$acrId = az acr show -n simon -g simonj --query id -o tsv
az deployment group create -g $rg -f main.bicep `
  -p acrResourceId=$acrId anthropicApiKey='sk-ant-...' authToken='dev-token'
```

After deploy, register the Claude agent with the server (deploy.ps1 does this automatically):

```powershell
$body = @{ id='claude-sonnet'; name='Claude'; url="https://$claudeFqdn"; voice_id='af_sky' } | ConvertTo-Json
Invoke-RestMethod -Uri "$serverUrl/api/agents" -Method POST -Body $body -ContentType 'application/json'
```

## Verify

```powershell
curl https://<serverUrl>/api/health     # {"status":"ok",...}
curl https://<serverUrl>/api/agents     # [{ Claude agent... }]
```

Then open the server URL in Chrome and click the Claude agent.

## Notes
- **Cold-start**: GPU apps download models on first launch (~3GB Whisper, ~80MB Kokoro). Startup probe allows ~20 minutes.
- **minReplicas=1** keeps GPU containers warm (cost!). Drop to 0 if you want scale-to-zero (will reload models on next request).
- **Cross-region pull**: ACR is in `westus`, ACA in `swedencentral`. First pull is slower; subsequent pulls cached at edge.
- To rotate the Anthropic key: `az containerapp secret set -g <rg> -n voiceconnect-claude --secrets anthropic-api-key=sk-ant-... && az containerapp update -g <rg> -n voiceconnect-claude` (forces new revision).
