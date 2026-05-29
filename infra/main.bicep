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

@description('Sandbox group name (created in this RG).')
param sandboxGroupName string = 'voiceconnect-sb'

@description('Full SRE agent endpoint URL (e.g. https://ticket-sre--xxx.<region-hash>.eastus2.azuresre.ai). When empty, the SRE persona container app is skipped.')
param sreEndpoint string = ''

@description('Display name the SRE persona sends with messages (visible in SRE Agent UI thread history).')
param sreDisplayName string = 'VoiceConnect'

@description('Persona text shown in the SRE agent card.')
param srePersona string = 'You are SRE, an Azure operations expert who answers questions about live resources, telemetry, and infrastructure.'

@description('Kokoro voice id for the SRE persona.')
param sreVoice string = 'am_michael'

@description('Hex color for the SRE persona.')
param sreColor string = '#10b981'

var deploySre = !empty(sreEndpoint)

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

// ───────────────────────── Sandbox Group ─────────────────────────
// Sandbox group is created via the `aca` CLI in deploy.ps1 — the
// Microsoft.App/sandboxGroups@2026-02-01-preview ARM type causes
// preflight validation failures so we use the data-plane CLI.

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

// ───────────────────────── SRE persona (CPU, public, optional) ─────────────────────────
// Hosted on the standard env so it can use the UAMI for AAD token acquisition
// against the Azure SRE Agent data plane. Skipped when sreEndpoint is empty.
resource sreApp 'Microsoft.App/containerApps@2024-10-02-preview' = if (deploySre) {
  name: '${namePrefix}-sre'
  location: location
  tags: union(tags, { agentId: 'sre' })
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
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
    }
    template: {
      containers: [
        {
          name: 'sre'
          image: '${acrLoginServer}/connect-sre-agent:${imageTag}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'AGENT_ID',         value: 'sre' }
            { name: 'AGENT_NAME',       value: 'SRE' }
            { name: 'AGENT_VOICE',      value: sreVoice }
            { name: 'AGENT_COLOR',      value: sreColor }
            { name: 'AGENT_PERSONA',    value: srePersona }
            { name: 'SRE_ENDPOINT',     value: sreEndpoint }
            { name: 'SRE_DISPLAY_NAME', value: sreDisplayName }
            { name: 'AZURE_CLIENT_ID',  value: uami.properties.clientId }
            { name: 'SERVER_URL',       value: 'https://${serverApp.properties.configuration.ingress.fqdn}' }
            { name: 'AUTH_TOKEN',       secretRef: 'auth-token' }
            { name: 'PORT',             value: '8080' }
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

output serverUrl string = 'https://${serverApp.properties.configuration.ingress.fqdn}'
output sttFqdn string = sttApp.properties.configuration.ingress.fqdn
output ttsFqdn string = ttsApp.properties.configuration.ingress.fqdn
output environmentName string = cae.name
output identityClientId string = uami.properties.clientId
output identityPrincipalId string = uami.properties.principalId
output sandboxGroupName string = sandboxGroupName
#disable-next-line BCP318
output sreUrl string = deploySre ? 'https://${sreApp.properties.configuration.ingress.fqdn}' : ''
