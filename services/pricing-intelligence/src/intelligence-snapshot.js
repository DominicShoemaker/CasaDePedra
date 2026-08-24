import { createHash } from "node:crypto";
import { buildShadowRecommendation } from "./shadow-pricing.js";

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

/**
 * Build an immutable shadow intelligence snapshot. Policy anchors remain the
 * authoritative starting prices; this service never mutates the rule set and
 * never publishes its recommendations.
 */
export function buildIntelligenceSnapshot({
  asOf,
  marketSnapshot,
  availabilitySnapshot = null,
  policyAnchorsByDate,
  bookingPaceByDate = {},
  searchDemandByDate = {},
  eventDemandByDate = {},
  shadowConfig = {},
}) {
  if (!asOf) throw new Error("asOf is required");
  if (!marketSnapshot?.dates) throw new Error("marketSnapshot.dates is required");
  if (!policyAnchorsByDate || typeof policyAnchorsByDate !== "object") throw new Error("policyAnchorsByDate is required");

  const recommendations = {};
  for (const [date, anchor] of Object.entries(policyAnchorsByDate).sort(([a], [b]) => a.localeCompare(b))) {
    const marketSignal = marketSnapshot.dates[date] ?? {};
    recommendations[date] = buildShadowRecommendation({
      date,
      asOf,
      policyAnchorUsd: anchor,
      marketSignal,
      bookingPaceIndex: bookingPaceByDate[date] ?? null,
      searchDemandIndex: searchDemandByDate[date] ?? null,
      eventDemandIndex: eventDemandByDate[date] ?? null,
      config: shadowConfig,
    });
  }

  const inputs = {
    marketSnapshotHash: hash(marketSnapshot),
    availabilitySnapshotHash: availabilitySnapshot ? hash(availabilitySnapshot) : null,
    policyAnchorsHash: hash(policyAnchorsByDate),
  };
  const snapshotBody = {
    schema: "pmc.pricing-intelligence-snapshot/v1",
    asOf,
    model: {
      id: "pmc-shadow-heuristic",
      version: 1,
      mode: "shadow",
      publishingEnabled: false,
    },
    inputs,
    recommendations,
  };
  return {
    id: `casa-intelligence-${hash(snapshotBody).slice(0, 16)}`,
    ...snapshotBody,
  };
}
