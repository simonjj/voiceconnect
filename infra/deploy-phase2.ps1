# VoiceConnect — Phase 2 deploy: STT/TTS GPU + N sandbox-agent Container Apps + dedicated sandboxes.
#
# Prereqs:
#   - az logged in to a sub with sandbox-group support
#   - aca CLI on PATH (installed at ~/.aca/bin)
#   - gh CLI logged in (used to source GH_TOKEN for sandboxes)
#   - docker logged into the target ACR (we re-login here)
#
# Usage:
#   .\deploy-phase2.ps1                     # auto-pick next voiceconnect-N
#   .\deploy-phase2.ps1 -ResourceGroup voiceconnect-1   # re-deploy onto an existing RG

param(
  [string]$ResourceGroupPrefix = 'voiceconnect',
  [string]$ResourceGroup = $null,
  [string]$Location = 'swedencentral',
  [string]$AcrName = 'simon',
  [string]$AcrResourceGroup = 'simonj',
  [string]$ImageTag = 'latest',
  [string]$AuthToken = 'dev-token',
  [string]$SandboxGroup = 'voiceconnect-sb',
  [string]$GitHubToken = $null,           # if null, sourced from `gh auth token`
  [string]$GitUserEmail = 'agent@voiceconnect.local',
  [switch]$SkipImageBuild,
  [switch]$SkipSandboxProvisioning
)

$ErrorActionPreference = 'Stop'
$env:PATH = "$HOME\.aca\bin;" + $env:PATH

# ── 1. Resolve / create resource group ────────────────────────────────────
if (-not $ResourceGroup) {
  $existing = az group list --query "[?starts_with(name, '$ResourceGroupPrefix-')].name" -o tsv
  $n = 1
  while ($existing -contains "$ResourceGroupPrefix-$n") { $n++ }
  $ResourceGroup = "$ResourceGroupPrefix-$n"
}
Write-Host "Resource group: $ResourceGroup ($Location)" -ForegroundColor Cyan
az group create -n $ResourceGroup -l $Location --tags app=voiceconnect | Out-Null

$subId = az account show --query id -o tsv
$acrId = az acr show -n $AcrName -g $AcrResourceGroup --query id -o tsv
$acrLogin = az acr show -n $AcrName --query loginServer -o tsv
Write-Host "ACR: $acrLogin"

# ── 2. GH token (used by Copilot CLI in sandboxes) ─────────────────────────
if (-not $GitHubToken) {
  Write-Host "Sourcing GitHub token via gh auth token..." -ForegroundColor Cyan
  $GitHubToken = (gh auth token).Trim()
  if (-not $GitHubToken) { throw "Could not obtain GH token. Run 'gh auth login' or pass -GitHubToken." }
}

# ── 3. Build + push connect-server (with new client) and connect-sandbox-agent ─────────
$env:PYTHONIOENCODING = 'utf-8'
$env:PYTHONUTF8 = '1'
if (-not $SkipImageBuild) {
  Write-Host "Building connect-server image (with fresh client)..." -ForegroundColor Cyan
  $repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
  az acr build --registry $AcrName --resource-group $AcrResourceGroup `
    --image "connect-server:$ImageTag" `
    --file "$repoRoot\Dockerfile" $repoRoot `
    --platform linux/amd64 --no-logs
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "connect-server build returned non-zero (may be log-streaming charmap glitch). Verifying via runs list..."
    $last = az acr task list-runs --registry $AcrName --resource-group $AcrResourceGroup --top 1 --query "[0].{run:runId,status:status}" -o json | ConvertFrom-Json
    if ($last.status -ne 'Succeeded') { throw "connect-server ACR build failed (run $($last.run))" }
  }
  Write-Host "  pushed connect-server:$ImageTag" -ForegroundColor Green

  Write-Host "Building connect-sandbox-agent image..." -ForegroundColor Cyan
  $sandboxSrc = Join-Path $repoRoot 'services\agents\sandbox'
  az acr build --registry $AcrName --resource-group $AcrResourceGroup `
    --image "connect-sandbox-agent:$ImageTag" `
    --file "$sandboxSrc\Dockerfile" $sandboxSrc `
    --platform linux/amd64 --no-logs
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "connect-sandbox-agent build returned non-zero. Verifying via runs list..."
    $last = az acr task list-runs --registry $AcrName --resource-group $AcrResourceGroup --top 1 --query "[0].{run:runId,status:status}" -o json | ConvertFrom-Json
    if ($last.status -ne 'Succeeded') { throw "connect-sandbox-agent ACR build failed (run $($last.run))" }
  }
  Write-Host "  pushed connect-sandbox-agent:$ImageTag" -ForegroundColor Green
}

