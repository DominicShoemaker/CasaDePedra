targetScope = 'resourceGroup'

@description('Existing pricing storage account name.')
param storageAccountName string
@description('Existing Flex Consumption App Service Plan resource ID.')
param appServicePlanId string
@description('Existing Application Insights component name.')
param applicationInsightsName string
@description('Existing user-assigned managed identity resource ID.')
param identityId string
@description('Client ID of the managed identity.')
param identityClientId string
@description('Existing Key Vault containing private calendar URL secrets.')
param keyVaultName string
param location string = resourceGroup().location
param serviceName string = 'func-cdp-pricing-intelligence'
param tags object = {}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' existing = {
  parent: storage
  name: 'default'
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'app-package-pricing-intelligence'
}

resource intelligenceContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'pricing-intelligence'
  properties: { publicAccess: 'None' }
}

resource rawContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'pricing-intelligence-raw'
  properties: { publicAccess: 'None' }
}

module intelligence './app/api.bicep' = {
  name: 'pricing-intelligence-function'
  dependsOn: [deploymentContainer, intelligenceContainer, rawContainer]
  params: {
    name: serviceName
    serviceName: 'pricing-intelligence'
    location: location
    tags: tags
    applicationInsightsName: applicationInsightsName
    appServicePlanId: appServicePlanId
    runtimeName: 'node'
    runtimeVersion: '24'
    storageAccountName: storageAccountName
    deploymentStorageContainerName: deploymentContainer.name
    identityId: identityId
    identityClientId: identityClientId
    enableBlob: true
    appSettings: {
      AZURE_CLIENT_ID: identityClientId
      PRICING_STORAGE_ACCOUNT_URL: 'https://${storageAccountName}.blob.${environment().suffixes.storage}'
      INTELLIGENCE_CONTAINER: intelligenceContainer.name
      INTELLIGENCE_RAW_CONTAINER: rawContainer.name
      AIRBNB_ICAL_URL: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=airbnb-ical-url)'
      VRBO_ICAL_URL: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=vrbo-ical-url)'
      AVAILABILITY_HORIZON_DAYS: '550'
    }
  }
}

output functionAppName string = intelligence.outputs.SERVICE_API_NAME
output intelligenceContainerName string = intelligenceContainer.name
output rawContainerName string = rawContainer.name
