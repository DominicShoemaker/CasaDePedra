export class PriceEngineError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "PriceEngineError";
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export function invariant(condition, code, message, details) {
  if (!condition) {
    throw new PriceEngineError(code, message, details);
  }
}