# ── 4. Ensure sandbox group exists ─────────────────────────────────────────
$sgExists = az resource list -g $ResourceGroup --resource-type 'Microsoft.App/sandboxGroups' --query "[?name=='$SandboxGroup'].id" -o tsv
if (-not $sgExists) {
  Write-Host "Creating sandbox group $SandboxGroup..." -ForegroundColor Cyan
  aca sandboxgroup create --name $SandboxGroup --location $Location -g $ResourceGroup --region $Location -s $subId | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "aca sandboxgroup create failed" }
}

# Configure aca CLI defaults for this session.
aca config set -s $subId -g $ResourceGroup --sandbox-group $SandboxGroup --region $Location | Out-Null

# ── 5. Define agents (must match Bicep `agents` param) ─────────────────────
$agents = @(
  @{ id = 'aria'; name = 'Aria'; voice = 'af_sky';  color = '#3b82f6';
     persona = 'You are Aria, a warm and curious voice assistant who likes to ask clarifying questions and keep the conversation flowing.';
     model = '' }
  @{ id = 'nova'; name = 'Nova'; voice = 'am_adam'; color = '#ec4899';
     persona = 'You are Nova, a concise and witty voice assistant who gets to the point quickly and offers a different angle than the other agents.';
     model = '' }
)

