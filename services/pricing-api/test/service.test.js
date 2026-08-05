import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createPriceEngine } from "@pmc/price-engine";
import { createRequestHandler } from "../src/app.js";
import { CalendarFileStore, StaticCalendarStore } from "../src/calendar-store.js";
import { loadConfig } from "../src/config.js";
import { loadRuleFile, RuleFileStore } from "../src/rule-file-store.js";

const rulesPath = fileURLToPath(new URL("../../../config/pricing/casa-de-pedra.yaml", import.meta.url));
const calendarPath = fileURLToPath(new URL("../examples/rio-2027.calendar.json", import.meta.url));

async function startTestService(t) {
  const ruleStore = new RuleFileStore(rulesPath);
  await ruleStore.initialize();
  const calendar = JSON.parse(await readFile(calendarPath, "utf8"));
  const calendarStore = new StaticCalendarStore(calendar);
  const handler = createRequestHandler({ ruleStore, calendarStore, allowedOrigins: ["https://casadepedra.rio"], clock: () => Date.parse("2026-08-04T00:00:00Z") });
  const server = createServer((request, response) => handler(request, response));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

test("loads and hashes the Casa YAML rule file", async () => {
  const loaded = await loadRuleFile(rulesPath);
  assert.equal(loaded.ruleSet.rule_set.id, "casa-de-pedra-copacabana-direct");
  assert.equal(loaded.ruleSet.rules.length, 17);
  assert.match(loaded.hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(loaded.ruleSet.base.weekday, "380.00");
});

test("resolves command-line files from the original pnpm invocation directory", () => {
  const config = loadConfig(
    { INIT_CWD: "C:\\workspace-root" },
    ["--rules", ".\\rules\\house.yaml", "--calendar", ".\\calendars\\rio.json"],
  );
  assert.equal(config.rulesFile, "C:\\workspace-root\\rules\\house.yaml");
  assert.equal(config.calendarFile, "C:\\workspace-root\\calendars\\rio.json");
});

test("the approved Casa YAML produces the proposed seasonal and event prices", async () => {
  const loaded = await loadRuleFile(rulesPath);
  const calendar = JSON.parse(await readFile(calendarPath, "utf8"));
  const engine = createPriceEngine(loaded.ruleSet, { ruleSetHash: loaded.hash });

  const low = engine.evaluateCalendar({ from: "2027-05-17", through: "2027-05-17", calendarSnapshot: calendar });
  const christmas = engine.evaluateCalendar({ from: "2026-12-21", through: "2026-12-21", calendarSnapshot: calendar });
  const carnival = engine.evaluateStay({ checkIn: "2027-02-05", checkOut: "2027-02-11", calendarSnapshot: calendar });
  const newYearTail = engine.evaluateCalendar({ from: "2027-01-02", through: "2027-01-02", calendarSnapshot: calendar });
  const independence = engine.evaluateCalendar({ from: "2027-09-07", through: "2027-09-07", calendarSnapshot: calendar });

  assert.equal(low.dates[0].final, "340.00");
  assert.equal(christmas.dates[0].final, "545.00");
  assert.deepEqual(carnival.nights.map((night) => night.final), ["950.00", "950.00", "950.00", "820.00", "820.00", "820.00"]);
  assert.equal(newYearTail.dates[0].final, "800.00");
  assert.equal(independence.dates[0].final, "600.00");
});

test("the approved Casa YAML selects every length-of-stay boundary exactly", async () => {
  const loaded = await loadRuleFile(rulesPath);
  const engine = createPriceEngine(loaded.ruleSet);
  const expected = new Map([
    [6, null],
    [7, "weekly-stay"],
    [13, "weekly-stay"],
    [14, "two-week-stay"],
    [27, "two-week-stay"],
    [28, "monthly-stay"],
  ]);
  for (const [nights, ruleId] of expected) {
    const checkIn = "2026-10-01";
    const checkOut = new Date(Date.UTC(2026, 9, 1 + nights)).toISOString().slice(0, 10);
    const quote = engine.evaluateStay({ checkIn, checkOut, calendarSnapshot: JSON.parse(await readFile(calendarPath, "utf8")) });
    assert.equal(quote.stayNights, nights);
    assert.equal(quote.nights[0].appliedRules.find((id) => id.endsWith("-stay")) ?? null, ruleId);
  }
});

test("serves readiness, normalized rules with ETag, and backend prices", async (t) => {
  const baseUrl = await startTestService(t);
  const ready = await fetch(`${baseUrl}/health/ready`);
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).status, "ready");
  const root = await fetch(`${baseUrl}/`);
  assert.equal(root.status, 200);
  assert.match(root.headers.get("content-type"), /^application\/json/);
  assert.equal((await root.json()).service, "Property Management Codex Pricing Service");
  const discovery = await fetch(`${baseUrl}/api`);
  assert.equal(discovery.status, 200);
  assert.equal((await discovery.json()).service, "Property Management Codex Pricing Service");

  const rules = await fetch(`${baseUrl}/v1/rule-set`);
  assert.equal(rules.status, 200);
  const etag = rules.headers.get("etag");
  assert(etag);
  const notModified = await fetch(`${baseUrl}/v1/rule-set`, { headers: { "If-None-Match": etag } });
  assert.equal(notModified.status, 304);

  const calendarResponse = await fetch(`${baseUrl}/v1/calendar-snapshot`);
  assert.equal(calendarResponse.status, 200);
  const calendarBody = await calendarResponse.json();
  assert.match(calendarBody.metadata.hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(calendarBody.calendarSnapshot.id, "casa-de-pedra-rio-2026-2029-v1");

  const response = await fetch(`${baseUrl}/v1/pricing/evaluate-stay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://casadepedra.rio" },
    body: JSON.stringify({ checkIn: "2026-11-02", checkOut: "2026-11-04" }),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://casadepedra.rio");
  const quote = await response.json();
  assert.equal(quote.totalBeforeFeesAndTax, "950.00");
  assert.match(quote.ruleSet.hash, /^sha256:/);
  assert.match(quote.calendarSnapshotHash, /^sha256:[0-9a-f]{64}$/);
});

test("rejects client-supplied prices and unapproved browser origins", async (t) => {
  const baseUrl = await startTestService(t);
  const sameOrigin = await fetch(`${baseUrl}/v1/pricing/evaluate-stay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ checkIn: "2026-11-02", checkOut: "2026-11-04" }),
  });
  assert.equal(sameOrigin.status, 200);
  assert.equal(sameOrigin.headers.get("access-control-allow-origin"), baseUrl);

  const tampered = await fetch(`${baseUrl}/v1/pricing/evaluate-stay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checkIn: "2026-11-02", checkOut: "2026-11-04", price: "1.00" }),
  });
  assert.equal(tampered.status, 400);
  assert.equal((await tampered.json()).error.code, "INVALID_REQUEST");

  const origin = await fetch(`${baseUrl}/health/live`, { headers: { Origin: "https://attacker.invalid" } });
  assert.equal(origin.status, 403);
  assert.equal((await origin.json()).error.code, "ORIGIN_NOT_ALLOWED");
});

test("event-based rules fail readiness without a server-owned calendar snapshot", async (t) => {
  const ruleStore = new RuleFileStore(rulesPath);
  await ruleStore.initialize();
  const calendarStore = new StaticCalendarStore();
  const handler = createRequestHandler({ ruleStore, calendarStore, clock: () => Date.parse("2026-08-04T00:00:00Z") });
  const server = createServer((request, response) => handler(request, response));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const ready = await fetch(`${baseUrl}/health/ready`);
  assert.equal(ready.status, 503);
  assert((await ready.json()).calendar.requiredKeys.length > 0);
  const quote = await fetch(`${baseUrl}/v1/pricing/evaluate-stay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checkIn: "2026-11-02", checkOut: "2026-11-04" }),
  });
  assert.equal(quote.status, 503);
  assert.equal((await quote.json()).error.code, "SERVICE_NOT_READY");
});

