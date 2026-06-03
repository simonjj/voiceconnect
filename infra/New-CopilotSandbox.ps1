<#
.SYNOPSIS
  Create a GitHub-Copilot-preset ACA sandbox with MCP gateway connectors attached.

.DESCRIPTION
  The `aca` CLI / YAML schema does NOT expose MCP connector wiring, and PATCH on a
  per-sandbox resource ID returns 404 for `gatewayConnections` (immutable post-create).
  The Azure portal works around this by calling the data-plane management API
  collection-PUT directly:

      PUT https://management.{region}.azuredevcompute.io/subscriptions/{sub}/
          resourceGroups/{rg}/sandboxGroups/{sg}/sandboxes?api-version=2026-02-01-preview
      Body: {
        "presetSandboxType": "GitHubCopilot",
        "labels": { "agent-id": "<id>" },
        "gatewayConnections": [ { "resourceId": "<arm-id-of-mcpserverconfig>" }, ... ]
      }

  This script wraps that call, then performs the standard post-provisioning steps
  the agents require:
    * lifecycle: auto-suspend 1 year (preset defaults to 5 min, which silently
      breaks the agent with HTTP 502 from adcproxy after 5 idle minutes)
    * port: expose :8080 anonymously
    * fs: upload services/agents/sandbox/sandbox_wrapper.py + sandbox-bootstrap.sh
    * exec: run sandbox-bootstrap.sh with GH_TOKEN to write the env file
    * exec: launch the wrapper in a detached subshell (the (...) is required —
      bare `setsid nohup ... &` is reaped when `aca sandbox exec` returns)

  Connectors are discovered by querying the connector-gateway's mcpserverconfigs
  via ARM (token resource: management.core.windows.net). The data-plane PUT uses
  a separate token (resource: management.azuredevcompute.io).

.PARAMETER AgentId
  Logical agent name; written to the sandbox label `agent-id`. Used by
  `Recycle-Sandbox.ps1` and `deploy.ps1` to find sandboxes by agent.

.PARAMETER ResourceGroup
  Resource group containing both the sandbox group and the connector gateway.

.PARAMETER SandboxGroup
  ACA sandbox group name (e.g. `orbconnect-sb`).

.PARAMETER ConnectorGateway
  Microsoft.Web/connectorGateways resource name. Default is the orbconnect gateway.

.PARAMETER ConnectorFilter
  Wildcard to filter mcpserverconfigs by name. Default `Work-IQ-*-MCP-*` matches
  the three Work-IQ servers (Calendar / Mail / Teams) regardless of random suffix.
  Ignored when -NoConnectors is set.

.PARAMETER NoConnectors
  Provision the sandbox without any MCP connectors attached. Useful for agents
  that should match the copilot-preset sizing (4 CPU / 8 Gi / 10 Gi) but talk
  only to GitHub.

.PARAMETER GitHubToken
  Token written into /etc/sandbox-wrapper.env so the in-sandbox `copilot` CLI
  authenticates as the operator. Defaults to `gh auth token`.

.PARAMETER AutoSuspendSeconds
  Seconds before idle suspend. Default 31536000 (~1 year). DO NOT lower this for
  long-running demos — see "Sandbox auto-suspend gotcha" in README.md.

.PARAMETER Region
  Sandbox group region. Used to build both the management URL and the public
  adcproxy URL.

.PARAMETER SourceRoot
  Repo root, used to locate sandbox_wrapper.py and sandbox-bootstrap.sh.

.OUTPUTS
  PSCustomObject with: Id, Url, ResourceGroup, SandboxGroup.

