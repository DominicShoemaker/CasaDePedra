import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";

function client(accountUrl) {
  if (!accountUrl) throw new Error("PRICING_STORAGE_ACCOUNT_URL is required");
  return new BlobServiceClient(accountUrl, new DefaultAzureCredential({
    managedIdentityClientId: process.env.AZURE_CLIENT_ID || undefined,
  }));
}

export async function writeImmutableJson({ accountUrl, container, blobName, value }) {
  const containerClient = client(accountUrl).getContainerClient(container);
  const blob = containerClient.getBlockBlobClient(blobName);
  const body = `${JSON.stringify(value, null, 2)}\n`;
  await blob.upload(body, Buffer.byteLength(body), {
    blobHTTPHeaders: { blobContentType: "application/json; charset=utf-8" },
    conditions: { ifNoneMatch: "*" },
  });
  return blob.url;
}

export async function writeLatestJson({ accountUrl, container, blobName, value }) {
  const containerClient = client(accountUrl).getContainerClient(container);
  const blob = containerClient.getBlockBlobClient(blobName);
  const body = `${JSON.stringify(value, null, 2)}\n`;
  await blob.upload(body, Buffer.byteLength(body), {
    overwrite: true,
    blobHTTPHeaders: { blobContentType: "application/json; charset=utf-8" },
  });
  return blob.url;
}
