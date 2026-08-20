import { PriceEngineError, invariant } from "./errors.js";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_DAY = /^(\d{2})-(\d{2})$/;
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseLocalDate(value, label = "date") {
  const match = typeof value === "string" ? ISO_DATE.exec(value) : null;
  if (!match) {
    throw new PriceEngineError("INVALID_DATE", `${label} must use ISO YYYY-MM-DD format.`, { value });
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  invariant(year >= 1000 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month), "INVALID_DATE", `${label} is not a valid calendar date.`, { value });
  return Object.freeze({ year, month, day });
}

export function validateMonthDay(value, label = "month/day") {
  const match = typeof value === "string" ? MONTH_DAY.exec(value) : null;
  if (!match) {
    throw new PriceEngineError("INVALID_DATE", `${label} must use MM-DD format.`, { value });
  }
  const month = Number(match[1]);
  const day = Number(match[2]);
  const maximum = month === 2 ? 29 : daysInMonth(2000, month);
  invariant(month >= 1 && month <= 12 && day >= 1 && day <= maximum, "INVALID_DATE", `${label} is not a valid annual calendar date.`, { value });
  return value;
}

function toUtcMilliseconds(value) {
  const { year, month, day } = parseLocalDate(value);
  return Date.UTC(year, month - 1, day);
}

export function addDays(value, amount) {
  invariant(Number.isInteger(amount), "INVALID_DATE", "Day offset must be an integer.", { amount });
  const date = new Date(toUtcMilliseconds(value));
  date.setUTCDate(date.getUTCDate() + amount);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function compareDates(left, right) {
  parseLocalDate(left, "left date");
  parseLocalDate(right, "right date");
  return left < right ? -1 : left > right ? 1 : 0;
}

export function daysBetween(from, until) {
  const milliseconds = toUtcMilliseconds(until) - toUtcMilliseconds(from);
  return milliseconds / 86_400_000;
}

export function enumerateDates(from, untilExclusive, maximum = 3660) {
  const count = daysBetween(from, untilExclusive);
  invariant(Number.isInteger(count) && count > 0, "INVALID_DATE_RANGE", "The end date must be after the start date.", { from, untilExclusive });
  invariant(count <= maximum, "DATE_RANGE_TOO_LARGE", `Date range cannot exceed ${maximum} nights.`, { count, maximum });
  return Array.from({ length: count }, (_, offset) => addDays(from, offset));
}

export function weekday(value) {
  return WEEKDAYS[new Date(toUtcMilliseconds(value)).getUTCDay()];
}

export function monthDay(value) {
  parseLocalDate(value);
  return value.slice(5);
}

export function matchesAnnualRange(value, from, through) {
  const candidate = monthDay(value);
  validateMonthDay(from, "annual range start");
  validateMonthDay(through, "annual range end");
  return from <= through
    ? candidate >= from && candidate <= through
    : candidate >= from || candidate <= through;
}

export function isWeekdayName(value) {
  return WEEKDAYS.includes(value);
}
