@description('Location for all resources.')
param location string = resourceGroup().location

@description('Prefix used for resource names.')
param namePrefix string = 'voiceconnect'

@description('Login server of the Azure Container Registry containing the images (e.g. simon.azurecr.io).')
param acrLoginServer string = 'simon.azurecr.io'

@description('Resource ID of the existing ACR (used for AcrPull role assignment).')
param acrResourceId string

@description('Image tag to deploy.')
param imageTag string = 'latest'

@description('Auth token used by the server for client authentication.')
@secure()
param authToken string = 'dev-token'

@description('Sandbox group name (must already exist in this RG).')
param sandboxGroup string = 'voiceconnect-sb'

@description('Sandbox group region.')
param sandboxRegion string = 'swedencentral'

@description('GitHub token used by Copilot CLI inside agent sandboxes. Optional but recommended.')
@secure()
param githubToken string = ''

@description('List of agent personas to deploy. Each gets its own Container App + dedicated sandbox.')
param agents array = [
  {
    id: 'aria'
    name: 'Aria'
    voice: 'af_sky'
    color: '#3b82f6'
    persona: 'You are Aria, a warm and curious voice assistant who likes to ask clarifying questions and keep the conversation flowing.'
    model: ''
    sandboxId: ''
  }
  {
    id: 'nova'
    name: 'Nova'
    voice: 'am_adam'
    color: '#ec4899'
    persona: 'You are Nova, a concise and witty voice assistant who gets to the point quickly and offers a different angle than the other agents.'
    model: ''
    sandboxId: ''
  }
]

var tags = {
  app: 'voiceconnect'
  managedBy: 'bicep'
}

// ───────────────────────── Log Analytics ─────────────────────────
resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-law'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ───────────────────────── User-assigned Managed Identity ─────────────────────────
resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-mi'
  location: location
  tags: tags
}

// AcrPull role assignment on the existing ACR (cross-RG capable)
module acrRole 'acr-role.bicep' = {
  name: 'acrRoleAssignment'
  scope: resourceGroup(split(acrResourceId, '/')[2], split(acrResourceId, '/')[4])
  params: {
    acrName: split(acrResourceId, '/')[8]
    principalId: uami.properties.principalId
  }
}

// ───────────────────────── Container Apps Environment ─────────────────────────
resource cae 'Microsoft.App/managedEnvironments@2024-10-02-preview' = {
  name: '${namePrefix}-env'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
      {
        name: 'gpu-t4'
        workloadProfileType: 'Consumption-GPU-NC8as-T4'
      }
    ]
  }
}

// ───────────────────────── STT (GPU) ─────────────────────────
resource sttApp 'Microsoft.App/containerApps@2024-10-02-preview' = {
  name: '${namePrefix}-stt'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${uami.id}': {} }
  }
  dependsOn: [ acrRole ]
  properties: {
    environmentId: cae.id
    workloadProfileName: 'gpu-t4'
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: acrLoginServer
          identity: uami.id
        }
      ]
      ingress: {
        external: false
        targetPort: 8001
        transport: 'auto'
        allowInsecure: true
      }
    }
    template: {
      containers: [
        {
          name: 'stt'
          image: '${acrLoginServer}/connect-stt:${imageTag}'
          resources: {
            cpu: 8
            memory: '56Gi'
          }
          probes: [
            {
              type: 'Startup'
              httpGet: { path: '/health', port: 8001 }
              initialDelaySeconds: 60
              periodSeconds: 30
              timeoutSeconds: 10
              failureThreshold: 40
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

// ───────────────────────── TTS (GPU) ─────────────────────────
resource ttsApp 'Microsoft.App/containerApps@2024-10-02-preview' = {
  name: '${namePrefix}-tts'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${uami.id}': {} }
  }
  dependsOn: [ acrRole ]
  properties: {
    environmentId: cae.id
    workloadProfileName: 'gpu-t4'
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: acrLoginServer
          identity: uami.id
        }
      ]
      ingress: {
        external: false
        targetPort: 8002
        transport: 'auto'
        allowInsecure: true
      }
    }
    template: {
      containers: [
        {
          name: 'tts'
          image: '${acrLoginServer}/connect-tts:${imageTag}'
          resources: {
            cpu: 8
            memory: '56Gi'
          }
          probes: [
            {
              type: 'Startup'
              httpGet: { path: '/health', port: 8002 }
              initialDelaySeconds: 30
              periodSeconds: 20
              timeoutSeconds: 10
              failureThreshold: 30
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

// ───────────────────────── Sandbox Agents (CPU) ─────────────────────────
module agentApps 'agent.bicep' = [for agent in agents: {
  name: 'agent-${agent.id}'
  dependsOn: [ acrRole ]
  params: {
    namePrefix: namePrefix
    location: location
    environmentId: cae.id
    uamiId: uami.id
    uamiClientId: uami.properties.clientId
    acrLoginServer: acrLoginServer
    imageTag: imageTag
    agentId: agent.id
    agentName: agent.name
    agentVoice: agent.voice
    agentColor: agent.color
    agentPersona: agent.persona
    agentModel: agent.model
    sandboxId: agent.sandboxId
    sandboxGroup: sandboxGroup
    sandboxRegion: sandboxRegion
    sandboxSubscription: subscription().subscriptionId
    sandboxResourceGroup: resourceGroup().name
    githubToken: githubToken
  }
}]

// ───────────────────────── Server (CPU, public) ─────────────────────────
resource serverApp 'Microsoft.App/containerApps@2024-10-02-preview' = {
  name: '${namePrefix}-server'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${uami.id}': {} }
  }
  dependsOn: [ acrRole ]
  properties: {
    environmentId: cae.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: acrLoginServer
          identity: uami.id
        }
      ]
      secrets: [
        { name: 'auth-token', value: authToken }
      ]
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
    }
    template: {
      containers: [
        {
          name: 'server'
          image: '${acrLoginServer}/connect-server:${imageTag}'
          resources: {
            cpu: json('1.0')
            memory: '2Gi'
          }
          env: [
            { name: 'AUTH_TOKEN', secretRef: 'auth-token' }
            { name: 'STT_URL', value: 'wss://${sttApp.properties.configuration.ingress.fqdn}' }
            { name: 'TTS_URL', value: 'https://${ttsApp.properties.configuration.ingress.fqdn}' }
            { name: 'PORT', value: '3000' }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}

output serverUrl string = 'https://${serverApp.properties.configuration.ingress.fqdn}'
output sttFqdn string = sttApp.properties.configuration.ingress.fqdn
output ttsFqdn string = ttsApp.properties.configuration.ingress.fqdn
output environmentName string = cae.name
output identityClientId string = uami.properties.clientId
output identityPrincipalId string = uami.properties.principalId
output agentFqdns array = [for (agent, i) in agents: {
  id: agent.id
  name: agent.name
  fqdn: agentApps[i].outputs.fqdn
}]
