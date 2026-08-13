import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createCalendarPricingModel, createCalendarYearHorizon } from "../pricing-model.js";
import { createMarketplaceInstructions } from "../provider-instructions.js";

const rulesPath = fileURLToPath(new URL("../casa-de-pedra.rules.json", import.meta.url));
const calendarPath = fileURLToPath(new URL("../rio-2027.calendar.json", import.meta.url));

async function plans() {
  const [rules, calendar] = await Promise.all([
    readFile(rulesPath, "utf8").then(JSON.parse),
    readFile(calendarPath, "utf8").then(JSON.parse),
  ]);
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
    assert.equal(plan.schedule[0].from, "2026-08-04");
    assert.equal(plan.schedule.at(-1).through, "2028-08-03");
    assert.equal(plan.metadata.currency, "USD");
  }
});
test("Airbnb instructions invert short-stay premiums into trip-length discounts", async () => {
  const { model, plans: generated } = await plans();
  const airbnb = generated.find(plan => plan.id === "airbnb");
  const combinedSteps = airbnb.steps.join(" ");
  assert.match(combinedSteps, /2 nights 16\.6667%/);
  assert.match(combinedSteps, /3, 4, 5, and 6 nights 33\.3333%/);
  assert.match(combinedSteps, /1 week 38%/);

  const ordinary = airbnb.schedule.find(row => row.from <= "2026-11-02" && row.through >= "2026-11-02");
  assert.equal(ordinary.nightly, model.getPriceForDate("2026-11-02", 1));
  assert.equal(ordinary.profile, "Standard inverted LOS");

  const carnival = airbnb.schedule.find(row => row.from <= "2027-02-07" && row.through >= "2027-02-07");
  assert.equal(carnival.nightly, "950.00");
  assert.equal(carnival.minimumStay, 6);
  assert.equal(carnival.profile, "Event — no LOS discount");
});

test("Vrbo and standard Booking.com use the canonical three-to-six-night fallback", async () => {
  const { model, plans: generated } = await plans();
  for (const provider of ["vrbo", "booking"]) {
    const plan = generated.find(candidate => candidate.id === provider);
    const ordinary = plan.schedule.find(row => row.from <= "2026-11-02" && row.through >= "2026-11-02");
    assert.equal(ordinary.nightly, model.getPriceForDate("2026-11-02", 3));
    assert(plan.warnings.some(warning => warning.includes("one-") || warning.includes("One-")));
  }
});
