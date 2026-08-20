import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson, compileCalendarSnapshot, PriceEngineError } from "@pmc/price-engine";

const EMPTY_CALENDAR = compileCalendarSnapshot(undefined);
const MAX_CALENDAR_FILE_BYTES = 4_194_304;

function calendarHash(snapshot) {
  return `sha256:${createHash("sha256").update(canonicalJson(snapshot)).digest("hex")}`;
}

function errorRecord(error) {
  return { code: error.code ?? "CALENDAR_RELOAD_FAILED", message: error.message, at: new Date().toISOString() };
}

export function compileCalendarText(text, sourceSignature = null) {
  if (Buffer.byteLength(text, "utf8") > MAX_CALENDAR_FILE_BYTES) {
    throw new PriceEngineError("CALENDAR_FILE_INVALID", "Calendar snapshot is too large.");
  }
  const snapshot = compileCalendarSnapshot(JSON.parse(text));
  return Object.freeze({
    snapshot,
    hash: calendarHash(snapshot),
    sourceSignature,
    loadedAt: new Date().toISOString(),
  });
}

export class StaticCalendarStore {
  constructor(snapshot = EMPTY_CALENDAR) {
    this.snapshot = compileCalendarSnapshot(snapshot);
    this.hash = calendarHash(this.snapshot);
  }

  async initialize() {}

  async refreshIfChanged() {
    return false;
  }

  status() {
    return {
      id: this.snapshot.id,
      hash: this.hash,
      coverage: this.snapshot.coverage ?? null,
      expiresAt: this.snapshot.expiresAt ?? null,
      ready: true,
      lastReloadError: null,
    };
  }
}

export class CalendarFileStore {
  #record = null;
  #reloadPromise = null;

  constructor(filePath, { autoReload = false } = {}) {
    this.filePath = resolve(filePath);
    this.autoReload = autoReload;
    this.lastReloadError = null;
  }

  get snapshot() {
    return this.#record?.snapshot ?? null;
  }

  get hash() {
    return this.#record?.hash ?? null;
  }

  async #load(retainLastKnownGood) {
    if (this.#reloadPromise) return this.#reloadPromise;
    this.#reloadPromise = (async () => {
      try {
        const before = await stat(this.filePath);
        if (!before.isFile() || before.size > MAX_CALENDAR_FILE_BYTES) throw new PriceEngineError("CALENDAR_FILE_INVALID", "Calendar snapshot file is missing, invalid, or too large.");
        const text = await readFile(this.filePath, "utf8");
        const after = await stat(this.filePath);
        const beforeSignature = `${before.size}:${before.mtimeMs}`;
        const afterSignature = `${after.size}:${after.mtimeMs}`;
        if (beforeSignature !== afterSignature) throw new PriceEngineError("CALENDAR_FILE_CHANGED_DURING_READ", "Calendar snapshot changed while it was being loaded; the previous snapshot remains active.");
        const record = compileCalendarText(text, afterSignature);
        this.#record = record;
        this.lastReloadError = null;
        return true;
      } catch (error) {
        this.lastReloadError = errorRecord(error);
        if (!retainLastKnownGood || !this.#record) throw error;
        return false;
      } finally {
        this.#reloadPromise = null;
      }
    })();
    return this.#reloadPromise;
  }

  async initialize() {
    return this.#load(false);
  }

  async refreshIfChanged() {
    if (!this.autoReload || !this.#record) return false;
    try {
      const fileStat = await stat(this.filePath);
      if (`${fileStat.size}:${fileStat.mtimeMs}` === this.#record.sourceSignature) return false;
    } catch (error) {
      this.lastReloadError = errorRecord(error);
      return false;
    }
    return this.#load(true);
  }

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
