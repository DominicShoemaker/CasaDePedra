import { createPriceEngine } from "../../packages/price-engine/src/index.js";

export const STAY_LENGTHS = Object.freeze([1, 2, 3]);

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a JSON object.`);
  }
}

export function addDays(localDate, days) {
  const date = new Date(`${localDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new TypeError(`Invalid local date: ${localDate}`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addCalendarYears(localDate, years) {
  if (!Number.isInteger(years)) throw new TypeError("Calendar years must be an integer.");
  const [year, month, day] = localDate.split("-").map(Number);
  const targetYear = year + years;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);
  return `${targetYear}-${String(month).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

export function localDateInTimeZone(timeZone, now = new Date()) {
  if (typeof timeZone !== "string" || timeZone.trim() === "") throw new TypeError("A listing timezone is required to calculate today's horizon.");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function createCalendarYearHorizon(timeZone, years = 2, now = new Date()) {
  if (!Number.isInteger(years) || years < 1 || years > 10) throw new TypeError("Horizon years must be an integer from 1 through 10.");
  const from = localDateInTimeZone(timeZone, now);
  const untilExclusive = addCalendarYears(from, years);
  return Object.freeze({ from, through: addDays(untilExclusive, -1), untilExclusive, years });
}

export function formatMoney(value, currency) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function formatCalendarMoney(value, currency) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function createCalendarPricingModel(ruleDocument, calendarSnapshot, requestedHorizon = undefined) {
  assertObject(ruleDocument, "Price rules");
  assertObject(calendarSnapshot, "Calendar description");
  const engine = createPriceEngine(ruleDocument);
  const effectiveFrom = engine.ruleSet.rule_set.effective_from;
  const coverageFrom = calendarSnapshot.coverage?.from;
  const coverageThrough = calendarSnapshot.coverage?.through;
  if (!coverageFrom || !coverageThrough) throw new TypeError("Calendar description must include coverage.from and coverage.through.");
  const from = requestedHorizon?.from ?? (effectiveFrom > coverageFrom ? effectiveFrom : coverageFrom);
  const through = requestedHorizon?.through ?? coverageThrough;
  if (from > through) throw new TypeError("Requested price horizon has no accommodation dates.");
  if (from < effectiveFrom) throw new TypeError(`Price rules are not effective on the requested start date ${from}; effective date is ${effectiveFrom}.`);
  if (from < coverageFrom || through > coverageThrough) {
    throw new TypeError(`Requested price horizon ${from} through ${through} is outside calendar coverage ${coverageFrom} through ${coverageThrough}.`);
  }

  const quotes = new Map();
  const indexes = new Map();
  for (const nights of STAY_LENGTHS) {
    const quote = engine.evaluateCalendar({
      from,
      through,
      assumedStayNights: nights,
      calendarSnapshot,
    });
    quotes.set(nights, quote);
    indexes.set(nights, new Map(quote.dates.map(day => [day.date, day])));
  }

  const dates = quotes.get(3).dates.map(day => day.date);
  const currency = quotes.get(3).currency;
  const timezone = quotes.get(3).timezone;

  return Object.freeze({
    engine,
    calendarSnapshot,
    currency,
    timezone,
    coverage: Object.freeze({ from, through }),
    requestedHorizon: requestedHorizon ? Object.freeze({ ...requestedHorizon }) : null,
    dates: Object.freeze([...dates]),
    series: Object.freeze(STAY_LENGTHS.map(nights => Object.freeze({
      nights,
      values: Object.freeze(quotes.get(nights).dates.map(day => Object.freeze({
        date: day.date,
        price: day.final,
        minimumStay: day.restrictions.minimumStay,
        appliedRules: Object.freeze([...day.appliedRules]),
      }))),
    }))),
    getDateResult(localDate, assumedStayNights) {
      return indexes.get(assumedStayNights)?.get(localDate) ?? null;
    },
    getPriceForDate(localDate, assumedStayNights) {
      return indexes.get(assumedStayNights)?.get(localDate)?.final ?? null;
    },
    getMinimumStayForDate(localDate) {
      return indexes.get(3)?.get(localDate)?.restrictions.minimumStay ?? null;
    },
    evaluateStay(checkIn, checkOut) {
      return engine.evaluateStay({ checkIn, checkOut, calendarSnapshot });
    },
  });
}

export function describeSelectedStay(model, checkIn, checkOut) {
  const quote = model.evaluateStay(checkIn, checkOut);
  const baseline = Number(quote.nightlySubtotal);
  const adjustment = Number(quote.stayAdjustment);
  const total = Number(quote.totalBeforeFeesAndTax);
  const percent = baseline === 0 ? 0 : (adjustment / baseline) * 100;
  const direction = adjustment > 0 ? "premium" : adjustment < 0 ? "discount" : "standard";
  let comment = "Standard 3-night calendar rate applies; there is no length-of-stay adjustment.";
  if (direction === "premium") {
    comment = `Short-stay adjustment ${formatMoney(adjustment, quote.currency)} (${percent.toFixed(1)}%) compared with the standard 3-night calendar rate.`;
  } else if (direction === "discount") {
    comment = `Length-of-stay discount ${formatMoney(Math.abs(adjustment), quote.currency)} (${Math.abs(percent).toFixed(1)}%) below the standard 3-night calendar rate.`;
  }

  return Object.freeze({
    quote,
    baseline: baseline.toFixed(2),
    adjustment: adjustment.toFixed(2),
    adjustmentPercent: percent,
    total: total.toFixed(2),
    averageNightly: (total / quote.stayNights).toFixed(2),
    direction,
    comment,
  });
}
