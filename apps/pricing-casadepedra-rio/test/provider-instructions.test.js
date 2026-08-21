import assert from "node:assert/strict";
import test from "node:test";
import { createCalendarPricingModel, createCalendarYearHorizon } from "../pricing-model.js";
import { createMarketplaceInstructions } from "../provider-instructions.js";
import { loadPricingFixtures } from "./fixtures.js";

async function plans() {
  const { rules, calendar } = await loadPricingFixtures();
  const horizon = createCalendarYearHorizon("America/Sao_Paulo", 2, new Date("2026-08-04T12:00:00Z"));
  const model = createCalendarPricingModel(rules, calendar, horizon);
  return { rules, calendar, model, plans: createMarketplaceInstructions(rules, calendar, model) };
}

test("creates one complete instruction plan per marketplace", async () => {
  const { plans: generated } = await plans();
  assert.deepEqual(generated.map(plan => plan.id), ["airbnb", "vrbo", "booking"]);
  for (const plan of generated) {
    assert(plan.steps.length >= 5);
    assert(plan.warnings.length >= 1);
    assert(plan.defaults.length >= 3);
    assert(plan.scheduleTitle);
    assert(plan.scheduleNote);
    assert.equal(plan.metadata.from, "2026-08-04");
    assert.equal(plan.metadata.through, "2028-08-03");
    assert.equal(plan.metadata.currency, "USD");
  }
});

test("Airbnb sets reusable anchors and omits ordinary calendar price entries", async () => {
  const { model, plans: generated } = await plans();
  const airbnb = generated.find(plan => plan.id === "airbnb");
  const combinedSteps = airbnb.steps.join(" ");
  assert.equal(airbnb.defaults.find(setting => setting.label === "Base price").value, "$570.00");
  assert.equal(airbnb.defaults.find(setting => setting.label === "Custom weekend price").value, "$630.00");
  assert.match(combinedSteps, /set Base price to \$570\.00 and Custom weekend price to \$630\.00/);
  assert.match(combinedSteps, /2 nights 16\.6667%/);
  assert.match(combinedSteps, /3, 4, 5, and 6 nights 33\.3333%/);
  assert.match(combinedSteps, /1 week 38%/);
  assert(airbnb.omittedDates > 0);
  assert(airbnb.schedule.length < 230);

  const ordinary = airbnb.schedule.find(row => row.from <= "2026-11-02" && row.through >= "2026-11-02");
  assert.equal(ordinary, undefined);

  const carnival = airbnb.schedule.find(row => row.from <= "2027-02-07" && row.through >= "2027-02-07");
  assert.equal(carnival.nightly, "950.00");
  assert.equal(carnival.minimumStay, 6);
  assert.equal(carnival.profile, "Event — no LOS discount");
});

test("Vrbo sets day-of-week defaults and lists only three-to-six-night exceptions", async () => {
  const { plans: generated } = await plans();
  const vrbo = generated.find(plan => plan.id === "vrbo");
  assert.equal(vrbo.defaults.find(setting => setting.label === "Sunday–Thursday Base rate").value, "$380.00");
  assert.equal(vrbo.defaults.find(setting => setting.label === "Friday–Saturday Base rate").value, "$420.00");
  assert(vrbo.omittedDates > 0);
  assert(vrbo.schedule.length < 230);
  assert.equal(vrbo.schedule.find(row => row.from <= "2026-11-02" && row.through >= "2026-11-02"), undefined);
  assert(vrbo.warnings.some(warning => warning.includes("one-") || warning.includes("One-")));
});

test("Booking.com retains the required compressed Standard rate schedule", async () => {
  const { model, plans: generated } = await plans();
  const booking = generated.find(plan => plan.id === "booking");
  const ordinary = booking.schedule.find(row => row.from <= "2026-11-02" && row.through >= "2026-11-02");
  assert.equal(ordinary.nightly, model.getPriceForDate("2026-11-02", 3));
  assert.equal(booking.omittedDates, 0);
  assert.equal(booking.schedule[0].from, "2026-08-04");
  assert.equal(booking.schedule.at(-1).through, "2028-08-03");
  assert(booking.warnings.some(warning => warning.includes("One-")));
});
