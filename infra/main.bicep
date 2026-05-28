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
// Hosts the per-agent Copilot CLI sandboxes. Sandboxes themselves are
// created via the `aca` CLI in deploy.ps1 (data-plane) — only the group
// is declared here.
resource sandboxGroup 'Microsoft.App/sandboxGroups@2026-02-01-preview' = {
  name: sandboxGroupName
  location: location
  tags: tags
}

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
output sandboxGroupName string = sandboxGroup.name
