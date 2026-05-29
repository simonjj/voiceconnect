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
  [string] $SreAgentResourceId,                       # full ARM resource ID of a Microsoft.App/agents (e.g. /subscriptions/.../providers/Microsoft.App/agents/ticket-sre). When set, the SRE persona is deployed and wired to this agent.
  [string] $SreVoice            = 'am_michael',
  [string] $SreColor            = '#10b981',
  [string] $SrePersona          = 'You are SRE, an Azure operations expert who answers questions about live resources, telemetry, and infrastructure. Replies are spoken aloud — keep them conversational and short.',
  [switch] $DeployTwilioBridge,                       # build + deploy the twilio-bridge container app
  [string] $TwilioWelcome       = 'Hi! You are on with the VoiceConnect agents. Who would you like to talk to?',
  [string] $TwilioVoice         = 'en-US-AriaNeural',
  [switch] $SkipImageBuild,
  [switch] $RebuildServerOnly,
  [int]    $ResourceGroupSuffix   = 0,                  # if >0, reuse existing RG suffix instead of picking next
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

$acaBin = if ($IsWindows -or $env:OS -eq 'Windows_NT') { "$HOME/.aca/bin/aca.exe" } else { "$HOME/.aca/bin/aca" }
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
  $existing = az group list -o tsv --query "[].name" 2>$null
  $nums = @()
  foreach ($n in $existing) {
    if ($n -match "^$prefix-(\d+)$") { $nums += [int]$Matches[1] }
  }
  if ($nums.Count -eq 0) { return 1 } else { return ([int]($nums | Measure-Object -Maximum).Maximum) + 1 }
}

$suffix     = if ($ResourceGroupSuffix -gt 0) { $ResourceGroupSuffix } else { Next-RGSuffix $ResourceGroupPrefix }
$rgMain     = "$ResourceGroupPrefix-$suffix"
$rgExpress  = "$ResourceGroupPrefix-express-$suffix"
# ACA names must be lowercase alphanumeric+dash. Derive a safe namePrefix from
# the RG prefix (e.g. "ORB-connect" → "orbconnect").
$namePrefix = ($ResourceGroupPrefix -replace '[^A-Za-z0-9]', '').ToLowerInvariant()
if (-not $namePrefix) { $namePrefix = 'voiceconnect' }

Say "Using RGs: $rgMain (main, $Location), $rgExpress (express, $ExpressLocation)"
az group create -n $rgMain    -l $Location        -o none
az group create -n $rgExpress -l $ExpressLocation -o none
Done 'RGs ready'

# ───────────────────────── Image build ─────────────────────────
$acrLoginServer = "$AcrName.azurecr.io"
$acrResourceId  = (az acr show -n $AcrName -g $AcrResourceGroup --query id -o tsv)
if (-not $acrResourceId) { Fail "ACR '$AcrName' not found in RG '$AcrResourceGroup'." }