test("service rejects incomplete or expired event coverage and oversized horizons", async (t) => {
  const ruleStore = new RuleFileStore(rulesPath);
  await ruleStore.initialize();
  const incomplete = JSON.parse(await readFile(calendarPath, "utf8"));
  incomplete.coverage.resolvedKeys = incomplete.coverage.resolvedKeys.filter((key) => key !== "br.rj.rio.carnival");
  const incompleteHandler = createRequestHandler({
    ruleStore,
    calendarStore: new StaticCalendarStore(incomplete),
    clock: () => Date.parse("2026-08-04T00:00:00Z"),
  });
  const incompleteServer = createServer((request, response) => incompleteHandler(request, response));
  await new Promise((resolve) => incompleteServer.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => incompleteServer.close(resolve)));
  const incompleteBase = `http://127.0.0.1:${incompleteServer.address().port}`;
  const incompleteReady = await fetch(`${incompleteBase}/health/ready`);
  assert.equal(incompleteReady.status, 503);
  assert((await incompleteReady.json()).calendar.missingKeys.includes("br.rj.rio.carnival"));

  const valid = JSON.parse(await readFile(calendarPath, "utf8"));
  const expired = { ...valid, expiresAt: "2026-01-01T00:00:00Z" };
  const expiredHandler = createRequestHandler({
    ruleStore,
    calendarStore: new StaticCalendarStore(expired),
    clock: () => Date.parse("2026-08-04T00:00:00Z"),
  });
  const expiredServer = createServer((request, response) => expiredHandler(request, response));
  await new Promise((resolve) => expiredServer.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => expiredServer.close(resolve)));
  const expiredReady = await fetch(`http://127.0.0.1:${expiredServer.address().port}/health/ready`);
  assert.equal(expiredReady.status, 503);
  assert((await expiredReady.json()).calendar.reasons.includes("expired_snapshot"));

  const stale = JSON.parse(JSON.stringify(valid));
  stale.events.push({ key: "br.rj.rio.carnival", date: "2027-02-09", status: "stale" });
  const staleHandler = createRequestHandler({
    ruleStore,
    calendarStore: new StaticCalendarStore(stale),
    clock: () => Date.parse("2026-08-04T00:00:00Z"),
  });
  const staleServer = createServer((request, response) => staleHandler(request, response));
  await new Promise((resolve) => staleServer.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => staleServer.close(resolve)));
  const staleReady = await fetch(`http://127.0.0.1:${staleServer.address().port}/health/ready`);
  assert.equal(staleReady.status, 503);
  assert((await staleReady.json()).calendar.reasons.includes("stale_event_facts"));

  const validHandler = createRequestHandler({
    ruleStore,
    calendarStore: new StaticCalendarStore(valid),
    clock: () => Date.parse("2026-08-04T00:00:00Z"),
  });
  const validServer = createServer((request, response) => validHandler(request, response));
  await new Promise((resolve) => validServer.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => validServer.close(resolve)));
  const validBase = `http://127.0.0.1:${validServer.address().port}`;
  const horizon = await fetch(`${validBase}/v1/pricing/evaluate-calendar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: "2026-09-01", through: "2028-09-03" }),
  });
  assert.equal(horizon.status, 400);
  assert.equal((await horizon.json()).error.code, "DATE_RANGE_TOO_LARGE");
});

test("calendar file records are content-addressed and reload atomically", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "pmc-calendar-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const temporaryCalendar = join(directory, "calendar.json");
  const first = JSON.parse(await readFile(calendarPath, "utf8"));
  await writeFile(temporaryCalendar, JSON.stringify(first), "utf8");
  const store = new CalendarFileStore(temporaryCalendar);
  await store.initialize();
  const firstHash = store.hash;
  const second = { ...first, id: `${first.id}-revision-2` };
  await writeFile(temporaryCalendar, JSON.stringify(second), "utf8");
  await store.initialize();
  assert.notEqual(store.hash, firstHash);
  assert.equal(store.snapshot.id, second.id);
});

test("invalid reload retains the last-known-good rule set", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "pmc-rule-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const temporaryRules = join(directory, "rules.yaml");
  await copyFile(rulesPath, temporaryRules);
  const store = new RuleFileStore(temporaryRules);
  await store.initialize();
  const originalHash = store.snapshot.hash;
  await writeFile(temporaryRules, "schema: [invalid", "utf8");
  const replaced = await store.reload({ retainLastKnownGood: true });
  assert.equal(replaced, false);
  assert.equal(store.snapshot.hash, originalHash);
  assert(store.lastReloadError);
});
