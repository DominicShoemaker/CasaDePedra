function parseDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  if (!match) throw new Error(`Invalid date: ${date}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function dateRange(from, through) {
  const start = parseDate(from);
  const end = parseDate(through);
  if (end < start) throw new Error("through must not be before from");
  const dates = [];
  for (let ms = start; ms <= end; ms += 86400000) dates.push(formatDate(ms));
  return dates;
}

function eventDates(event) {
  const start = parseDate(event.start);
  const endExclusive = parseDate(event.endExclusive);
  const dates = [];
  for (let ms = start; ms < endExclusive; ms += 86400000) dates.push(formatDate(ms));
  return dates;
}

/**
 * Merge cross-synchronized provider calendars into a single daily inventory
 * view. Native provider "reservation" evidence outranks mirrored "blocked"
 * evidence, preventing the same stay from being counted twice.
 */
export function buildAvailabilitySnapshot({ calendars, from, through, asOf }) {
  const dates = Object.fromEntries(
    dateRange(from, through).map((date) => [date, {
      state: "available",
      sources: [],
      evidence: [],
    }]),
  );

  const orderedEvents = calendars
    .flatMap((calendar) => calendar.events)
    .sort((a, b) => Number(a.kind === "blocked") - Number(b.kind === "blocked"));

  for (const event of orderedEvents) {
    for (const date of eventDates(event)) {
      const target = dates[date];
      if (!target) continue;
      if (event.kind === "reservation") target.state = "reserved";
      else if (target.state === "available") target.state = "blocked";
      if (!target.sources.includes(event.source)) target.sources.push(event.source);
      if (!target.evidence.includes(event.sourceEventHash)) target.evidence.push(event.sourceEventHash);
    }
  }

  const counts = { available: 0, reserved: 0, blocked: 0 };
  for (const value of Object.values(dates)) counts[value.state] += 1;

  return {
    schema: "pmc.availability-snapshot/v1",
    asOf,
    coverage: { from, through },
    counts,
    dates,
  };
}

export function summarizeReservationIntervals(calendar) {
  return calendar.events
    .filter((event) => event.kind === "reservation")
    .map(({ start, endExclusive, source }) => ({ start, endExclusive, source }));
}