function Build-Image([string]$image, [string]$ctx, [string]$dockerfile) {
  Say "Building ${image}:$ImageTag"
  # --no-logs avoids the colorama unicode crash on Windows cp1252 consoles
  # when image build output contains characters like ✓ from vite/etc.
  az acr build --registry $AcrName --resource-group $AcrResourceGroup `
    --image "${image}:${ImageTag}" --file $dockerfile $ctx --no-logs -o none
  if ($LASTEXITCODE -ne 0) { Fail "ACR build failed for ${image}:$ImageTag (exit $LASTEXITCODE)" }
  Done "built ${image}:$ImageTag"
}

if (-not $SkipImageBuild) {
  Build-Image 'connect-server'         "$SourceRoot"                          "$SourceRoot/Dockerfile"
  Build-Image 'connect-sandbox-agent'  "$SourceRoot/services/agents/sandbox"  "$SourceRoot/services/agents/sandbox/Dockerfile"
  if ($SreAgentResourceId) {
    Build-Image 'connect-sre-agent'    "$SourceRoot/services/agents/sre"      "$SourceRoot/services/agents/sre/Dockerfile"
  }
  if ($DeployTwilioBridge) {
    Build-Image 'connect-twilio-bridge' "$SourceRoot/services/twilio-bridge"  "$SourceRoot/services/twilio-bridge/Dockerfile"
  }
  if (-not $RebuildServerOnly) {
    Build-Image 'connect-stt' "$SourceRoot/services/stt" "$SourceRoot/services/stt/Dockerfile"
    Build-Image 'connect-tts' "$SourceRoot/services/tts" "$SourceRoot/services/tts/Dockerfile"
  }
} else {
  Done 'skipping image build (-SkipImageBuild)'
}

# ───────────────────────── Resolve SRE agent endpoint ─────────────────────────
$sreEndpoint = ''
if ($SreAgentResourceId) {
  Say "Resolving SRE agent endpoint from $SreAgentResourceId"
  $sreEndpoint = az resource show --ids $SreAgentResourceId --query properties.agentEndpoint -o tsv 2>$null
  if (-not $sreEndpoint) { Fail "Could not resolve agentEndpoint from $SreAgentResourceId" }
  Done "SRE endpoint: $sreEndpoint"
}

# ───────────────────────── Pre-create managed env via REST ─────────────────────────
# Bicep deployments fail preflight with ManagedEnvironmentNotReadyForAppCreation
# when env + apps are created in the same template. Pre-create env via direct REST,
# wait for Succeeded, then let bicep's incremental deploy update/no-op the env and
# create the apps.
Say 'Pre-creating managed env via REST (works around bicep preflight race)'
$sub = az account show --query id -o tsv
az monitor log-analytics workspace create -g $rgMain -n "$namePrefix-law" -l $Location -o none 2>$null
$lawCid = az monitor log-analytics workspace show -g $rgMain -n "$namePrefix-law" --query customerId -o tsv
$lawKey = az monitor log-analytics workspace get-shared-keys -g $rgMain -n "$namePrefix-law" --query primarySharedKey -o tsv
$envBody = @{
  location = $Location
  tags = @{ app = 'voiceconnect'; managedBy = 'bicep' }
  properties = @{
    appLogsConfiguration = @{ destination = 'log-analytics'; logAnalyticsConfiguration = @{ customerId = $lawCid; sharedKey = $lawKey } }
    workloadProfiles = @(
      @{ name = 'Consumption'; workloadProfileType = 'Consumption' },
      @{ name = 'gpu-t4'; workloadProfileType = 'Consumption-GPU-NC8as-T4' }
    )
  }
} | ConvertTo-Json -Depth 10 -Compress
$envBodyFile = New-TemporaryFile
$envBody | Set-Content -NoNewline -Path $envBodyFile.FullName
$envUri = "https://management.azure.com/subscriptions/$sub/resourceGroups/$rgMain/providers/Microsoft.App/managedEnvironments/$namePrefix-env?api-version=2024-10-02-preview"
az rest --method put --uri $envUri --body "@$($envBodyFile.FullName)" -o none
Remove-Item $envBodyFile.FullName
do {
  Start-Sleep 15
  $envState = az containerapp env show -g $rgMain -n "$namePrefix-env" --query "properties.provisioningState" -o tsv 2>$null
  Write-Host "  env state: $envState"
} while ($envState -ne 'Succeeded' -and $envState -ne 'Failed')
if ($envState -ne 'Succeeded') { Fail "Managed env failed to provision (state=$envState)" }
Done "env $namePrefix-env ready"

# ───────────────────────── Standard env deploy (main.bicep) ─────────────────────────
Say 'Deploying main.bicep (env + server + STT + TTS + sandbox group)'
$mainOut = az deployment group create `
  -g $rgMain -f "$PSScriptRoot/main.bicep" `
  -p namePrefix=$namePrefix `
     acrLoginServer=$acrLoginServer `
     acrResourceId=$acrResourceId `
     imageTag=$ImageTag `
     authToken=$AuthToken `
     sandboxGroupName="$namePrefix-sb" `
     sreEndpoint="$sreEndpoint" `
     sreVoice="$SreVoice" `
     sreColor="$SreColor" `
     srePersona="$SrePersona" `
  --query properties.outputs -o json | ConvertFrom-Json
if (-not $mainOut) { Fail 'main.bicep deployment did not return outputs' }
$serverUrl       = $mainOut.serverUrl.value
$sandboxGroup    = $mainOut.sandboxGroupName.value
$sreUrl          = if ($mainOut.PSObject.Properties.Match('sreUrl')) { $mainOut.sreUrl.value } else { '' }
Done "server: $serverUrl"
Done "sandbox group: $sandboxGroup"
if ($sreUrl) { Done "sre persona: $sreUrl" }

# ───────────────────────── Create sandbox group via aca CLI ─────────────────────────
Say "Creating sandbox group '$sandboxGroup' via aca CLI"
$sbgExists = & $aca -g $rgMain sandboxgroup get --sandbox-group $sandboxGroup -o json 2>$null
if (-not $sbgExists) {
  & $aca -g $rgMain sandboxgroup create --name $sandboxGroup --location $Location 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "aca sandboxgroup create failed for $sandboxGroup" }
  Done "sandbox group created"
} else {
  Done "sandbox group already exists"
}

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
    $created = & $aca -g $rgMain --sandbox-group $sandboxGroup sandbox create `
      --label "agent-id=$($a.Id)" `
      --snapshot $a.Snapshot 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { Fail "sandbox restore failed: $created" }
    # Find newly created sandbox by label
    $list = & $aca -g $rgMain --sandbox-group $sandboxGroup sandbox list -o json 2>$null | ConvertFrom-Json
    $sbId = ($list | Where-Object { $_.labels.'agent-id' -eq $a.Id } | Select-Object -First 1).id
    Done "sandbox $sbId restored"
  } else {
    Say "Provisioning fresh sandbox '$($a.Id)'"
    & $aca -g $rgMain --sandbox-group $sandboxGroup sandbox create --label "agent-id=$($a.Id)" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "sandbox create failed for $($a.Id)" }
    $list = & $aca -g $rgMain --sandbox-group $sandboxGroup sandbox list -o json 2>$null | ConvertFrom-Json
    $sbId = ($list | Where-Object { $_.labels.'agent-id' -eq $a.Id } | Select-Object -First 1).id

    Say "Uploading wrapper + bootstrap into sandbox $sbId"
    & $aca -g $rgMain --sandbox-group $sandboxGroup sandbox fs write `
      --id $sbId --path /opt/sandbox_wrapper.py --file $wrapperPy 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "fs write wrapper failed for $sbId" }
    & $aca -g $rgMain --sandbox-group $sandboxGroup sandbox fs write `
      --id $sbId --path /tmp/sandbox-bootstrap.sh --file $bootstrapScript 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "fs write bootstrap failed for $sbId" }
    & $aca -g $rgMain --sandbox-group $sandboxGroup sandbox exec `
      --id $sbId -c "GH_TOKEN='$GitHubToken' bash /tmp/sandbox-bootstrap.sh" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "bootstrap failed inside sandbox $sbId" }
    Done "sandbox $sbId bootstrapped"
  }

  # Expose port 8080 anonymously and lock auto-suspend to ~1 year (effectively always-on).
  # NOTE: aca CLI uses `--anonymous` (newer flag); older `--auth anonymous` was removed.
  & $aca -g $rgMain --sandbox-group $sandboxGroup sandbox port add --id $sbId --port 8080 --anonymous 2>&1 | Out-Null
  & $aca -g $rgMain --sandbox-group $sandboxGroup sandbox lifecycle set --id $sbId --auto-suspend 31536000 --mode Memory 2>&1 | Out-Null
  & $aca -g $rgMain --sandbox-group $sandboxGroup sandbox resume --id $sbId 2>&1 | Out-Null

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
    namePrefix     = @{ value = $namePrefix }
    acrLoginServer = @{ value = $acrLoginServer }
    acrUsername    = @{ value = $acrUser }
    acrPassword    = @{ value = $acrPass }
    imageTag       = @{ value = $ImageTag }
    serverUrl      = @{ value = $serverUrl }
    authToken      = @{ value = $AuthToken }
    agents         = @{ value = $agentsParam }
    deployTwilioBridge   = @{ value = [bool]$DeployTwilioBridge }
    twilioWelcomeGreeting = @{ value = $TwilioWelcome }
    twilioVoice    = @{ value = $TwilioVoice }
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
$twilioBridgeUrl = if ($expressOut.PSObject.Properties.Match('twilioBridgeUrl')) { $expressOut.twilioBridgeUrl.value } else { '' }
if ($twilioBridgeUrl) { Done "twilio bridge: $twilioBridgeUrl" }

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

if ($sreUrl) {
  $body = @{
    id      = 'sre'
    name    = 'SRE'
    voice   = $SreVoice
    color   = $SreColor
    persona = $SrePersona
    url     = $sreUrl
  } | ConvertTo-Json -Compress
  Invoke-RestMethod -Method Post `
    -Uri "$serverUrl/api/agents?token=$AuthToken" `
    -ContentType 'application/json' -Body $body -ErrorAction Continue | Out-Null
  Done 'registered sre'
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
if ($sreUrl) { Write-Host "  SRE persona: $sreUrl" }
if ($twilioBridgeUrl) {
  Write-Host ""
  Write-Host "  Twilio bridge: $twilioBridgeUrl"
  Write-Host "    → Set this number's Voice webhook to: $twilioBridgeUrl/twiml"
}
Write-Host ""
