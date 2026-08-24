# Google Search Console and GA4 setup for pricing intelligence

Casa de Pedra currently has neither Google Search Console nor GA4 configured for the pricing-intelligence workflow.

## Search Console

Create a Domain property for `casadepedra.rio` in Google Search Console and verify it with the DNS method. The future collector should request daily query/page/country/device performance and store only aggregate search-intent data needed for pricing analysis.

Recommended retained fields:

- date
- query
- page
- country
- device
- impressions
- clicks
- ctr
- average position

The collector must not treat Search Console impressions as bookings or availability.

## Google Analytics 4

Create a GA4 property for Casa de Pedra and a Web data stream for `https://casadepedra.rio`. Initially GA4 is useful for traffic/source/landing-page trends even before direct-booking search telemetry is enabled.

Direct booking-search events are intentionally deferred until a later change. Do not add `stay_search`, `quote_created`, or checkout events in this branch.

## Future secret/config boundary

When the properties exist, keep OAuth/service-account credentials outside Git. Prefer Azure Key Vault or workload identity. Store only property IDs / measurement IDs in non-secret configuration.

## Current status

This repository change does not create the Google account properties because doing so requires authenticated administrative access to the owner's Google account. It prepares the data contract and preserves a clear insertion point for future collectors.
