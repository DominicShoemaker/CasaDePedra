import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { canonicalJson, compileRuleSet, PriceEngineError } from "@pmc/price-engine";
import { parseDocument } from "yaml";

const MAX_RULE_FILE_BYTES = 1_048_576;

function parseRuleText(text, filePath) {
  if (extname(filePath).toLowerCase() === ".json") {
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new PriceEngineError("RULE_FILE_INVALID", `Rules JSON is invalid: ${error.message}`);
    }
  }

  const document = parseDocument(text, {
    version: "1.2",
    schema: "core",
    merge: false,
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new PriceEngineError("RULE_FILE_INVALID", "Rules YAML is invalid.", {
      errors: document.errors.map((error) => error.message),
    });
  }
  try {
    return document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    throw new PriceEngineError("RULE_FILE_INVALID", `Rules YAML cannot be converted safely: ${error.message}`);
  }
}

export function compileRuleText(text, sourceName, sourceSignature = null) {
  if (Buffer.byteLength(text, "utf8") > MAX_RULE_FILE_BYTES) {
    throw new PriceEngineError("RULE_FILE_TOO_LARGE", `Rules document exceeds ${MAX_RULE_FILE_BYTES} bytes.`);
  }
  const parsed = parseRuleText(text, sourceName);
  const ruleSet = compileRuleSet(parsed);
  const canonical = canonicalJson(ruleSet);
  const digest = createHash("sha256").update(canonical).digest("hex");
  const hash = `sha256:${digest}`;
  return Object.freeze({
    ruleSet,
    hash,
    etag: `"${hash}"`,
    sourcePath: sourceName,
    sourceSignature,
    loadedAt: new Date().toISOString(),
  });
}

export async function loadRuleFile(filePath) {
  const absolutePath = resolve(filePath);
  const before = await stat(absolutePath);
  if (!before.isFile()) throw new PriceEngineError("RULE_FILE_INVALID", "Configured rules path is not a file.");
  if (before.size > MAX_RULE_FILE_BYTES) {
    throw new PriceEngineError("RULE_FILE_TOO_LARGE", `Rules file exceeds ${MAX_RULE_FILE_BYTES} bytes.`);
  }
  const text = await readFile(absolutePath, "utf8");
  const after = await stat(absolutePath);
  const beforeSignature = `${before.size}:${before.mtimeMs}`;
  const afterSignature = `${after.size}:${after.mtimeMs}`;
  if (beforeSignature !== afterSignature) {
    throw new PriceEngineError("RULE_FILE_CHANGED_DURING_READ", "Rules file changed while it was being loaded; the previous rule set remains active.");
  }
  return compileRuleText(text, absolutePath, afterSignature);
}

function serializedError(error) {
  return {
    code: error.code ?? "RULE_RELOAD_FAILED",
    message: error.message,
    at: new Date().toISOString(),
  };
}

export class RuleFileStore {
  #snapshot = null;
  #refreshPromise = null;

  constructor(filePath, { autoReload = false } = {}) {
    this.filePath = resolve(filePath);
    this.autoReload = autoReload;
    this.lastReloadError = null;
  }

  get snapshot() {
    if (!this.#snapshot) throw new PriceEngineError("SERVICE_NOT_READY", "No valid rule set has been loaded.");
    return this.#snapshot;
  }

  get ready() {
    return this.#snapshot !== null;
  }

  async initialize() {
    return this.reload({ retainLastKnownGood: false });
  }

  async reload({ retainLastKnownGood = true } = {}) {
    if (this.#refreshPromise) return this.#refreshPromise;
    this.#refreshPromise = (async () => {
      try {
        const candidate = await loadRuleFile(this.filePath);
        this.#snapshot = candidate;
        this.lastReloadError = null;
        return true;
      } catch (error) {
        this.lastReloadError = serializedError(error);
        if (!retainLastKnownGood || !this.#snapshot) throw error;
        return false;
      } finally {
        this.#refreshPromise = null;
      }
    })();
    return this.#refreshPromise;
  }

  async refreshIfChanged() {
    if (!this.autoReload || !this.#snapshot) return false;
    try {
      const fileStat = await stat(this.filePath);
      const signature = `${fileStat.size}:${fileStat.mtimeMs}`;
      if (signature === this.#snapshot.sourceSignature) return false;
    } catch (error) {
      this.lastReloadError = serializedError(error);
      return false;
    }
    return this.reload({ retainLastKnownGood: true });
  }

  status() {
    return {
      ready: this.ready,
      ruleSet: this.#snapshot ? {
        id: this.#snapshot.ruleSet.rule_set.id,
        version: this.#snapshot.ruleSet.rule_set.version,
        hash: this.#snapshot.hash,
        loadedAt: this.#snapshot.loadedAt,
      } : null,
      lastReloadError: this.lastReloadError,
    };
  }
}
