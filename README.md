# CasaDePedra monorepo

This repository contains the Casa de Pedra public booking SPA, the pricing laboratory SPA, the shared date-range picker, the provider-neutral JavaScript price engine, and the authoritative Azure Functions pricing API.

## Workspace

- `apps/casadepedra-rio` — public `casadepedra.rio` static site
- `apps/pricing-casadepedra-rio` — pricing simulator/admin SPA
- `packages/date-range-picker` — canonical shared Web Component
- `packages/price-engine` — website-neutral JavaScript pricing engine
- `services/pricing-api` — authoritative Node.js Azure Functions API
- `config/pricing` — source-safe approved pricing rules
- `infra` — West US 2 Bicep infrastructure

## Local verification

```powershell
pnpm install
pnpm test
pnpm build:static
```

Static output is written to `dist/casadepedra-rio` and `dist/pricing-casadepedra-rio`. The production pricing API loads rules and the sanitized calendar snapshot from private Azure Blob Storage through its managed identity. No credentials, provider feed URLs, or deployment tokens belong in this repository.
