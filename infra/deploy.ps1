# VoiceConnect — end-to-end (re)deploy
#
# Provisions:
#   • Standard ACA env in Sweden Central (server + STT + TTS + sandbox group).
#   • Sandboxes for each agent — restored from a snapshot when --SandboxSnapshotMap
#     is provided, otherwise freshly bootstrapped via sandbox-bootstrap.sh.
#   • Express ACA env in West Central US (per-agent agent apps).
#   • Re-registers each agent with the server.
#
# All steps are idempotent. Safe to re-run after partial failures.
#
# Example: redeploy the captured demo snapshot
#   ./deploy.ps1 -ResourceGroupPrefix voiceconnect `
#                -ImageTag demo-2026-05-28 `
#                -AriaSnapshot aria-demo-2026-05-28 `
#                -NovaSnapshot nova-demo-2026-05-28 `
#                -SkipImageBuild
#
# Example: full from-scratch deploy with fresh images
#   ./deploy.ps1 -ResourceGroupPrefix voiceconnect
[CmdletBinding()]
param(
  [string] $ResourceGroupPrefix = 'voiceconnect',
  [string] $Location            = 'swedencentral',
  [string] $ExpressLocation     = 'westcentralus',
  [string] $AcrName             = 'simon',
  [string] $AcrResourceGroup    = 'simonj',
  [string] $ImageTag            = 'latest',
  [string] $AuthToken           = 'dev-token',
  [string] $GitHubToken,                              # default: gh auth token
  [string] $AriaSnapshot,                             # if set, restore aria from this snapshot
  [string] $NovaSnapshot,                             # if set, restore nova from this snapshot
  [switch] $SkipImageBuild,
  [switch] $RebuildServerOnly,
  [string] $SourceRoot          = (Resolve-Path "$PSScriptRoot\..").Path
)

$ErrorActionPreference = 'Stop'
$env:PYTHONIOENCODING = 'utf-8'  # az acr build streaming workaround on Windows

