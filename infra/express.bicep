// ACA Express environment + per-agent agent apps.
//
// Express envs have strict constraints (see SKILLS/express-and-sandbox-usage):
//   • Only available in westcentralus / eastasia.
//   • No managed identity — ACR must be pulled with admin creds.
//   • No internal ingress — all apps are public on :443.
//   • No workload profiles — no GPU; CPU only.
//   • Passing `--secrets` at create time silently drops them; we therefore
//     inject the ACR password via a single secret that we know we use.
//
// The agents call into per-instance Copilot CLI sandboxes living in the
// standard env (see main.bicep). Each agent gets its sandbox URL injected
// via SANDBOX_URL.

@description('Location for the Express environment. Must be westcentralus or eastasia.')
@allowed([ 'westcentralus', 'eastasia' ])
param location string = 'westcentralus'

@description('Prefix used for resource names.')
param namePrefix string = 'voiceconnect'

@description('ACR login server (e.g. simon.azurecr.io).')
param acrLoginServer string = 'simon.azurecr.io'

@description('ACR admin username (Express env cannot use Managed Identity).')
param acrUsername string

@description('ACR admin password.')
@secure()
param acrPassword string

@description('Image tag to deploy.')
param imageTag string = 'latest'

@description('Public URL of the VoiceConnect server (used by the agent for callbacks/registration).')
param serverUrl string

@description('Auth token the agent uses to register with the server.')
@secure()
param authToken string

@description('Enable the twilio-bridge container app. When false, the bridge is not deployed.')
param deployTwilioBridge bool = false

@description('Welcome greeting spoken to callers by ConversationRelay.')
param twilioWelcomeGreeting string = 'Hi! You are on with the VoiceConnect agents. Who would you like to talk to?'

@description('Twilio ConversationRelay voice id.')
param twilioVoice string = 'en-US-AriaNeural'

@description('List of agents. Each gets its own Express container app and is wired to a dedicated sandbox.')
param agents array = [
  {
    id: 'aria'
    name: 'Aria'
    voice: 'af_sky'
    color: '#3b82f6'
    persona: 'You are Aria, a warm and curious voice assistant who likes to ask clarifying questions and keep the conversation flowing.'
    sandboxUrl: ''
  }
  {
    id: 'nova'
    name: 'Nova'
    voice: 'am_adam'
    color: '#ec4899'
    persona: 'You are Nova, a concise and witty voice assistant who gets to the point quickly and offers a different angle than the other agents.'
    sandboxUrl: ''
  }
]

var tags = {
  app: 'voiceconnect'
  managedBy: 'bicep'
  envType: 'express'
}

// ───────────────────────── Express environment ─────────────────────────
// environmentMode is only supported on 2026-03-02-preview+; older API
// versions reject it. appLogsConfiguration must be omitted entirely
// (string "none" is not accepted by 2025+ APIs).
#disable-next-line BCP037
resource expressEnv 'Microsoft.App/managedEnvironments@2026-03-02-preview' = {
  name: '${namePrefix}-express-env'
  location: location
  tags: tags
  properties: {
    environmentMode: 'Express'
  }
}

// ───────────────────────── Per-agent container apps ─────────────────────────
resource agentApps 'Microsoft.App/containerApps@2026-03-02-preview' = [for agent in agents: {
  name: '${namePrefix}-agent-${agent.id}'
  location: location
  tags: union(tags, { agentId: agent.id })
  properties: {
    environmentId: expressEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: acrLoginServer
          username: acrUsername
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [ { name: 'acr-password', value: acrPassword } ]
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
          name: 'agent'
          image: '${acrLoginServer}/connect-sandbox-agent:${imageTag}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'AGENT_ID',      value: agent.id }
            { name: 'AGENT_NAME',    value: agent.name }
            { name: 'AGENT_VOICE',   value: agent.voice }
            { name: 'AGENT_COLOR',   value: agent.color }
            { name: 'AGENT_PERSONA', value: agent.persona }
            { name: 'SANDBOX_URL',   value: agent.sandboxUrl }
            { name: 'SANDBOX_TIMEOUT', value: '120' }
            { name: 'SERVER_URL',    value: serverUrl }
            { name: 'AUTH_TOKEN',    value: authToken }
            { name: 'PORT',          value: '8080' }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}]

output environmentName string = expressEnv.name
output agentFqdns array = [for (agent, i) in agents: {
  id: agent.id
  name: agent.name
  fqdn: agentApps[i].properties.configuration.ingress.fqdn
  url: 'https://${agentApps[i].properties.configuration.ingress.fqdn}'
}]

// ───────────────────────── Twilio bridge (optional) ─────────────────────────
resource twilioBridge 'Microsoft.App/containerApps@2026-03-02-preview' = if (deployTwilioBridge) {
  name: '${namePrefix}-twilio-bridge'
  location: location
  tags: union(tags, { component: 'twilio-bridge' })
  properties: {
    environmentId: expressEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: acrLoginServer
          username: acrUsername
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [ { name: 'acr-password', value: acrPassword } ]
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
          name: 'twilio-bridge'
          image: '${acrLoginServer}/connect-twilio-bridge:${imageTag}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'SERVER_URL',       value: serverUrl }
            { name: 'AUTH_TOKEN',    value: authToken }
            { name: 'WELCOME_GREETING', value: twilioWelcomeGreeting }
            { name: 'TWILIO_VOICE',     value: twilioVoice }
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

#disable-next-line BCP318
output twilioBridgeUrl string = deployTwilioBridge ? 'https://${twilioBridge.properties.configuration.ingress.fqdn}' : ''
