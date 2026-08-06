import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  addCalendarYears,
  createCalendarPricingModel,
  createCalendarYearHorizon,
  describeSelectedStay,
  localDateInTimeZone,
} from "../pricing-model.js";

const rulesPath = fileURLToPath(new URL("../casa-de-pedra.rules.json", import.meta.url));
const calendarPath = fileURLToPath(new URL("../rio-2027.calendar.json", import.meta.url));
const pickerPath = fileURLToPath(new URL("../../../packages/date-range-picker/date-picker.js", import.meta.url));

async function fixture() {
  const [rules, calendar] = await Promise.all([
    readFile(rulesPath, "utf8").then(JSON.parse),
    readFile(calendarPath, "utf8").then(JSON.parse),
  ]);
  const horizon = createCalendarYearHorizon("America/Sao_Paulo", 2, new Date("2026-08-04T12:00:00Z"));
  return { rules, calendar, horizon, model: createCalendarPricingModel(rules, calendar, horizon) };
}

test("creates an exact two-calendar-year Rio-local horizon beginning today", async () => {
  const { model, horizon } = await fixture();
  assert.deepEqual(horizon, {
    from: "2026-08-04",
    through: "2028-08-03",
    untilExclusive: "2028-08-04",
    years: 2,
  });
  assert.equal(model.dates.length, 731);
  assert.equal(model.dates[0], "2026-08-04");
  assert.equal(model.dates.at(-1), "2028-08-03");
  assert.equal(localDateInTimeZone("America/Sao_Paulo", new Date("2026-08-04T01:00:00Z")), "2026-08-03");
  assert.equal(addCalendarYears("2028-02-29", 2), "2030-02-28");
});

test("calculates aligned one, two, and three-night preview rates", async () => {
  const { model } = await fixture();
  assert.equal(model.series.length, 3);
  assert(model.series.every(series => series.values.length === model.dates.length));
  assert.equal(model.getPriceForDate("2026-11-02", 1), "570.00");
  assert.equal(model.getPriceForDate("2026-11-02", 2), "475.00");
  assert.equal(model.getPriceForDate("2026-11-02", 3), "380.00");
  assert.equal(model.getPriceForDate("2026-11-06", 1), "630.00");
  assert.equal(model.getPriceForDate("2026-11-06", 2), "525.00");
  assert.equal(model.getPriceForDate("2026-11-06", 3), "420.00");
});

test("exposes event minimum stays without disabling their preview prices", async () => {
  const { model } = await fixture();
  assert.equal(model.getMinimumStayForDate("2026-12-21"), 4);
  assert.equal(model.getMinimumStayForDate("2027-01-01"), 6);
  assert.equal(model.getMinimumStayForDate("2027-02-07"), 6);
  assert.equal(model.getMinimumStayForDate("2027-03-28"), 4);
  assert.equal(model.getMinimumStayForDate("2027-09-07"), 3);
  assert.equal(model.getMinimumStayForDate("2028-01-01"), 6);
  assert.equal(model.getMinimumStayForDate("2028-02-27"), 6);
  assert.equal(model.getMinimumStayForDate("2028-04-16"), 4);
  assert.equal(model.getPriceForDate("2027-02-07", 1), "950.00");
  assert.equal(model.getPriceForDate("2027-02-07", 3), "950.00");
  assert.equal(model.getPriceForDate("2028-02-27", 1), "950.00");
  assert.equal(model.getPriceForDate("2028-02-27", 3), "950.00");
});

test("describes selected stays against the standard three-night-rate subtotal", async () => {
  const { model } = await fixture();
  const oneNight = describeSelectedStay(model, "2026-11-02", "2026-11-03");
  assert.equal(oneNight.baseline, "380.00");
  assert.equal(oneNight.adjustment, "190.00");
  assert.equal(oneNight.total, "570.00");
  assert.equal(oneNight.direction, "premium");

  const twoNights = describeSelectedStay(model, "2026-11-02", "2026-11-04");
  assert.equal(twoNights.baseline, "760.00");
  assert.equal(twoNights.adjustment, "190.00");
  assert.equal(twoNights.total, "950.00");

  const threeNights = describeSelectedStay(model, "2026-11-02", "2026-11-05");
  assert.equal(threeNights.baseline, "1140.00");
  assert.equal(threeNights.adjustment, "0.00");
  assert.equal(threeNights.direction, "standard");
});

test("returns an explicit ineligible quote when an event minimum is not met", async () => {
  const { model } = await fixture();
  const carnival = describeSelectedStay(model, "2027-02-07", "2027-02-09");
  assert.equal(carnival.quote.restrictions.eligible, false);
  assert.equal(carnival.quote.restrictions.minimumStay, 6);
  assert(carnival.quote.restrictions.violations.some(violation => violation.code === "MINIMUM_STAY_NOT_MET"));
});

test("rejects a calendar that does not resolve every event key", async () => {
  const { rules, calendar } = await fixture();
  const incomplete = structuredClone(calendar);
  incomplete.coverage.resolvedKeys = incomplete.coverage.resolvedKeys.filter(key => key !== "br.rj.rio.carnival");
  const horizon = createCalendarYearHorizon("America/Sao_Paulo", 2, new Date("2026-08-04T12:00:00Z"));
  assert.throws(() => createCalendarPricingModel(rules, incomplete, horizon), error => error.code === "CALENDAR_INCOMPLETE");
});

test("picker keeps preview pricing separate and options opt-in", async () => {
  const source = await readFile(pickerPath, "utf8");
  assert.match(source, /hasAttribute\('show-stay-length-options'\)/);
  assert.match(source, /getDisplayPriceForDate\(date\)/);
  assert.match(source, /return this\.getPriceForDate\(date\)/);
  assert.match(source, /dispatchSelectionEvent\(\)/);
  assert.match(source, /this\.priceRules \|\| this\.pricingProvider/);
  assert.match(source, /Number\(this\.getPriceForDate\(current\)\)/);
  assert.match(source, /checkoutBoundary\.setDate\(checkoutBoundary\.getDate\(\) \+ 1\)/);
  assert.match(source, /\.minimum-stay-required\[data-minimum-stay\]/);
});