function Say([string]$msg, [string]$color='Cyan') { Write-Host "▸ $msg" -ForegroundColor $color }
function Done([string]$msg) { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Fail([string]$msg) { Write-Host "  ✗ $msg" -ForegroundColor Red; exit 1 }

# ───────────────────────── Preflight ─────────────────────────
Say 'Preflight: az + aca + gh login'
$sub = (az account show --query id -o tsv 2>$null)
if (-not $sub) { Fail 'Not logged in to az. Run: az login' }
Done "subscription $sub"

$acaBin = "$HOME/.aca/bin/aca"
if (-not (Test-Path $acaBin) -and -not (Get-Command aca -ErrorAction SilentlyContinue)) {
  Fail "aca CLI not found. Install from https://github.com/microsoft/azure-container-apps/tree/main/docs/early/aca-cli"
}
$aca = if (Test-Path $acaBin) { $acaBin } else { 'aca' }

if (-not $GitHubToken) {
  $GitHubToken = (gh auth token 2>$null)
  if (-not $GitHubToken) { Fail 'GitHub token unavailable. Pass -GitHubToken or run `gh auth login`.' }
}
Done 'tools ok'

# ───────────────────────── Pick / create RGs ─────────────────────────
function Next-RGSuffix([string]$prefix) {
  $existing = az group list --query "[?starts_with(name,'$prefix-')].name" -o tsv 2>$null
  $nums = @()
  foreach ($n in $existing) {
    if ($n -match "^$prefix-(\d+)$") { $nums += [int]$Matches[1] }
  }
  if ($nums.Count -eq 0) { return 1 } else { return ([int]($nums | Measure-Object -Maximum).Maximum) + 1 }
}

$suffix     = Next-RGSuffix $ResourceGroupPrefix
$rgMain     = "$ResourceGroupPrefix-$suffix"
$rgExpress  = "$ResourceGroupPrefix-express-$suffix"

Say "Using RGs: $rgMain (main, $Location), $rgExpress (express, $ExpressLocation)"
az group create -n $rgMain    -l $Location        -o none
az group create -n $rgExpress -l $ExpressLocation -o none
Done 'RGs ready'

# ───────────────────────── Image build ─────────────────────────
$acrLoginServer = "$AcrName.azurecr.io"
$acrResourceId  = (az acr show -n $AcrName -g $AcrResourceGroup --query id -o tsv)
if (-not $acrResourceId) { Fail "ACR '$AcrName' not found in RG '$AcrResourceGroup'." }

function Build-Image([string]$image, [string]$ctx, [string]$dockerfile) {
  Say "Building $image:$ImageTag"
  az acr build --registry $AcrName --resource-group $AcrResourceGroup `
    --image "${image}:${ImageTag}" --file $dockerfile $ctx 1>$null 2>&1
  $lastRun = az acr task list-runs --registry $AcrName --resource-group $AcrResourceGroup --top 1 `
    --query "[0].{status:status,id:runId}" -o json | ConvertFrom-Json
  if ($lastRun.status -ne 'Succeeded') { Fail "ACR build failed: $($lastRun.id) status=$($lastRun.status)" }
  Done "built $image:$ImageTag ($($lastRun.id))"
}

if (-not $SkipImageBuild) {
  Build-Image 'connect-server'         "$SourceRoot/services/server"          "$SourceRoot/services/server/Dockerfile"
  Build-Image 'connect-sandbox-agent'  "$SourceRoot/services/agents/sandbox"  "$SourceRoot/services/agents/sandbox/Dockerfile"
  if (-not $RebuildServerOnly) {
    Build-Image 'connect-stt' "$SourceRoot/services/stt" "$SourceRoot/services/stt/Dockerfile"
    Build-Image 'connect-tts' "$SourceRoot/services/tts" "$SourceRoot/services/tts/Dockerfile"
  }
} else {
  Done 'skipping image build (-SkipImageBuild)'
}

# ───────────────────────── Standard env deploy (main.bicep) ─────────────────────────
Say 'Deploying main.bicep (env + server + STT + TTS + sandbox group)'
$mainOut = az deployment group create `
  -g $rgMain -f "$PSScriptRoot/main.bicep" `
  -p namePrefix=$ResourceGroupPrefix `
     acrLoginServer=$acrLoginServer `
     acrResourceId=$acrResourceId `
     imageTag=$ImageTag `
     authToken=$AuthToken `
     sandboxGroupName="$ResourceGroupPrefix-sb" `
  --query properties.outputs -o json | ConvertFrom-Json
if (-not $mainOut) { Fail 'main.bicep deployment did not return outputs' }
$serverUrl       = $mainOut.serverUrl.value
$sandboxGroup    = $mainOut.sandboxGroupName.value
Done "server: $serverUrl"
Done "sandbox group: $sandboxGroup"

# ───────────────────────── Sandboxes per agent ─────────────────────────
$agentSpecs = @(
  @{ Id='aria'; Name='Aria'; Voice='af_sky'; Color='#3b82f6';
     Persona='You are Aria, a warm and curious voice assistant who likes to ask clarifying questions and keep the conversation flowing.';
     Snapshot=$AriaSnapshot },
  @{ Id='nova'; Name='Nova'; Voice='am_adam'; Color='#ec4899';
     Persona='You are Nova, a concise and witty voice assistant who gets to the point quickly and offers a different angle than the other agents.';
     Snapshot=$NovaSnapshot }
)

$bootstrapScript = "$PSScriptRoot/sandbox-bootstrap.sh"
$wrapperPy       = "$SourceRoot/services/agents/sandbox/sandbox_wrapper.py"
if (-not (Test-Path $wrapperPy)) { Fail "sandbox_wrapper.py not found at $wrapperPy" }

$sandboxUrls = @{}
foreach ($a in $agentSpecs) {
  $sbId = $null

  if ($a.Snapshot) {
    Say "Restoring sandbox '$($a.Id)' from snapshot '$($a.Snapshot)'"
    $created = & $aca --sandbox-group $sandboxGroup sandbox create `
      --label "agent-id=$($a.Id)" `
      --snapshot $a.Snapshot 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { Fail "sandbox restore failed: $created" }
    # Find newly created sandbox by label
    $list = & $aca --sandbox-group $sandboxGroup sandbox list -o json 2>$null | ConvertFrom-Json
    $sbId = ($list | Where-Object { $_.labels.'agent-id' -eq $a.Id } | Select-Object -First 1).id
    Done "sandbox $sbId restored"
  } else {
    Say "Provisioning fresh sandbox '$($a.Id)'"
    & $aca --sandbox-group $sandboxGroup sandbox create --label "agent-id=$($a.Id)" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "sandbox create failed for $($a.Id)" }
    $list = & $aca --sandbox-group $sandboxGroup sandbox list -o json 2>$null | ConvertFrom-Json
    $sbId = ($list | Where-Object { $_.labels.'agent-id' -eq $a.Id } | Select-Object -First 1).id

    Say "Uploading wrapper + bootstrap into sandbox $sbId"
    & $aca --sandbox-group $sandboxGroup sandbox fs write `
      --id $sbId --remote /opt/sandbox_wrapper.py --local $wrapperPy 2>&1 | Out-Null
    & $aca --sandbox-group $sandboxGroup sandbox fs write `
      --id $sbId --remote /tmp/sandbox-bootstrap.sh --local $bootstrapScript 2>&1 | Out-Null
    & $aca --sandbox-group $sandboxGroup sandbox exec `
      --id $sbId -- bash -c "GH_TOKEN='$GitHubToken' bash /tmp/sandbox-bootstrap.sh" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "bootstrap failed inside sandbox $sbId" }
    Done "sandbox $sbId bootstrapped"
  }

  # Expose port 8080 anonymously and lock auto-suspend to ~1 year (effectively always-on).
  & $aca --sandbox-group $sandboxGroup sandbox port add --id $sbId --port 8080 --auth anonymous 2>&1 | Out-Null
  & $aca --sandbox-group $sandboxGroup sandbox lifecycle set --id $sbId --auto-suspend 31536000 --mode Memory 2>&1 | Out-Null
  & $aca --sandbox-group $sandboxGroup sandbox resume --id $sbId 2>&1 | Out-Null

  $url = "https://${sbId}--8080.${Location}.adcproxy.io"
  $sandboxUrls[$a.Id] = $url
  Done "sandbox $($a.Id) → $url"
}

# ───────────────────────── Express env deploy ─────────────────────────
Say 'Deploying express.bicep (Express env + agent apps)'

# Express has no MI — fetch ACR admin creds.
az acr update -n $AcrName -g $AcrResourceGroup --admin-enabled true -o none
$acrCreds   = az acr credential show -n $AcrName -g $AcrResourceGroup -o json | ConvertFrom-Json
$acrUser    = $acrCreds.username
$acrPass    = $acrCreds.passwords[0].value

$agentsParam = @(
  foreach ($a in $agentSpecs) {
    @{
      id         = $a.Id
      name       = $a.Name
      voice      = $a.Voice
      color      = $a.Color
      persona    = $a.Persona
      sandboxUrl = $sandboxUrls[$a.Id]
    }
  }
)
$paramsFile = New-TemporaryFile
@{
  '$schema'      = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
  contentVersion = '1.0.0.0'
  parameters     = @{
    location       = @{ value = $ExpressLocation }
    namePrefix     = @{ value = $ResourceGroupPrefix }
    acrLoginServer = @{ value = $acrLoginServer }
    acrUsername    = @{ value = $acrUser }
    acrPassword    = @{ value = $acrPass }
    imageTag       = @{ value = $ImageTag }
    serverUrl      = @{ value = $serverUrl }
    authToken      = @{ value = $AuthToken }
    agents         = @{ value = $agentsParam }
  }
} | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $paramsFile

$expressOut = az deployment group create `
  -g $rgExpress -f "$PSScriptRoot/express.bicep" `
  -p "@$paramsFile" `
  --query properties.outputs -o json | ConvertFrom-Json
Remove-Item $paramsFile -Force

if (-not $expressOut) { Fail 'express.bicep deployment did not return outputs' }
$agentFqdns = $expressOut.agentFqdns.value
foreach ($f in $agentFqdns) { Done "$($f.name): $($f.url)" }

# ───────────────────────── Register agents with server ─────────────────────────
Say 'Registering agents with server'
Start-Sleep -Seconds 10  # give the server a moment to be ready
foreach ($a in $agentSpecs) {
  $fqdn = ($agentFqdns | Where-Object { $_.id -eq $a.Id }).url
  $body = @{
    id      = $a.Id
    name    = $a.Name
    voice   = $a.Voice
    color   = $a.Color
    persona = $a.Persona
    url     = $fqdn
  } | ConvertTo-Json -Compress
  $resp = Invoke-RestMethod -Method Post `
    -Uri "$serverUrl/api/agents?token=$AuthToken" `
    -ContentType 'application/json' -Body $body -ErrorAction Continue
  Done "registered $($a.Id)"
}

# ───────────────────────── Summary ─────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  VoiceConnect deployed" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Open:        $serverUrl/?token=$AuthToken"
Write-Host "  Main RG:     $rgMain"
Write-Host "  Express RG:  $rgExpress"
Write-Host "  Sandboxes:"
foreach ($k in $sandboxUrls.Keys) { Write-Host "    $k → $($sandboxUrls[$k])" }
Write-Host ""
