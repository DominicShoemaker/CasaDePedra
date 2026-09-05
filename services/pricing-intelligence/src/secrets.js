import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

function credential() {
  return new DefaultAzureCredential({
    managedIdentityClientId: process.env.AZURE_CLIENT_ID || undefined,
  });
}

export async function getSecretValue(name) {
  const vaultUrl = process.env.KEY_VAULT_URL;
  if (!vaultUrl) throw new Error("KEY_VAULT_URL is required");
  const client = new SecretClient(vaultUrl, credential());
  const secret = await client.getSecret(name);
  if (!secret.value) throw new Error(`Key Vault secret ${name} has no value`);
  return secret.value;
}

export async function getProviderCalendarUrls() {
  // Local development may supply the URLs directly. Production should use Key Vault.
  const airbnb = process.env.AIRBNB_ICAL_URL || await getSecretValue(process.env.AIRBNB_ICAL_SECRET_NAME ?? "airbnb-ical-url");
  const vrbo = process.env.VRBO_ICAL_URL || await getSecretValue(process.env.VRBO_ICAL_SECRET_NAME ?? "vrbo-ical-url");
  return { airbnb, vrbo };
}
