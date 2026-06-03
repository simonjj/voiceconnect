<#
.SYNOPSIS
  Recycle a single agent sandbox (delete + recreate from copilot preset with MCP
  connectors) and repoint the agent's relay container app at the new sandbox.

.DESCRIPTION
  Calls New-CopilotSandbox.ps1 to provision a fresh GitHub-Copilot-preset
  sandbox with all MCP connectors attached, locked auto-suspend, wrapper
  bootstrapped. Old sandboxes for the same -AgentId label are deleted (unless
  -KeepOld is set). Then PUTs SANDBOX_URL on the relay container app.

.EXAMPLE
  ./Recycle-Sandbox.ps1 -AgentId nova -ResourceGroup ORB-connect-9 `
                        -SandboxGroup orbconnect-sb
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string] $AgentId,
  [Parameter(Mandatory)] [string] $ResourceGroup,
  [Parameter(Mandatory)] [string] $SandboxGroup,
  [string] $RelayName          = "orbconnect-agent-${AgentId}-relay",
  [string] $ConnectorGateway   = 'orbconnect-sb-connectors-run-ram',
  [string] $ConnectorFilter    = 'Work-IQ-*-MCP-*',
  [switch] $NoConnectors,
  [string] $GitHubToken,
  [int]    $AutoSuspendSeconds = 31536000,
  [string] $Region             = 'swedencentral',
  [switch] $KeepOld
)

$ErrorActionPreference = 'Stop'
$env:ACA_SANDBOX_GROUP = $SandboxGroup

# ── Find existing sandboxes with this agent-id label ──────────────────────────
Write-Host "[recycle] Looking up existing sandboxes labelled agent-id=$AgentId"
$existing = aca sandbox list -g $ResourceGroup -o json 2>$null |
  ConvertFrom-Json |
  Where-Object { $_.labels.'agent-id' -eq $AgentId }
if ($existing) {
  Write-Host "[recycle] Found $($existing.Count) existing sandbox(es) for $AgentId"
  $existing | ForEach-Object { Write-Host "  - $($_.id)  state=$($_.state)" }
} else {
  Write-Host "[recycle] No existing sandbox for $AgentId"
}

# ── Provision new sandbox via shared helper ────────────────────────────────────
$helper = Join-Path $PSScriptRoot 'New-CopilotSandbox.ps1'
$result = & $helper `
  -AgentId            $AgentId `
  -ResourceGroup      $ResourceGroup `
  -SandboxGroup       $SandboxGroup `
  -ConnectorGateway   $ConnectorGateway `
  -ConnectorFilter    $ConnectorFilter `
  -NoConnectors:$NoConnectors `
  -GitHubToken        $GitHubToken `
  -AutoSuspendSeconds $AutoSuspendSeconds `
  -Region             $Region

Write-Host ''
Write-Host "[recycle] New sandbox: $($result.Id)"
Write-Host "[recycle] URL:         $($result.Url)"

# ── Repoint relay (if it exists) ───────────────────────────────────────────────
$relayExists = az containerapp show -n $RelayName -g $ResourceGroup --query name -o tsv 2>$null
if ($relayExists) {
  Write-Host "[recycle] Repointing $RelayName -> SANDBOX_URL=$($result.Url)"
  az containerapp update -n $RelayName -g $ResourceGroup `
    --set-env-vars "SANDBOX_URL=$($result.Url)" -o none
  if ($LASTEXITCODE -ne 0) { throw "containerapp update failed for $RelayName" }
} else {
  Write-Host "[recycle] Container app $RelayName not found; skipping relay repoint"
}

# ── Delete old sandboxes (after relay is repointed, so we don't break traffic) ─
if (-not $KeepOld -and $existing) {
  foreach ($old in $existing) {
    if ($old.id -eq $result.Id) { continue }   # don't delete the new one
    Write-Host "[recycle] Deleting old sandbox $($old.id)"
    aca sandbox delete -g $ResourceGroup --id $old.id --yes 2>&1 | Select-Object -Last 1
  }
}

Write-Host ''
Write-Host "[recycle] DONE."
$result
