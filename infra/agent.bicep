@description('Per-agent Container App module for sandbox-backed agents.')
param namePrefix string
param location string
param environmentId string
param uamiId string
param acrLoginServer string
param imageTag string

@description('Agent stable id, e.g. "aria".')
param agentId string

@description('Agent display name, e.g. "Aria".')
param agentName string

@description('Kokoro voice id, e.g. af_sky.')
param agentVoice string

@description('Halo/UI accent color in hex, e.g. #3b82f6.')
param agentColor string

@description('Short voice-friendly persona description.')
param agentPersona string

@description('Optional Copilot model override (e.g. claude-sonnet-4.5). Empty = default.')
param agentModel string = ''

@description('UUID of the sandbox dedicated to this agent.')
param sandboxId string

@description('Sandbox group name.')
param sandboxGroup string

@description('Sandbox group region (e.g. swedencentral).')
param sandboxRegion string

@description('Subscription that owns the sandbox group.')
param sandboxSubscription string

@description('Resource group that owns the sandbox group.')
param sandboxResourceGroup string

@description('Client ID of the user-assigned managed identity (used by aca CLI).')
param uamiClientId string

@description('GitHub token used by Copilot CLI inside the sandbox (passed to sandbox at provisioning time, but the agent CA does not need it). Kept here for symmetry; pass empty to skip.')
@secure()
param githubToken string = ''

var tags = {
  app: 'voiceconnect'
  managedBy: 'bicep'
  agentId: agentId
}

resource agentApp 'Microsoft.App/containerApps@2024-10-02-preview' = {
  name: '${namePrefix}-agent-${agentId}'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${uamiId}': {} }
  }
  properties: {
    environmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: acrLoginServer
          identity: uamiId
        }
      ]
      secrets: empty(githubToken) ? [] : [
        { name: 'github-token', value: githubToken }
      ]
      ingress: {
        external: false
        targetPort: 8020
        transport: 'auto'
        allowInsecure: true
      }
    }
    template: {
      containers: [
        {
          name: 'agent'
          image: '${acrLoginServer}/connect-sandbox-agent:${imageTag}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: concat([
            { name: 'PORT', value: '8020' }
            { name: 'AGENT_ID', value: agentId }
            { name: 'AGENT_NAME', value: agentName }
            { name: 'AGENT_VOICE', value: agentVoice }
            { name: 'AGENT_COLOR', value: agentColor }
            { name: 'AGENT_PERSONA', value: agentPersona }
            { name: 'AGENT_MODEL', value: agentModel }
            { name: 'SANDBOX_ID', value: sandboxId }
            { name: 'SANDBOX_GROUP', value: sandboxGroup }
            // aca CLI configuration via env vars
            { name: 'AZURE_SUBSCRIPTION_ID', value: sandboxSubscription }
            { name: 'ACA_RESOURCE_GROUP', value: sandboxResourceGroup }
            { name: 'ACA_SANDBOX_GROUP', value: sandboxGroup }
            { name: 'ACA_SANDBOXGROUP_REGION', value: sandboxRegion }
            { name: 'ACA_MANAGED_IDENTITY', value: 'true' }
            { name: 'ACA_MANAGED_IDENTITY_CLIENT_ID', value: uamiClientId }
          ], empty(githubToken) ? [] : [
            { name: 'GH_TOKEN', secretRef: 'github-token' }
          ])
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/healthz', port: 8020 }
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

output fqdn string = agentApp.properties.configuration.ingress.fqdn
output appName string = agentApp.name
