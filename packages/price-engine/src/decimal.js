import { PriceEngineError, invariant } from "./errors.js";

const TEN = 10n;

function gcd(a, b) {
  let left = a < 0n ? -a : a;
  let right = b < 0n ? -b : b;
  while (right !== 0n) {
    [left, right] = [right, left % right];
  }
  return left;
}

function rational(numerator, denominator = 1n) {
  invariant(denominator !== 0n, "DIVISION_BY_ZERO", "Decimal denominator cannot be zero.");
  let n = numerator;
  let d = denominator;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const divisor = gcd(n, d);
  return Object.freeze({ n: n / divisor, d: d / divisor });
}

function tenTo(power) {
  invariant(Number.isInteger(power) && power >= 0 && power <= 18, "INVALID_DECIMAL", "Decimal scale must be between 0 and 18.");
  return TEN ** BigInt(power);
}

export const ZERO = rational(0n);
export const ONE = rational(1n);
export const HUNDRED = rational(100n);

export function decimal(value, label = "decimal") {
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string" || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text.trim())) {
    throw new PriceEngineError("INVALID_DECIMAL", `${label} must be a plain decimal string or finite decimal number.`, { value });
  }

  const normalized = text.trim();
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ""] = unsigned.split(".");
  invariant(fraction.length <= 18, "INVALID_DECIMAL", `${label} has more than 18 decimal places.`, { value });
  const digits = `${whole}${fraction}`;
  const numerator = BigInt(digits) * (negative ? -1n : 1n);
  return rational(numerator, tenTo(fraction.length));
}

export function add(left, right) {
  return rational(left.n * right.d + right.n * left.d, left.d * right.d);
}

export function subtract(left, right) {
  return rational(left.n * right.d - right.n * left.d, left.d * right.d);
}

export function multiply(left, right) {
  return rational(left.n * right.n, left.d * right.d);
}

export function divide(left, right) {
  invariant(right.n !== 0n, "DIVISION_BY_ZERO", "Cannot divide a decimal by zero.");
  return rational(left.n * right.d, left.d * right.n);
}

export function negate(value) {
  return rational(-value.n, value.d);
}

export function absolute(value) {
  return value.n < 0n ? negate(value) : value;
}

export function compare(left, right) {
  const difference = left.n * right.d - right.n * left.d;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function minimum(left, right) {
  return compare(left, right) <= 0 ? left : right;
}

export function maximum(left, right) {
  return compare(left, right) >= 0 ? left : right;
}

function roundedInteger(value, method) {
  const sign = value.n < 0n ? -1n : 1n;
  const numerator = value.n < 0n ? -value.n : value.n;
  const quotient = numerator / value.d;
  const remainder = numerator % value.d;

  let magnitude;
  if (method === "down") {
    magnitude = sign > 0n ? quotient : quotient + (remainder === 0n ? 0n : 1n);
  } else if (method === "up") {
    magnitude = sign > 0n ? quotient + (remainder === 0n ? 0n : 1n) : quotient;
  } else if (method === "nearest") {
    magnitude = quotient + (remainder * 2n >= value.d ? 1n : 0n);
  } else {
    throw new PriceEngineError("INVALID_ROUNDING", `Unsupported rounding method: ${method}.`);
  }

  return magnitude * sign;
}

export function roundToIncrement(value, increment, method = "nearest") {
  invariant(compare(increment, ZERO) > 0, "INVALID_ROUNDING", "Rounding increment must be greater than zero.");
  return multiply(rational(roundedInteger(divide(value, increment), method)), increment);
}

export function floorToIncrement(value, increment) {
  return roundToIncrement(value, increment, "down");
}

export function ceilToIncrement(value, increment) {
  return roundToIncrement(value, increment, "up");
}

export function percentFactor(percent, direction = "adjust") {
  const ratio = divide(decimal(percent, "percent"), HUNDRED);
  return direction === "discount" ? subtract(ONE, ratio) : add(ONE, ratio);
}

export function toDecimalString(value, fractionDigits = 2) {
  const scale = tenTo(fractionDigits);
  const minor = roundedInteger(multiply(value, rational(scale)), "nearest");
  const negative = minor < 0n;
  const magnitude = negative ? -minor : minor;
  const whole = magnitude / scale;
  const fraction = magnitude % scale;
  const suffix = fractionDigits === 0 ? "" : `.${fraction.toString().padStart(fractionDigits, "0")}`;
  return `${negative ? "-" : ""}${whole}${suffix}`;
}

export function toExactDecimalString(value, minimumFractionDigits = 0, maximumFractionDigits = 18) {
  const negative = value.n < 0n;
  const magnitude = negative ? -value.n : value.n;
  let scale = 0;
  let scaled = magnitude;
  while (scaled % value.d !== 0n && scale < maximumFractionDigits) {
    scale += 1;
    scaled *= 10n;
  }
  if (scaled % value.d !== 0n) {
    return toDecimalString(value, maximumFractionDigits);
  }

  const digits = scaled / value.d;
  const divisor = tenTo(scale);
  const whole = digits / divisor;
  let fraction = scale === 0 ? "" : (digits % divisor).toString().padStart(scale, "0");
  while (fraction.length > minimumFractionDigits && fraction.endsWith("0")) {
    fraction = fraction.slice(0, -1);
  }
  if (fraction.length < minimumFractionDigits) fraction = fraction.padEnd(minimumFractionDigits, "0");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function isMultiple(value, increment) {
  const quotient = divide(value, increment);
  return quotient.n % quotient.d === 0n;
}
