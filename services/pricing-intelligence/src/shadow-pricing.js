function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`Invalid money value: ${value}`);
  return number;
}

function roundIncrement(value, increment) {
  return Math.round(value / increment) * increment;
}

function daysBetween(asOf, date) {
  const from = Date.parse(`${asOf.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) throw new Error("Invalid date input");
  return Math.round((to - from) / 86400000);
}

function leadTimePercent(days) {
  if (days <= 7) return -12;
  if (days <= 21) return -7;
  if (days <= 45) return -3;
  if (days >= 365) return 12;
  if (days >= 180) return 7;
  return 0;
}

/**
 * Transparent v1 shadow model. It deliberately does not publish prices and is
 * intended to generate auditable recommendations while enough point-in-time
 * history is collected for later statistical/ML models.
 */
export function buildShadowRecommendation({
  date,
  asOf,
  policyAnchorUsd,
  marketSignal = {},
  bookingPaceIndex = null,
  searchDemandIndex = null,
  eventDemandIndex = null,
  config = {},
}) {
  const anchor = parseMoney(policyAnchorUsd);
  const increment = parseMoney(config.roundingIncrementUsd ?? "5.00");
  const maxIncrease = Number(config.maximumShadowIncreasePercent ?? 35);
  const maxDecrease = Number(config.maximumShadowDecreasePercent ?? 25);
  const daysToArrival = daysBetween(asOf, date);

  const factors = [];
  const compression = Number(marketSignal.marketCompressionIndex);
  const baselineCompression = Number(marketSignal.baselineCompressionIndex ?? 0.5);
  if (Number.isFinite(compression) && Number.isFinite(baselineCompression)) {
    factors.push({
      key: "marketCompression",
      percent: clamp((compression - baselineCompression) * 80, -15, 30),
      evidence: { compression, baselineCompression },
    });
  }

  const marketAvailability = Number(marketSignal.weightedAvailabilityRate);
  if (Number.isFinite(marketAvailability)) {
    const percent = marketAvailability < 0.35 ? 5 : marketAvailability > 0.70 ? -5 : 0;
    factors.push({ key: "marketAvailability", percent, evidence: { marketAvailability } });
  }

  factors.push({ key: "leadTime", percent: leadTimePercent(daysToArrival), evidence: { daysToArrival } });

  if (Number.isFinite(Number(bookingPaceIndex))) {
    const index = Number(bookingPaceIndex);
    factors.push({ key: "bookingPace", percent: clamp((index - 1) * 15, -10, 12), evidence: { index } });
  }
  if (Number.isFinite(Number(searchDemandIndex))) {
    const index = Number(searchDemandIndex);
    factors.push({ key: "searchDemand", percent: clamp((index - 1) * 12, -8, 12), evidence: { index } });
  }
  if (Number.isFinite(Number(eventDemandIndex))) {
    const index = Number(eventDemandIndex);
    factors.push({ key: "eventDemand", percent: clamp((index - 1) * 15, 0, 15), evidence: { index } });
  }

  const rawPercent = factors.reduce((sum, factor) => sum + factor.percent, 0);
  const boundedPercent = clamp(rawPercent, -maxDecrease, maxIncrease);
  const unrounded = anchor * (1 + boundedPercent / 100);
  const recommended = roundIncrement(unrounded, increment);

  let confidence = 0.25;
  if (Number.isFinite(compression)) confidence += 0.20;
  if (Number(marketSignal.effectiveSampleSize) >= 30) confidence += 0.15;
  if (Number.isFinite(Number(bookingPaceIndex))) confidence += 0.10;
  if (Number.isFinite(Number(searchDemandIndex))) confidence += 0.10;
  if (Number.isFinite(Number(eventDemandIndex))) confidence += 0.05;
  confidence = Math.min(confidence, 0.85);

  return {
    date,
    mode: "shadow",
    publish: false,
    policyAnchorUsd: anchor.toFixed(2),
    rawAdjustmentPercent: Number(rawPercent.toFixed(4)),
    boundedAdjustmentPercent: Number(boundedPercent.toFixed(4)),
    unroundedShadowUsd: unrounded.toFixed(2),
    recommendedNightlyUsd: recommended.toFixed(2),
    confidence: Number(confidence.toFixed(2)),
    factors: factors.map((factor) => ({ ...factor, percent: Number(factor.percent.toFixed(4)) })),
  };
}
