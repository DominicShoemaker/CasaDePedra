import { app } from "@azure/functions";
import { parseProviderCalendar } from "../ical.js";
import { buildAvailabilitySnapshot } from "../availability.js";
import { getProviderCalendarUrls } from "../secrets.js";
import { writeImmutableJson, writeLatestJson } from "../storage.js";

function addDays(date, days) {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

async function fetchText(url, provider) {
  if (!url) throw new Error(`${provider} calendar URL is not configured`);
  const response = await fetch(url, {
    headers: { "user-agent": "CasaDePedra-PricingIntelligence/1.0" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${provider} calendar request failed: ${response.status}`);
  return response.text();
}

export async function refreshAvailability(context = console) {
  const asOf = new Date().toISOString();
  const today = asOf.slice(0, 10);
  const through = addDays(today, Number(process.env.AVAILABILITY_HORIZON_DAYS ?? 550));
  const urls = await getProviderCalendarUrls();

  const [airbnbText, vrboText] = await Promise.all([
    fetchText(urls.airbnb, "Airbnb"),
    fetchText(urls.vrbo, "Vrbo"),
  ]);

  const calendars = [
    parseProviderCalendar(airbnbText, { source: "airbnb" }),
    parseProviderCalendar(vrboText, { source: "vrbo" }),
  ];

  const snapshot = buildAvailabilitySnapshot({
    calendars,
    from: today,
    through,
    asOf,
  });
  snapshot.id = `casa-availability-${asOf.replace(/[:.]/g, "-")}`;
  snapshot.sourceSummary = Object.fromEntries(calendars.map((calendar) => [
    calendar.source,
    {
      reservationIntervals: calendar.events.filter((event) => event.kind === "reservation").length,
      blockedIntervals: calendar.events.filter((event) => event.kind === "blocked").length,
    },
  ]));
  snapshot.privacy = {
    rawCalendarPersisted: false,
    guestNamesPersisted: false,
    phoneDigitsPersisted: false,
    reservationUrlsPersisted: false,
  };

  const accountUrl = process.env.PRICING_STORAGE_ACCOUNT_URL;
  const container = process.env.INTELLIGENCE_CONTAINER ?? "pricing-intelligence";
  const safeStamp = asOf.replace(/[:.]/g, "-");
  const datedName = `availability/${today.slice(0, 4)}/${today.slice(5, 7)}/${today.slice(8, 10)}/${safeStamp}.json`;
  await writeImmutableJson({ accountUrl, container, blobName: datedName, value: snapshot });
  await writeLatestJson({ accountUrl, container, blobName: "availability/latest.json", value: snapshot });
  context.log?.(`Wrote sanitized availability snapshot ${snapshot.id}`);
  return snapshot;
}

app.timer("pricing-intelligence-daily-refresh", {
  schedule: "0 15 9 * * *",
  runOnStartup: false,
  handler: async (_timer, context) => refreshAvailability(context),
});
