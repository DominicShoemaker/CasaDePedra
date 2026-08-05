import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";
import { PriceEngineError } from "@pmc/price-engine";
import { compileCalendarText } from "./calendar-store.js";
import { compileRuleText } from "./rule-file-store.js";

function credential(clientId) {
  return clientId ? new ManagedIdentityCredential(clientId) : new DefaultAzureCredential();
}

async function downloadText(blobClient, maximumBytes) {
  const properties = await blobClient.getProperties();
  if ((properties.contentLength ?? 0) > maximumBytes) {
    throw new PriceEngineError("CONFIG_BLOB_TOO_LARGE", `Configuration blob cannot exceed ${maximumBytes} bytes.`);
  }
  const buffer = await blobClient.downloadToBuffer(0, maximumBytes + 1);
  if (buffer.length > maximumBytes) throw new PriceEngineError("CONFIG_BLOB_TOO_LARGE", `Configuration blob cannot exceed ${maximumBytes} bytes.`);
  return { text: buffer.toString("utf8"), etag: properties.etag ?? null };
}

class BlobStoreBase {
  constructor(accountUrl, containerName, blobName, { clientId, autoReload = true } = {}) {
    this.blobClient = new BlobServiceClient(accountUrl, credential(clientId)).getContainerClient(containerName).getBlobClient(blobName);
    this.sourceName = `azure-blob://${containerName}/${blobName}`;
    this.autoReload = autoReload;
    this.lastReloadError = null;
  }

  async changed(signature) {
    if (!this.autoReload || !signature) return false;
    return (await this.blobClient.getProperties()).etag !== signature;
  }
}

export class RuleBlobStore extends BlobStoreBase {
  #snapshot = null;

  get snapshot() {
    if (!this.#snapshot) throw new PriceEngineError("SERVICE_NOT_READY", "No valid rule set has been loaded.");
    return this.#snapshot;
  }
  get ready() { return this.#snapshot !== null; }

  async initialize() { await this.reload(false); }
  async reload(retainLastKnownGood = true) {
    try {
      const { text, etag } = await downloadText(this.blobClient, 1_048_576);
      this.#snapshot = compileRuleText(text, this.sourceName, etag);
      this.lastReloadError = null;
      return true;
    } catch (error) {
      this.lastReloadError = { code: error.code ?? "RULE_RELOAD_FAILED", message: error.message, at: new Date().toISOString() };
      if (!retainLastKnownGood || !this.#snapshot) throw error;
      return false;
    }
  }
  async refreshIfChanged() { return await this.changed(this.#snapshot?.sourceSignature) ? this.reload(true) : false; }
  status() {
    return {
      ready: this.ready,
      ruleSet: this.#snapshot ? { id: this.#snapshot.ruleSet.rule_set.id, version: this.#snapshot.ruleSet.rule_set.version, hash: this.#snapshot.hash, loadedAt: this.#snapshot.loadedAt } : null,
      lastReloadError: this.lastReloadError,
    };
  }
}

export class CalendarBlobStore extends BlobStoreBase {
  #record = null;
  get snapshot() { return this.#record?.snapshot ?? null; }
  get hash() { return this.#record?.hash ?? null; }

  async initialize() { await this.reload(false); }
  async reload(retainLastKnownGood = true) {
    try {
      const { text, etag } = await downloadText(this.blobClient, 4_194_304);
      this.#record = compileCalendarText(text, etag);
      this.lastReloadError = null;
      return true;
    } catch (error) {
      this.lastReloadError = { code: error.code ?? "CALENDAR_RELOAD_FAILED", message: error.message, at: new Date().toISOString() };
      if (!retainLastKnownGood || !this.#record) throw error;
      return false;
    }
  }
  async refreshIfChanged() { return await this.changed(this.#record?.sourceSignature) ? this.reload(true) : false; }
  status() {
    return {
      id: this.snapshot?.id ?? null,
      hash: this.hash,
      coverage: this.snapshot?.coverage ?? null,
      expiresAt: this.snapshot?.expiresAt ?? null,
      loadedAt: this.#record?.loadedAt ?? null,
      ready: this.snapshot !== null,
      lastReloadError: this.lastReloadError,
    };
  }
}
