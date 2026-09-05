# @pmc/pricing-intelligence

Read-only market intelligence and shadow pricing for Casa de Pedra. This service is intentionally outside `@pmc/price-engine` and outside the authoritative pricing API calculation boundary.

## v1 behavior

- polls the private Airbnb and Vrbo iCalendar feeds once daily
- strips guest names, phone digits, reservation URLs and provider free text before persistence
- merges cross-synchronized calendars so mirrored blocks do not double-count the same reservation
- retains immutable point-in-time availability snapshots for future pickup/cancellation analysis
- ingests sanitized Airbnb reservation economics separately from payouts/guest identity
- builds a weighted Inside Airbnb comparable market from Copacabana, Ipanema and Leblon
- normalizes BRL/USD using Banco Central do Brasil PTAX
- produces transparent shadow pricing recommendations only
- never publishes prices or modifies availability

## Neighborhood relevance weights

The base weights are relevance weights, not price discounts:

- Copacabana: `1.00` — direct submarket
- Ipanema: `0.85` — strong nearby substitute for premium group stays
- Leblon: `0.75` — relevant premium substitute but a more distinct submarket

Property similarity then further weights bedroom count, capacity, bathrooms and villa/house property type. The initial attached Rio release produced 524 qualifying listings before similarity weighting: 392 Copacabana, 92 Ipanema and 40 Leblon.

## Secrets

Do not commit provider calendar URLs. Production expects Key Vault-backed app settings:

- `AIRBNB_ICAL_URL`
- `VRBO_ICAL_URL`

The configured secret names are `airbnb-ical-url` and `vrbo-ical-url`.

## Storage

`pricing-intelligence` contains sanitized immutable snapshots and `latest.json` pointers. `pricing-intelligence-raw` is reserved for raw public market releases such as Inside Airbnb. Raw provider calendars are deliberately not persisted because they contain reservation details.

## Inside Airbnb ETL

The Rio calendar is too large to load into the Function on every run. Generate a compact derived snapshot offline:

```bash
python services/pricing-intelligence/scripts/build_inside_airbnb_snapshot.py \
  --config config/intelligence/casa-de-pedra.json \
  --listings listings.csv.gz \
  --calendar calendar.csv.gz \
  --output rio-market.json
```

The derived snapshot explicitly treats unavailable dates as `booked-or-host-blocked`, never as proven occupancy.

## Shadow pricing

The v1 model starts with a price supplied by the authoritative pricing policy and computes a bounded recommendation using inspectable factors such as market compression, market availability, lead time, booking pace, search demand and event demand. Missing signals are simply omitted. Every result contains `mode: "shadow"` and `publish: false`.

This heuristic is a data-collection/champion baseline. It is not the eventual ML model.

## Google data

Search Console and GA4 do not currently exist for the property. Their creation requires access to the owner's Google account and cannot be performed by this repository. Once created, future collectors can add Search Console query/impression data and GA4 traffic data. Direct-site booking-search telemetry is intentionally deferred per the owner decision.

## Validation

```bash
pnpm test:pricing-intelligence
```

Production deployment should occur only after the feature branch is reviewed and the Key Vault secrets have been created. The branch must not be interpreted as approval to publish intelligence recommendations to Airbnb, Vrbo or direct booking.