.EXAMPLE
  ./New-CopilotSandbox.ps1 -AgentId nova -ResourceGroup ORB-connect-9 `
                           -SandboxGroup orbconnect-sb
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string] $AgentId,
  [Parameter(Mandatory)] [string] $ResourceGroup,
  [Parameter(Mandatory)] [string] $SandboxGroup,
  [string] $ConnectorGateway   = 'orbconnect-sb-connectors-run-ram',
  [string] $ConnectorFilter    = 'Work-IQ-*-MCP-*',
  [switch] $NoConnectors,
  [string] $GitHubToken,
  [int]    $AutoSuspendSeconds = 31536000,
  [string] $Region             = 'swedencentral',
  [string] $SourceRoot         = (Resolve-Path "$PSScriptRoot\..").Path
)

$ErrorActionPreference = 'Stop'
$env:ACA_SANDBOX_GROUP = $SandboxGroup

$wrapperPy   = Join-Path $SourceRoot 'services\agents\sandbox\sandbox_wrapper.py'
$bootstrapSh = Join-Path $PSScriptRoot 'sandbox-bootstrap.sh'
foreach ($f in @($wrapperPy, $bootstrapSh)) {
  if (-not (Test-Path $f)) { throw "Required file not found: $f" }
}

if (-not $GitHubToken) {
  $GitHubToken = (gh auth token 2>$null)
  if (-not $GitHubToken) { throw 'GitHub token unavailable. Pass -GitHubToken or run `gh auth login`.' }
}

$sub = (az account show --query id -o tsv 2>$null)
if (-not $sub) { throw 'Not logged in to az. Run: az login' }

# ── 1. Discover MCP server configs via ARM ──────────────────────────────────────
$connectors = @()
if ($NoConnectors) {
  Write-Host "[1/7] Skipping MCP connector discovery (-NoConnectors)"
} else {
  Write-Host "[1/7] Discovering MCP connectors on $ConnectorGateway (filter '$ConnectorFilter')"
  $armToken = az account get-access-token --resource 'https://management.core.windows.net/' --query accessToken -o tsv
  $mcpUri = "https://management.azure.com/subscriptions/$sub/resourceGroups/$ResourceGroup/providers/Microsoft.Web/connectorGateways/$ConnectorGateway/mcpserverconfigs?api-version=2026-05-01-preview"
  $mcpResp = curl.exe -sS -H "Authorization: Bearer $armToken" $mcpUri | ConvertFrom-Json
  $connectors = @($mcpResp.value | Where-Object { $_.name -like $ConnectorFilter })
  if ($connectors.Count -eq 0) {
    throw "No mcpserverconfigs matching '$ConnectorFilter' on gateway $ConnectorGateway"
  }
  $connectors | ForEach-Object { Write-Host "      • $($_.name)" }
}

# ── 2. PUT /sandboxes (collection) with preset + connectors ─────────────────────
Write-Host "[2/7] Creating sandbox via data-plane preset PUT (agent-id=$AgentId)"
$dpToken = az account get-access-token --resource 'https://management.azuredevcompute.io' --query accessToken -o tsv
$dpBase  = "https://management.$Region.azuredevcompute.io/subscriptions/$sub/resourceGroups/$ResourceGroup/sandboxGroups/$SandboxGroup/sandboxes"
$bodyObj = @{
  presetSandboxType  = 'GitHubCopilot'
  labels             = @{ 'agent-id' = $AgentId }
  gatewayConnections = @($connectors | ForEach-Object { @{ resourceId = $_.id } })
}
$body = $bodyObj | ConvertTo-Json -Depth 10 -Compress

$tmp = New-TemporaryFile
try {
  $body | Set-Content -Encoding utf8 -NoNewline $tmp
  $createResp = curl.exe -sS -X PUT "$dpBase`?api-version=2026-02-01-preview" `
    -H "Authorization: Bearer $dpToken" -H 'Content-Type: application/json' `
    --data-binary "@$tmp" -w '`n__HTTP_%{http_code}'
} finally { Remove-Item $tmp -ErrorAction SilentlyContinue }

if ($createResp -notmatch '__HTTP_2\d\d') {
  throw "Sandbox PUT failed: $createResp"
}
$sbId = (($createResp -split '`n__HTTP_')[0] | ConvertFrom-Json).id
if (-not $sbId) { throw "Sandbox PUT returned no id: $createResp" }
Write-Host "      -> $sbId"

# ── 3. Lifecycle: lock auto-suspend (preset default = 300s) ─────────────────────
Write-Host "[3/7] Setting auto-suspend to $AutoSuspendSeconds s (Memory)"
aca sandbox lifecycle set -g $ResourceGroup --id $sbId --auto-suspend $AutoSuspendSeconds --mode Memory 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "lifecycle set failed for $sbId" }

# ── 4. Port: expose :8080 anonymously ───────────────────────────────────────────
Write-Host '[4/7] Exposing port 8080 anonymously'
aca sandbox port add -g $ResourceGroup --id $sbId --port 8080 --anonymous 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "port add failed for $sbId" }

# ── 5. Upload wrapper + bootstrap (the copilot preset has copilot CLI but not our wrapper) ──
Write-Host '[5/7] Uploading sandbox_wrapper.py and sandbox-bootstrap.sh'
aca sandbox fs write -g $ResourceGroup --id $sbId --path /opt/sandbox_wrapper.py --file $wrapperPy 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "fs write wrapper failed for $sbId" }
aca sandbox fs write -g $ResourceGroup --id $sbId --path /tmp/sandbox-bootstrap.sh --file $bootstrapSh 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "fs write bootstrap failed for $sbId" }

# ── 6. Run bootstrap (writes env file, builds runner, attempts launch) ──────────
Write-Host '[6/7] Running bootstrap with GH_TOKEN'
aca sandbox exec -g $ResourceGroup --id $sbId -c "GH_TOKEN='$GitHubToken' bash /tmp/sandbox-bootstrap.sh" 2>&1 | Select-Object -Last 5
if ($LASTEXITCODE -ne 0) { throw "bootstrap failed inside sandbox $sbId" }

# Bootstrap launches the wrapper from inside `aca sandbox exec`, but exec reaps
# the setsid'd child on return. Re-launch via an outer subshell so the child is
# divorced from exec's process tree. Idempotent: pkill in step 6 is harmless.
$launch = "(setsid nohup /opt/sandbox-wrapper-runner.sh >> /var/log/sandbox_wrapper.log 2>&1 < /dev/null &) ; sleep 4; ss -tln 2>/dev/null | grep ':8080 ' && echo OK_LISTENING || echo FAILED"
$launchOut = aca sandbox exec -g $ResourceGroup --id $sbId -c $launch 2>&1 | Out-String
if ($launchOut -notmatch 'OK_LISTENING') {
  Write-Host $launchOut
  throw "Wrapper failed to bind :8080 in $sbId"
}

# ── 7. Probe public URL and return ──────────────────────────────────────────────
$url = "https://${sbId}--8080.${Region}.adcproxy.io"
Write-Host "[7/7] Probing $url/health"
Start-Sleep 2
$probe = curl.exe -sS --max-time 15 "$url/health" 2>&1
Write-Host "      $probe"
if ($probe -notmatch 'ok') { throw "Health probe did not return ok: $probe" }

[pscustomobject]@{
  Id            = $sbId
  Url           = $url
  ResourceGroup = $ResourceGroup
  SandboxGroup  = $SandboxGroup
  AgentId       = $AgentId
  Connectors    = $connectors.name
}
