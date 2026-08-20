import assert from "node:assert/strict";
import test from "node:test";
import { createPriceEngine, evaluateCalendar, evaluateStay, PriceEngineError } from "../src/index.js";
import { carnivalCalendar, clone, makeRuleSet } from "./fixture.js";

const withCalendar = (input) => ({ ...input, calendarSnapshot: carnivalCalendar });

test("low-season calendar price is exact and rounded once", () => {
  const result = evaluateCalendar(makeRuleSet(), withCalendar({ from: "2027-05-17", through: "2027-05-17" }));
  assert.equal(result.dates[0].base, "380.00");
  assert.equal(result.dates[0].unrounded, "342.00");
  assert.equal(result.dates[0].final, "340.00");
  assert(!result.dates[0].matchedRules.includes("one-night"));
});

test("one- and two-night premiums apply while three nights stay unchanged", () => {
  const one = evaluateStay(makeRuleSet(), withCalendar({ checkIn: "2026-11-02", checkOut: "2026-11-03" }));
  const two = evaluateStay(makeRuleSet(), withCalendar({ checkIn: "2026-11-02", checkOut: "2026-11-04" }));
  const three = evaluateStay(makeRuleSet(), withCalendar({ checkIn: "2026-11-02", checkOut: "2026-11-05" }));
  assert.equal(one.totalBeforeFeesAndTax, "570.00");
  assert.equal(two.totalBeforeFeesAndTax, "950.00");
  assert.equal(three.totalBeforeFeesAndTax, "1140.00");
  assert.equal(one.stayAdjustment, "190.00");
  assert.equal(one.stayPremium, "190.00");
  assert.equal(two.stayAdjustment, "190.00");
  assert.equal(three.stayAdjustment, "0.00");
});

test("weekly discount is calculated from the complete itinerary", () => {
  const result = evaluateStay(makeRuleSet(), withCalendar({ checkIn: "2026-11-02", checkOut: "2026-11-09" }));
  assert.equal(result.stayNights, 7);
  assert.equal(result.nightlySubtotal, "2740.00");
  assert.equal(result.stayDiscount, "185.00");
  assert.equal(result.stayAdjustment, "-185.00");
  assert.equal(result.totalBeforeFeesAndTax, "2555.00");
  assert(result.nights.every((night) => night.appliedRules.includes("weekly")));
});

test("percentages in separate layers compound rather than add", () => {
  const result = evaluateCalendar(makeRuleSet(), withCalendar({ from: "2026-12-21", through: "2026-12-21" }));
  assert.equal(result.dates[0].unrounded, "546.25");
  assert.equal(result.dates[0].final, "545.00");
  assert.deepEqual(result.dates[0].appliedRules, ["summer", "christmas"]);
});

test("event priority, shoulder days, suppression, and restrictions are deterministic", () => {
  const result = evaluateStay(makeRuleSet(), {
    checkIn: "2027-02-05",
    checkOut: "2027-02-11",
    calendarSnapshot: carnivalCalendar,
  });
  assert.deepEqual(result.nights.map((night) => night.final), ["950.00", "950.00", "950.00", "820.00", "820.00", "820.00"]);
  assert.equal(result.totalBeforeFeesAndTax, "5310.00");
  assert.equal(result.restrictions.minimumStay, 6);
  assert.equal(result.restrictions.eligible, true);
  assert(result.nights.every((night) => night.suppressedGroups.includes("annual-season")));
  assert(result.nights.every((night) => night.suppressedGroups.includes("length-of-stay")));
  assert(result.nights[0].rejectedRules.some((rule) => rule.id === "carnival" && rule.selected === "carnival-prime"));
});

test("New Year tail rule intersects a cross-year event window", () => {
  const result = evaluateCalendar(makeRuleSet(), {
    from: "2027-01-02",
    through: "2027-01-02",
    calendarSnapshot: carnivalCalendar,
  });
  assert.equal(result.dates[0].final, "800.00");
  assert(result.dates[0].appliedRules.includes("new-year-tail"));
});

test("minimum-stay violations are returned explicitly", () => {
  const result = evaluateStay(makeRuleSet(), {
    checkIn: "2027-02-05",
    checkOut: "2027-02-07",
    calendarSnapshot: carnivalCalendar,
  });
  assert.equal(result.restrictions.eligible, false);
  assert.equal(result.restrictions.violations[0].code, "MINIMUM_STAY_NOT_MET");
  assert.equal(result.stayAdjustment, "0.00");
});

