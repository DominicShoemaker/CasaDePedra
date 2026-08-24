import test from "node:test";
import assert from "node:assert/strict";
import { parseProviderCalendar } from "../src/ical.js";
import { buildAvailabilitySnapshot } from "../src/availability.js";
import { sanitizeAirbnbEarningsCsv } from "../src/airbnb-earnings.js";
import { buildShadowRecommendation } from "../src/shadow-pricing.js";

const airbnb = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20270101\nDTEND;VALUE=DATE:20270105\nSUMMARY:Reserved\nUID:a\nDESCRIPTION:Phone Number: 1234\nEND:VEVENT\nEND:VCALENDAR`;
const vrbo = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20270101\nDTEND;VALUE=DATE:20270105\nSUMMARY:Blocked\nUID:b\nEND:VEVENT\nEND:VCALENDAR`;

test("calendar parser strips provider PII", () => {
  const parsed = parseProviderCalendar(airbnb, { source: "airbnb" });
  assert.equal(parsed.events[0].kind, "reservation");
  assert.deepEqual(Object.keys(parsed.events[0]).sort(), ["endExclusive", "kind", "source", "sourceEventHash", "start"].sort());
  assert.equal(JSON.stringify(parsed).includes("1234"), false);
});

test("mirrored block does not double-count a reservation", () => {
  const snapshot = buildAvailabilitySnapshot({
    calendars: [parseProviderCalendar(airbnb, { source: "airbnb" }), parseProviderCalendar(vrbo, { source: "vrbo" })],
    from: "2027-01-01",
    through: "2027-01-05",
    asOf: "2026-08-23T00:00:00Z",
  });
  assert.equal(snapshot.counts.reserved, 4);
  assert.equal(snapshot.counts.blocked, 0);
  assert.equal(snapshot.counts.available, 1);
});

test("earnings sanitizer removes identities", () => {
  const csv = "Type,Booking date,Start date,End date,Nights,Guest,Confirmation code,Currency,Amount,Service fee,Cleaning fee,Gross earnings,Airbnb remitted tax\nReservation,08/01/2026,08/06/2026,08/11/2026,5,Alice,SECRET,BRL,100,4,0,104,0\n";
  const result = sanitizeAirbnbEarningsCsv(csv);
  assert.equal(result.reservations.length, 1);
  assert.equal(JSON.stringify(result).includes("Alice"), false);
  assert.equal(JSON.stringify(result).includes("SECRET"), false);
  assert.equal(result.summaryByCurrency.BRL.nights, 5);
});

test("shadow pricing never publishes", () => {
  const result = buildShadowRecommendation({
    date: "2027-02-06",
    asOf: "2026-08-23T00:00:00Z",
    policyAnchorUsd: "800.00",
    marketSignal: { marketCompressionIndex: 0.65, weightedAvailabilityRate: 0.35, effectiveSampleSize: 100 },
    eventDemandIndex: 1.2,
  });
  assert.equal(result.mode, "shadow");
  assert.equal(result.publish, false);
  assert.ok(Number(result.recommendedNightlyUsd) > 800);
});
