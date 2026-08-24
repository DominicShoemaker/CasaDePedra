#!/usr/bin/env python3
import argparse, csv, gzip, hashlib, json, math
from collections import defaultdict
from pathlib import Path


def num(value):
    try:
        return float(value) if value not in (None, "") else None
    except ValueError:
        return None


def open_csv(path):
    if str(path).endswith(".gz"):
        return gzip.open(path, "rt", encoding="utf-8", newline="")
    return open(path, "r", encoding="utf-8", newline="")


def weighted_quantile(items, q):
    if not items:
        return None
    items = sorted(items)
    total = sum(weight for _, weight in items)
    threshold = total * q
    cumulative = 0.0
    for value, weight in items:
        cumulative += weight
        if cumulative >= threshold:
            return value
    return items[-1][0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--listings", required=True)
    parser.add_argument("--calendar", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    market = config["market"]
    rules = market["comparable"]
    target = config["listing"]
    neighborhood_weights = {k: float(v) for k, v in market["neighborhoodWeights"].items()}

    comps = {}
    counts = defaultdict(int)
    weight_by_neighborhood = defaultdict(float)
    scrape_dates = set()

    with open_csv(args.listings) as handle:
        for row in csv.DictReader(handle):
            neighborhood = row.get("neighbourhood_cleansed")
            if neighborhood not in neighborhood_weights:
                continue
            if row.get("room_type") != rules["roomType"]:
                continue
            bedrooms = num(row.get("bedrooms")); bathrooms = num(row.get("bathrooms")); accommodates = num(row.get("accommodates"))
            if bedrooms is None or accommodates is None:
                continue
            if not (rules["minimumBedrooms"] <= bedrooms <= rules["maximumBedrooms"]):
                continue
            if not (rules["minimumAccommodates"] <= accommodates <= rules["maximumAccommodates"]):
                continue
            if bathrooms is not None and bathrooms < rules["minimumBathrooms"]:
                continue

            weight = neighborhood_weights[neighborhood]
            weight *= math.exp(-0.35 * abs(bedrooms - target["bedrooms"]))
            weight *= math.exp(-0.14 * abs(accommodates - target["accommodates"]))
            if bathrooms is not None:
                weight *= math.exp(-0.18 * abs(bathrooms - target["bathrooms"]))
            prop = (row.get("property_type") or "").lower()
            if "villa" in prop:
                weight *= 1.15
            elif "house" in prop or "home" in prop:
                weight *= 1.05

            listing_id = str(row["id"])
            comps[listing_id] = weight
            counts[neighborhood] += 1
            weight_by_neighborhood[neighborhood] += weight
            if row.get("last_scraped"):
                scrape_dates.add(row["last_scraped"])

    total_weight = sum(comps.values())
    sum_squares = sum(w*w for w in comps.values())
    effective_sample_size = total_weight*total_weight/sum_squares if sum_squares else 0.0
    comparable_hash = hashlib.sha256("\n".join(f"{k}:{comps[k]:.12f}" for k in sorted(comps)).encode()).hexdigest()

    daily = defaultdict(lambda: {"availableWeight": 0.0, "availableCount": 0, "minStay": []})
    with open_csv(args.calendar) as handle:
        for row in csv.DictReader(handle):
            listing_id = str(row.get("listing_id", ""))
            weight = comps.get(listing_id)
            if weight is None:
                continue
            date = row.get("date")
            if not date:
                continue
            available = (row.get("available") or "").lower() in ("t", "true", "1")
            if available:
                daily[date]["availableWeight"] += weight
                daily[date]["availableCount"] += 1
                minimum = num(row.get("minimum_nights"))
                if minimum is not None:
                    daily[date]["minStay"].append((minimum, weight))

    dates = {}
    for date in sorted(daily):
        bucket = daily[date]
        availability = bucket["availableWeight"] / total_weight if total_weight else None
        dates[date] = {
            "weightedAvailabilityRate": round(availability, 6) if availability is not None else None,
            "marketCompressionIndex": round(1-availability, 6) if availability is not None else None,
            "availableComparableCount": bucket["availableCount"],
            "marketMedianMinimumStay": weighted_quantile(bucket["minStay"], 0.5),
            "marketP75MinimumStay": weighted_quantile(bucket["minStay"], 0.75),
            "unavailableMeans": "booked-or-host-blocked"
        }

    output = {
        "schema": "pmc.market-intelligence-snapshot/v1",
        "source": "Inside Airbnb Rio de Janeiro",
        "sourceScrapeDates": sorted(scrape_dates),
        "comparableSet": {
            "count": len(comps),
            "effectiveSampleSize": round(effective_sample_size, 2),
            "countsByNeighborhood": dict(sorted(counts.items())),
            "weightByNeighborhood": {k: round(v, 6) for k, v in sorted(weight_by_neighborhood.items())},
            "neighborhoodBaseWeights": market["neighborhoodWeights"],
            "hash": comparable_hash
        },
        "limitations": [
            "Inside Airbnb unavailable dates may be bookings or host blocks; they are not treated as proven occupancy.",
            "This snapshot does not infer matched-date competitor price percentiles unless quote dates are normalized separately."
        ],
        "dates": dates
    }
    Path(args.output).write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
