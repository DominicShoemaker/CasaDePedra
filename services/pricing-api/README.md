# @pmc/pricing-api

This is the file and HTTP boundary around the independent `@pmc/price-engine` package. The service reads an approved YAML or JSON rule file, validates and normalizes it, calculates a canonical SHA-256 hash, and atomically gives the immutable object to the engine.

Provider credentials, cookies, browser profiles, and adapter code do not belong in this service.

## Run locally

Prerequisites are Node.js 20 or newer and pnpm.

From the repository root:

```powershell
pnpm install
pnpm test
pnpm --filter @pmc/pricing-api start:legacy
```

`start:legacy` keeps `src/server.js` as the local Node HTTP entry point. The equivalent explicit command is `pnpm --filter @pmc/pricing-api start:legacy -- --calendar ".\services\pricing-api\examples\rio-2027.calendar.json"`; relative command-line paths are resolved from the directory where pnpm was invoked.

The default address is `http://127.0.0.1:7072`. `GET /` returns API discovery. The default sources are `config/pricing/casa-de-pedra.yaml` and `services/pricing-api/examples/rio-2027.calendar.json`.

The included calendar JSON is an unverified development fixture. Do not deploy it as an approved production event source.

Because the Casa rules contain named events, readiness and calculation endpoints fail closed until a server-owned calendar snapshot is configured. A rule set containing no event conditions may run without one.

## Configuration

| Environment variable | Default | Meaning |
|---|---:|---|
| `RULES_FILE` | Casa YAML in this repository | Server-owned YAML or JSON rule path |
| `CALENDAR_FILE` | none | Server-owned immutable JSON event snapshot |
| `HOST` | `127.0.0.1` | Listen interface |
| `PORT` | `7072` | Listen port |
| `AUTO_RELOAD_RULES` | `false` | Check source file signatures before requests |
| `ALLOWED_ORIGINS` | empty | Comma-separated browser origins allowed by CORS |

Equivalent command-line options are `--rules`, `--calendar`, `--host`, `--port`, `--allow-origin`, and `--auto-reload`.

When automatic reload is enabled, a candidate file is completely parsed, validated, compiled, and hashed before it replaces the active snapshot. An invalid reload keeps the last-known-good rules and appears in readiness details.

An event calendar snapshot uses this server-owned shape:

```json
{
  "id": "rio-2027.4",
  "expiresAt": "2026-12-31T23:59:59Z",
  "coverage": {
    "from": "2026-09-01",
    "through": "2027-09-30",
    "resolvedKeys": ["br.rj.rio.carnival", "gregorian.new-year"]
  },
  "events": [
    {
      "key": "gregorian.new-year",
      "date": "2027-01-01",
      "status": "calculated"
    }
  ]
}
```

`resolvedKeys` includes keys for which the resolver deliberately found no occurrence. Readiness fails when a required key is unresolved, the snapshot is expired, or it contains stale facts for a required key. Each response records both the rule SHA-256 hash and the canonical calendar SHA-256 hash.

## API

- `GET /` — API discovery document
- `GET /health/live`
- `GET /health/ready`
- `GET /v1/rule-set` — normalized rules for an optional browser preview; supports `ETag`
- `GET /v1/calendar-snapshot` — server-approved event facts for the same optional preview; supports `ETag`
- `POST /v1/pricing/evaluate-calendar`
- `POST /v1/pricing/evaluate-stay`

The standalone `start:legacy` server uses the paths above. Azure Functions adds the normal `/api` prefix.

Stay request:

```json
{
  "checkIn": "2027-02-05",
  "checkOut": "2027-02-11"
}
```

Calendar request:

```json
{
  "from": "2027-05-15",
  "through": "2027-05-31"
}
```

`assumedStayNights` is accepted by the calendar endpoint for an explicitly marked preview. It is never a real quote.

The service rejects unknown request properties. In particular, a browser cannot send `price`, `total`, a rules path, or a calendar snapshot. The server selects the rule and event snapshots and performs the calculation.

Public stay and calendar requests are limited to 366 accommodation dates. The engine indexes events by key before evaluation, and the standalone server sets finite header, request, and keep-alive timeouts. A production deployment must still place the service behind Azure API Management, Front Door, or an equivalent gateway with per-client throttling; CORS is not access control or rate limiting.

## Web application integration

The SPA should send only selection facts such as check-in and check-out, then display the returned nightly ledger and total. Checkout must not accept that displayed number back as authority.

This MVP evaluates prices but does not persist quotes. The payment integration should be the next service layer:

1. Calculate and store a short-lived quote with its rule hash and calendar snapshot ID.
2. Return an opaque `quoteId` to the SPA.
3. Have checkout accept the `quoteId`, reload the stored quote, and create Stripe Checkout from the stored server total.

For Azure production, replace or extend `RuleFileStore` with a private Blob-backed source using managed identity. Keep the same engine and HTTP contract.
