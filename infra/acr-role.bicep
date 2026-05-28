@description('Name of the ACR (in this resource group scope).')
param acrName string

@description('Principal ID to grant AcrPull.')
param principalId string

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

// AcrPull role definition id (built-in)
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, principalId, acrPullRoleId)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
