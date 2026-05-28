# VoiceConnect — Deploy to Azure Container Apps (Serverless GPU)
# Usage: .\deploy.ps1 -AnthropicApiKey "sk-ant-..."
param(
  [string]$ResourceGroupPrefix = 'voiceconnect',
  [string]$Location = 'swedencentral',
  [string]$AcrName = 'simon',
  [string]$AcrResourceGroup = 'simonj',
  [string]$ImageTag = 'latest',
  [Parameter(Mandatory=$false)][string]$AnthropicApiKey = 'placeholder',
  [string]$AuthToken = 'dev-token'
)

# Find next available RG name
$existing = az group list --query "[?starts_with(name, '$ResourceGroupPrefix-')].name" -o tsv
$n = 1
while ($existing -contains "$ResourceGroupPrefix-$n") { $n++ }
$rg = "$ResourceGroupPrefix-$n"
Write-Host "Using resource group: $rg ($Location)" -ForegroundColor Cyan

az group create -n $rg -l $Location --tags app=voiceconnect | Out-Null

$acrId = az acr show -n $AcrName -g $AcrResourceGroup --query id -o tsv
Write-Host "ACR: $acrId" -ForegroundColor Cyan

Write-Host "Deploying bicep..." -ForegroundColor Cyan
$deploy = az deployment group create `
  -g $rg `
  -n voiceconnect-deploy `
  -f "$PSScriptRoot\main.bicep" `
  -p acrResourceId=$acrId imageTag=$ImageTag anthropicApiKey=$AnthropicApiKey authToken=$AuthToken `
  --query properties.outputs -o json | ConvertFrom-Json

$serverUrl  = $deploy.serverUrl.value
$claudeFqdn = $deploy.claudeFqdn.value

Write-Host "`nDeployment outputs:" -ForegroundColor Green
Write-Host "  Server URL : $serverUrl"
Write-Host "  STT FQDN   : $($deploy.sttFqdn.value)"
Write-Host "  TTS FQDN   : $($deploy.ttsFqdn.value)"
Write-Host "  Claude FQDN: $claudeFqdn"

# Register Claude agent with the server
Write-Host "`nRegistering Claude agent..." -ForegroundColor Cyan
$body = @{
  id           = 'claude-sonnet'
  name         = 'Claude'
  url          = "https://$claudeFqdn"
  voice_id     = 'af_sky'
  description  = 'General-purpose AI assistant powered by Claude'
  capabilities = @('chat','code','analysis','writing')
} | ConvertTo-Json
Invoke-RestMethod -Uri "$serverUrl/api/agents" -Method POST -Body $body -ContentType 'application/json' | Out-Null

Write-Host "`nDone! Open $serverUrl in your browser." -ForegroundColor Green
