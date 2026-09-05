import { createHash } from "node:crypto";

function unfoldLines(text) {
  const physical = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const logical = [];
  for (const line of physical) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && logical.length > 0) {
      logical[logical.length - 1] += line.slice(1);
    } else {
      logical.push(line);
    }
  }
  return logical;
}

function propertyValue(line, name) {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const lhs = line.slice(0, colon).split(";", 1)[0].toUpperCase();
  return lhs === name.toUpperCase() ? line.slice(colon + 1) : null;
}

function parseIcsDate(value) {
  if (!/^\d{8}$/.test(value ?? "")) throw new Error(`Invalid iCalendar date: ${value}`);
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function eventKind(source, summary) {
  const normalized = String(summary ?? "").trim().toLowerCase();
  if (source === "airbnb") return normalized === "reserved" ? "reservation" : "blocked";
  if (source === "vrbo") return normalized.startsWith("reserved") ? "reservation" : "blocked";
  return normalized.startsWith("reserved") ? "reservation" : "blocked";
}

function eventHash(source, uid, start, endExclusive, kind) {
  return createHash("sha256")
    .update([source, uid ?? "", start, endExclusive, kind].join("\n"))
    .digest("hex");
}

/**
 * Parse a provider iCalendar without retaining descriptions, phone digits,
 * reservation URLs, guest names, or raw summary text.
 */
export function parseProviderCalendar(text, { source }) {
  if (!source) throw new Error("source is required");
  const events = [];
  let current = null;

  for (const line of unfoldLines(text)) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (!current?.start || !current?.endExclusive) throw new Error("VEVENT is missing DTSTART or DTEND");
      const kind = eventKind(source, current.summary);
      events.push({
        source,
        start: current.start,
        endExclusive: current.endExclusive,
        kind,
        sourceEventHash: eventHash(source, current.uid, current.start, current.endExclusive, kind),
      });
      current = null;
      continue;
    }
    if (!current) continue;

    const start = propertyValue(line, "DTSTART");
    const end = propertyValue(line, "DTEND");
    const summary = propertyValue(line, "SUMMARY");
    const uid = propertyValue(line, "UID");
    if (start !== null) current.start = parseIcsDate(start);
    if (end !== null) current.endExclusive = parseIcsDate(end);
    if (summary !== null) current.summary = summary;
    if (uid !== null) current.uid = uid;
  }

  return { source, events };
}