# ── 6. Provision one sandbox per agent ────────────────────────────────────
function Get-OrCreateSandbox([string]$agentId) {
  $found = aca sandbox list -l "agent-id=$agentId" -o json 2>$null | ConvertFrom-Json
  if ($found -and $found.Count -gt 0) {
    return $found[0].id
  }
  $createJson = aca sandbox create `
    --group $SandboxGroup `
    --disk copilot `
    --label "agent-id=$agentId" `
    --label "app=voiceconnect" `
    --env "COPILOT_GITHUB_TOKEN=$GitHubToken" `
    --env "GH_TOKEN=$GitHubToken" `
    --env "COPILOT_GIT_USER_EMAIL=$GitUserEmail" 2>&1 | Out-String
  if ($createJson -match 'Created sandbox:\s+([0-9a-f-]{36})') { return $Matches[1] }
  if ($createJson -match 'Creating sandbox\s+([0-9a-f-]{36})') { return $Matches[1] }
  if ($createJson -match '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})') { return $Matches[1] }
  throw ("Could not parse sandbox id for {0}: {1}" -f $agentId, $createJson)
}

if (-not $SkipSandboxProvisioning) {
  for ($i = 0; $i -lt $agents.Count; $i++) {
    $a = $agents[$i]
    Write-Host "Provisioning sandbox for $($a.name)..." -ForegroundColor Cyan
    $sbId = Get-OrCreateSandbox $a.id
    $a.sandboxId = $sbId
    Write-Host "  $($a.id) -> $sbId" -ForegroundColor Green
  }
} else {
  Write-Host "Skipping sandbox provisioning (using existing sandboxIds)." -ForegroundColor Yellow
}

# ── 7. Deploy Bicep (env, GPU services, server, agent CAs) ─────────────────
Write-Host "Deploying Bicep..." -ForegroundColor Cyan
$bicepAgents = $agents | ForEach-Object {
  @{
    id = $_.id; name = $_.name; voice = $_.voice; color = $_.color
    persona = $_.persona; model = $_.model; sandboxId = $_.sandboxId
  }
}
$paramsFile = New-TemporaryFile
@{
  '$schema' = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
  contentVersion = '1.0.0.0'
  parameters = @{
    acrResourceId = @{ value = $acrId }
    imageTag      = @{ value = $ImageTag }
    authToken     = @{ value = $AuthToken }
    sandboxGroup  = @{ value = $SandboxGroup }
    sandboxRegion = @{ value = $Location }
    githubToken   = @{ value = $GitHubToken }
    agents        = @{ value = $bicepAgents }
  }
} | ConvertTo-Json -Depth 8 | Set-Content -Path $paramsFile.FullName -Encoding UTF8

$deploy = az deployment group create `
  -g $ResourceGroup `
  -n voiceconnect-phase2-deploy `
  -f "$PSScriptRoot\main.bicep" `
  -p "@$($paramsFile.FullName)" `
  --query properties.outputs -o json | ConvertFrom-Json

Remove-Item $paramsFile.FullName -ErrorAction SilentlyContinue
$serverUrl = $deploy.serverUrl.value
$agentFqdns = $deploy.agentFqdns.value
$uamiPrincipalId = $deploy.identityPrincipalId.value

Write-Host "`nDeployment outputs:" -ForegroundColor Green
Write-Host "  Server URL : $serverUrl"
Write-Host "  STT FQDN   : $($deploy.sttFqdn.value)"
Write-Host "  TTS FQDN   : $($deploy.ttsFqdn.value)"
foreach ($a in $agentFqdns) {
  Write-Host "  Agent $($a.id) FQDN: $($a.fqdn)"
}

# ── 8. Grant UAMI sandbox-data-plane role on the sandbox group ─────────────
Write-Host "`nGranting Container Apps SandboxGroup Data Owner to MI (data-plane)..." -ForegroundColor Cyan
aca sandboxgroup role create `
  --role 'Container Apps SandboxGroup Data Owner' `
  --principal-id $uamiPrincipalId `
  --name $SandboxGroup 2>&1 | Out-Null

# Restart agents so they pick up the role on next /healthz cycle.
foreach ($a in $agents) {
  $appName = "voiceconnect-agent-$($a.id)"
  az containerapp revision restart -g $ResourceGroup -n $appName --revision (az containerapp revision list -g $ResourceGroup -n $appName --query "[0].name" -o tsv) 2>&1 | Out-Null
}

# ── 9. Register sandbox agents with the server ─────────────────────────────
Write-Host "`nRegistering agents with server..." -ForegroundColor Cyan
# Wait for server to come up.
$serverReady = $false
for ($i = 0; $i -lt 30; $i++) {
  try { Invoke-RestMethod -Uri "$serverUrl/api/health" -TimeoutSec 5 | Out-Null; $serverReady = $true; break } catch { Start-Sleep -Seconds 5 }
}
if (-not $serverReady) { Write-Warning "Server health check did not pass; proceeding anyway." }

# Drop legacy agents we no longer use.
foreach ($legacy in @('claude','claude-sonnet')) {
  try { Invoke-RestMethod -Uri "$serverUrl/api/agents/$legacy" -Method DELETE -TimeoutSec 5 | Out-Null } catch {}
}

foreach ($a in $agents) {
  $fqdn = ($agentFqdns | Where-Object { $_.id -eq $a.id }).fqdn
  $body = @{
    id           = $a.id
    name         = $a.name
    url          = "https://$fqdn"
    voice_id     = $a.voice
    color        = $a.color
    description  = $a.persona
    capabilities = @('chat')
  } | ConvertTo-Json -Compress
  Invoke-RestMethod -Uri "$serverUrl/api/agents" -Method POST -Body $body -ContentType 'application/json' | Out-Null
  Write-Host "  registered $($a.name) ($($a.id))" -ForegroundColor Green
}

Write-Host "`n✅ Done. Open $serverUrl?token=$AuthToken in Chrome." -ForegroundColor Green
