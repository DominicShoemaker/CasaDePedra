import { numberOrNull } from "./csv.js";

function value(row, ...names) {
  for (const name of names) if (row[name] !== undefined && row[name] !== "") return row[name];
  return null;
}

function numeric(row, ...names) {
  return numberOrNull(value(row, ...names));
}

function weightedQuantile(items, q) {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, item) => sum + item.weight, 0);
  if (!(total > 0)) return null;
  const threshold = total * q;
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative >= threshold) return item.value;
  }
  return sorted.at(-1).value;
}

function similarityWeight(row, config) {
  const neighborhood = value(row, "neighbourhood_cleansed", "neighborhood");
  const neighborhoodWeight = Number(config.neighborhoodWeights[neighborhood] ?? 0);
  if (!(neighborhoodWeight > 0)) return 0;

  const bedrooms = numeric(row, "bedrooms");
  const bathrooms = numeric(row, "bathrooms");
  const accommodates = numeric(row, "accommodates");
  if (bedrooms === null || accommodates === null) return 0;

  let weight = neighborhoodWeight;
  weight *= Math.exp(-0.35 * Math.abs(bedrooms - config.target.bedrooms));
  weight *= Math.exp(-0.14 * Math.abs(accommodates - config.target.accommodates));
  if (bathrooms !== null) weight *= Math.exp(-0.18 * Math.abs(bathrooms - config.target.bathrooms));

  const propertyType = String(value(row, "property_type") ?? "").toLowerCase();
  if (propertyType.includes("villa")) weight *= 1.15;
  else if (propertyType.includes("house") || propertyType.includes("home")) weight *= 1.05;
  return weight;
}

export function buildComparableSet(listings, config) {
  const rules = config.comparable;
  return listings.flatMap((row) => {
    const neighborhood = value(row, "neighbourhood_cleansed", "neighborhood");
    const roomType = value(row, "room_type");
    const bedrooms = numeric(row, "bedrooms");
    const bathrooms = numeric(row, "bathrooms");
    const accommodates = numeric(row, "accommodates");
    if (!(neighborhood in config.neighborhoodWeights)) return [];
    if (rules.roomType && roomType !== rules.roomType) return [];
    if (bedrooms === null || bedrooms < rules.minimumBedrooms || bedrooms > rules.maximumBedrooms) return [];
    if (accommodates === null || accommodates < rules.minimumAccommodates || accommodates > rules.maximumAccommodates) return [];
    if (bathrooms !== null && bathrooms < rules.minimumBathrooms) return [];
    const weight = similarityWeight(row, config);
    if (!(weight > 0)) return [];
    return [{
      listingId: String(value(row, "id", "listing_id")),
      neighborhood,
      weight,
      bedrooms,
      bathrooms,
      accommodates,
    }];
  });
}

/**
 * Convert Inside Airbnb daily calendar rows into a weighted market-compression
 * series. `available=false` is explicitly treated as unavailable inventory,
 * not proven occupancy, because Inside Airbnb cannot distinguish host blocks.
 */
export function buildMarketCalendarSignals(calendarRows, comparableSet) {
  const weights = new Map(comparableSet.map((item) => [item.listingId, item.weight]));
  const totalWeight = comparableSet.reduce((sum, item) => sum + item.weight, 0);
  const weightSquares = comparableSet.reduce((sum, item) => sum + item.weight ** 2, 0);
  const effectiveSampleSize = weightSquares > 0 ? (totalWeight ** 2) / weightSquares : 0;
  const byDate = new Map();

  for (const row of calendarRows) {
    const listingId = String(value(row, "listing_id", "id"));
    const weight = weights.get(listingId);
    if (!weight) continue;
    const date = value(row, "date");
    if (!date) continue;
    const available = String(value(row, "available") ?? "").toLowerCase();
    const isAvailable = available === "t" || available === "true" || available === "1";
    const minimumNights = numeric(row, "minimum_nights");
    const bucket = byDate.get(date) ?? { availableWeight: 0, availableCount: 0, minStay: [] };
    if (isAvailable) {
      bucket.availableWeight += weight;
      bucket.availableCount += 1;
      if (minimumNights !== null) bucket.minStay.push({ value: minimumNights, weight });
    }
    byDate.set(date, bucket);
  }

  return Object.fromEntries([...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, bucket]) => {
    const availabilityRate = totalWeight > 0 ? bucket.availableWeight / totalWeight : null;
    return [date, {
      comparableCount: comparableSet.length,
      availableComparableCount: bucket.availableCount,
      effectiveSampleSize: Number(effectiveSampleSize.toFixed(2)),
      weightedAvailabilityRate: availabilityRate === null ? null : Number(availabilityRate.toFixed(6)),
      marketCompressionIndex: availabilityRate === null ? null : Number((1 - availabilityRate).toFixed(6)),
      marketMedianMinimumStay: weightedQuantile(bucket.minStay, 0.5),
      marketP75MinimumStay: weightedQuantile(bucket.minStay, 0.75),
      unavailableMeans: "booked-or-host-blocked",
    }];
  }));
}

export function comparableConfigFromCasa(config) {
  return {
    neighborhoodWeights: config.market.neighborhoodWeights,
    comparable: config.market.comparable,
    target: {
      bedrooms: config.listing.bedrooms,
      bathrooms: config.listing.bathrooms,
      accommodates: config.listing.accommodates,
    },
  };
}