test("equal-priority exclusive matches fail instead of using file order", () => {
  const rules = makeRuleSet();
  rules.rules.find((rule) => rule.id === "carnival").priority = 910;
  assert.throws(
    () => evaluateCalendar(rules, { from: "2027-02-05", through: "2027-02-05", calendarSnapshot: carnivalCalendar }),
    (error) => error instanceof PriceEngineError && error.code === "AMBIGUOUS_RULE",
  );
});

test("comparison prices turn the automatic-change limit into an approval warning", () => {
  const result = evaluateCalendar(makeRuleSet(), withCalendar({
    from: "2027-05-17",
    through: "2027-05-17",
    comparisonPrices: { "2027-05-17": "100.00" },
  }));
  assert.equal(result.dates[0].final, "340.00");
  assert(result.warnings.some((warning) => warning.code === "AUTOMATIC_CHANGE_LIMIT_EXCEEDED"));
});

test("global hard bounds clamp before final rounding", () => {
  const below = makeRuleSet();
  below.rules.find((rule) => rule.id === "low-season").apply.adjust_nightly_percent = "-50";
  const floorResult = evaluateCalendar(below, withCalendar({ from: "2027-05-17", through: "2027-05-17" }));
  assert.equal(floorResult.dates[0].final, "300.00");
  assert(floorResult.dates[0].warnings.some((warning) => warning.code === "HARD_FLOOR_APPLIED"));

  const above = makeRuleSet();
  above.base.weekday = "1100.00";
  const ceilingResult = evaluateStay(above, withCalendar({ checkIn: "2026-11-02", checkOut: "2026-11-04" }));
  assert(ceilingResult.nights.every((night) => night.final === "1250.00"));
  assert(ceilingResult.nights.every((night) => night.warnings.some((warning) => warning.code === "HARD_CEILING_APPLIED")));
});

test("local-date arithmetic supports leap day", () => {
  const result = evaluateCalendar(makeRuleSet(), withCalendar({ from: "2028-02-29", through: "2028-02-29" }));
  assert.equal(result.dates[0].date, "2028-02-29");
  assert(result.dates[0].matchedRules.includes("summer"));
});

test("evaluation is immutable, replayable, and does not mutate inputs", () => {
  const rules = makeRuleSet();
  const before = JSON.stringify(rules);
  const engine = createPriceEngine(rules, { ruleSetHash: "sha256:test" });
  const first = engine.evaluateStay(withCalendar({ checkIn: "2026-11-02", checkOut: "2026-11-04" }));
  const second = engine.evaluateStay(withCalendar({ checkIn: "2026-11-02", checkOut: "2026-11-04" }));
  assert.deepEqual(first, second);
  assert.equal(first.ruleSet.hash, "sha256:test");
  assert.equal(JSON.stringify(rules), before);
  assert(Object.isFrozen(first));
  assert(Object.isFrozen(first.nights[0]));
});

test("rule set effective date is an accommodation-date boundary", () => {
  assert.throws(
    () => evaluateStay(clone(makeRuleSet()), { checkIn: "2026-08-31", checkOut: "2026-09-02" }),
    (error) => error instanceof PriceEngineError && error.code === "RULE_SET_NOT_EFFECTIVE",
  );
});

test("event rules require declared calendar coverage and resolved keys", () => {
  assert.throws(
    () => evaluateCalendar(makeRuleSet(), { from: "2027-05-17", through: "2027-05-17" }),
    (error) => error instanceof PriceEngineError && error.code === "CALENDAR_REQUIRED",
  );

  const incomplete = clone(carnivalCalendar);
  incomplete.coverage.resolvedKeys = ["gregorian.new-year"];
  assert.throws(
    () => evaluateCalendar(makeRuleSet(), { from: "2027-05-17", through: "2027-05-17", calendarSnapshot: incomplete }),
    (error) => error instanceof PriceEngineError && error.code === "CALENDAR_INCOMPLETE" && error.details.missingKeys.includes("br.rj.rio.carnival"),
  );

  const tooShort = clone(carnivalCalendar);
  tooShort.coverage.through = "2027-01-31";
  assert.throws(
    () => evaluateCalendar(makeRuleSet(), { from: "2027-05-17", through: "2027-05-17", calendarSnapshot: tooShort }),
    (error) => error instanceof PriceEngineError && error.code === "CALENDAR_OUT_OF_RANGE",
  );
});
