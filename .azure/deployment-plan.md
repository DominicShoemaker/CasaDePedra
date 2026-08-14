# CasaDePedra GitHub and Azure Deployment Plan

> **Status:** Deployed — acceptance and custom-domain binding pending

Generated: 2026-08-04

## 1. Project Overview

**Goal:** Consolidate the CasaDePedra website, pricing laboratory, provider-neutral JavaScript price engine, shared date-range picker, and pricing API into the public `DominicShoemaker/CasaDePedra` monorepo. Deploy the two SPAs independently and retain one authoritative server-side pricing engine.

**Path:** Modify and modernize existing Azure applications.

**Safety boundary:** Existing production deployments remain active until replacement deployments pass acceptance tests. The separate `DateRangePickerService` repository and current workflow are not deleted during migration.

## 2. Requirements

| Attribute | Value |
|---|---|
| Classification | Production, customer-facing booking site plus administrative pricing tool |
| Scale | Small, expected under 1,000 concurrent/active users |
| Budget | Cost-optimized; use Azure free/on-demand tiers where appropriate |
| Subscription | `Azure subscription 1` (`9c76be28-01ff-41da-80e6-9c66568b4f6c`), confirmed by owner on 2026-08-04 |
| Location | West US 2 for both Static Web Apps and the new pricing stack; retain the existing reservation stack in West US |
| Compliance | Protect guest PII, Stripe/GCP credentials, private calendar URLs, administrative rule writes, and deployment tokens |

## 3. Components Detected

| Component | Type | Technology | Current path/source |
|---|---|---|---|
| CasaDePedra public site | Static frontend | HTML/CSS/JavaScript | `CasaDePedra-website/` |
| Shared date-range picker | Web Component | Browser JavaScript | `CasaDePedra-website/date-range-picker/date-picker.js` and a divergent pricing-SPA copy |
| Pricing calendar SPA | Static frontend/admin simulator | Browser JavaScript | `Price Update Service/apps/pricing-calendar-spa/` |
| Price engine | Shared library | ESM JavaScript, Node >=20 | `Price Update Service/packages/price-engine/` |
| Pricing HTTP service | API service | Node.js | `Price Update Service/services/pricing-service/` |
| Reservation/payment API | Azure Function App | .NET 10 isolated Functions v4 | `DateRangePickerService/` |
| Current price calculator | Legacy backend library | C# | `DateRangePickerService/PriceCalculator.cs` |
| Current Casa deployment | GitHub Actions | Azure Static Web Apps action | `CasaDePedra-website/.github/workflows/azure-static-web-apps-calm-desert-08659631e.yml` |
| Current reservation deployment | GitHub Actions OIDC | Azure Functions action | `DateRangePickerService/.github/workflows/main_shorttermreservation.yml` |

No Copilot SDK markers were detected.

## 4. Target Repository Layout

```text
CasaDePedra/
├── apps/
│   ├── casadepedra-rio/
│   └── pricing-casadepedra-rio/
├── packages/
│   ├── date-range-picker/
│   └── price-engine/
├── services/
│   ├── pricing-api/
│   └── reservation-api/
├── config/
│   └── pricing/
├── infra/
├── .azure/
├── .github/workflows/
├── package.json
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

Only source-safe configuration is committed. Tokenized iCal URLs, Google credentials, Stripe secrets, deployment tokens, guest data, and production-only settings are excluded.

## 5. Recipe Selection

**Selected:** Bicep infrastructure plus GitHub Actions application deployment.

**Rationale:**

- Existing production applications already use GitHub Actions.
- Bicep provides reviewable, repeatable Azure configuration without replacing the current workflows during migration.
- The monorepo needs path-filtered builds rather than a single all-services deployment.
- Existing resources can be declared/reused while new resources are provisioned explicitly.

## 6. Target Architecture

**Stack:** Two Azure Static Web Apps plus serverless Azure Functions.

| Component | Azure service | Planned tier |
|---|---|---|
| `casadepedra-rio` | Existing Azure Static Web App | Free, retained |
| `pricing-casadepedra-rio` | New Azure Static Web App | Free |
| Authoritative JavaScript pricing API | New standalone Azure Function App | Flex Consumption, on-demand |
| Existing reservation/payment API | Existing .NET Azure Function App | Retained initially |
| Rules and sanitized calendar snapshot | New or existing StorageV2 account, private Blob containers | Standard LRS |
| Pricing API telemetry | Application Insights / Log Analytics | Consumption |
| Service secrets | Key Vault with managed-identity access | Standard |
| Administrative authentication | Microsoft Entra ID | Existing tenant |

### Confirmed Azure baseline

- Existing `CasaDePedra` Static Web App: Free tier, West US 2, deployed from `DominicShoemaker/CasaDePedra` `main`, with `casadepedra.rio` and `www.casadepedra.rio` bound.
- Existing `ShortTermReservation` Function App: Linux Flex Consumption FC1, West US, with system-assigned managed identity.
- Existing reservation storage and Application Insights: West US; existing Log Analytics workspace: West US.
- Subscription policy discovery found only the default Microsoft Defender for Cloud assignment; no location restriction was found.
- Static content remains globally distributed; West US 2 is the resource/control location. The new regional pricing Function, its storage, Key Vault, and monitoring resources will be colocated in West US 2.

### Pricing authority

- Browser calculation is a simulator only in `pricing.casadepedra.rio`.
- `casadepedra.rio` loads a bulk, versioned two-year calendar-price response.
- Exact quotes and reservation/payment totals are recalculated by the pricing Function App.
- The existing .NET payment function must call the authoritative pricing API before creating Stripe Checkout.
- Client-provided prices are ignored.

### Rules/calendar storage

- The Function App reads approved rules and sanitized calendar facts from private Blob Storage using managed identity.
- Public endpoints return only safe pricing data, rule version, ETag, and sanitized availability facts.
- No guest identity, private calendar URL, credential, cookie, or provider token is returned.
- Administrative write/publish operations require Entra authentication and optimistic concurrency with `If-Match`.

## 7. GitHub Work

1. Create a migration branch from `main`.
2. Import the tested pricing workspace without copying its Git history.
3. Move the Casa static site under `apps/casadepedra-rio` while preserving generated root URLs.
4. Consolidate the date-picker copies into `packages/date-range-picker`.
5. Keep `packages/price-engine` as the canonical neutral ESM package.
6. Adapt the pricing service to an Azure Functions Node application under `services/pricing-api`.
7. Initially import the .NET reservation source under `services/reservation-api`; retain its current deployment until cutover.
8. Add deterministic build scripts producing:
   - `dist/casadepedra-rio`
   - `dist/pricing-casadepedra-rio`
   - pricing Function deployment package
9. Add tests for shared packages, both SPA builds, API contracts, price parity, security headers, and forbidden-file leakage.
10. Add path-filtered workflows:
    - Casa app changes deploy only Casa.
    - Pricing app or price-engine changes deploy pricing.
    - Shared date-picker changes deploy both SPAs.
    - Pricing API changes deploy only the pricing Function.
    - Reservation API changes deploy only the existing reservation Function.
11. Use separate Azure deployment credentials/secrets for every Azure resource.
12. Require build/test jobs before deployment jobs and use GitHub environments for production.

## 8. Azure Work

1. Use the confirmed `Azure subscription 1` subscription and the discovered existing resources listed above.
2. Use West US 2 for the new pricing resources and retain the existing reservation resources in West US.
3. Generate Bicep for new resources and `existing` declarations for retained resources.
4. Provision the pricing Static Web App and standalone pricing Function.
5. Configure managed identities and least-privilege Blob/Key Vault access.
6. Configure Application Insights and alerts for failed requests, latency, and Function failures.
7. Configure CORS for `https://casadepedra.rio` and `https://pricing.casadepedra.rio`; CORS is not used as authentication.
8. Configure Entra authentication for administrative endpoints.
9. Store GitHub deployment credentials only as encrypted repository/environment secrets.
10. Deploy pricing to its Azure-generated hostname and run smoke/contract tests.
11. Add and validate `pricing.casadepedra.rio`, then allow Azure to issue TLS.
12. Update Casa to use the authoritative pricing API only after pricing acceptance passes.
13. Verify reservation pricing and Stripe test-mode behavior before production cutover.
14. Retain rollback to the previous Casa and reservation deployments.

## 9. Security Findings Requiring Remediation

- The current `calendars.json` contains tokenized/private iCal URLs. It must not be imported into the public monorepo.
- The account owner must rotate those provider/calendar URLs if they have ever been committed to an accessible repository.
- The current reservation API has anonymous operations and can return reservation metadata. Public availability responses must be separated from administrative/PII responses before consolidation.
- Existing deployment tokens remain in GitHub Secrets; token values are never written to source or logs.

## 10. Provisioning Inventory

| Resource type | Planned new quantity | Validation state |
|---|---:|---|
| `Microsoft.Web/staticSites` Free | 1 | 1 existing of 10 allowed; planned total 2 |
| `Microsoft.Web/sites` pricing Function | 1 | Flex Consumption is available in West US 2; no existing West US 2 Flex app was found |
| `Microsoft.Storage/storageAccounts` | 1 | West US 2 usage 0 of 250; use a dedicated pricing storage account |
| `Microsoft.Insights/components` | 1 | Create a dedicated pricing Application Insights component in West US 2 |
| `Microsoft.OperationalInsights/workspaces` | 1 | Create a dedicated pricing workspace in West US 2 for isolation and colocation |
| `Microsoft.KeyVault/vaults` | 1 | No existing vault found; create a dedicated West US 2 vault with RBAC and managed identity |
| Entra app registrations | 1 | Create only if required for Function administrative authentication; public pricing reads remain anonymous and sanitized |

**Quota validation status:** Passed for the planned footprint on 2026-08-04. West US 2 is supported for Flex Consumption. Azure documents a default regional Flex quota of 250 cores; a small 2,048-MB on-demand pricing function with no always-ready instance is far below it. The Microsoft.Web usage endpoint reports no regional VM allocation, storage reports 0 of 250 accounts, and only 1 of the 10 permitted Free Static Web Apps exists. The generic `Microsoft.Quota` endpoint continued to return a stale provider-registration error after registration, so service-specific availability and usage endpoints were used as the documented fallback.

## 11. Work Ownership

### Codex will perform

- Repository restructuring, file migration, package/workspace configuration, code adaptation, builds, tests, documentation, Bicep, workflows, secret-name references, validation, commits, and deployment monitoring.
- Azure resource discovery, policy/quota checks, provisioning, configuration, health checks, custom-domain binding, and rollback preparation after authorization.
- GitHub secret creation through an authenticated local GitHub CLI/API session when permitted; secret values will not be displayed or committed.

### Account owner must perform

1. Keep Azure and GitHub sessions authenticated when Codex reaches the approved deployment steps.
2. Complete GitHub authentication/authorization when prompted.
3. Approve any security/RBAC or billable-resource changes before they are applied.
4. Rotate the tokenized provider/calendar URLs at Airbnb, Vrbo, and Google if exposed.
5. Approve Entra consent if tenant policy requires an administrator.
6. Add DNS TXT/CNAME records only if the DNS provider cannot be controlled through an available authenticated tool.
7. Perform the final production go-live approval after test URLs pass.

Credentials, tokens and private URLs must be entered only in their provider, Azure, or GitHub interfaces—not in chat.

## 12. Execution and Validation Gates

- [x] Initial workspace analysis
- [x] Component and dependency inventory
- [x] Specialized SDK check
- [x] Preliminary architecture and resource inventory
- [x] Azure sign-in and subscription confirmation
- [x] Region selection, policy discovery, and quota validation
- [x] User approval of completed plan
- [x] Implementation on migration branch `codex/casadepedra-monorepo-pricing`
- [x] Local functional and security verification
- [x] Set plan status to `Ready for Validation`
- [x] Run Azure validation workflow
- [ ] Deploy to non-custom Azure hostnames
- [ ] Acceptance tests and owner go-live approval
- [ ] Bind production custom domain
- [ ] Post-deployment verification and rollback rehearsal

## 13. Approval Decision

The discovery and planning phase is complete. No application or billable Azure resource has been deployed. Owner approval of this plan authorizes Codex to begin the migration branch, repository restructuring, local validation, and preparation of Bicep and GitHub workflows. Provisioning and production cutover remain separately gated by pre-deployment validation and the acceptance checks in Section 12.

## 14. Implementation and Research Summary

- Used Microsoft’s official `Azure-Samples/functions-quickstart-javascript-azd` HTTP/Flex Consumption template as the Function and Bicep base because the Functions template provider and manifest endpoint were unavailable.
- Preserved the template’s Node.js 22 Functions v4 entry point, managed identity, RBAC-only Function storage, FC1 plan, Application Insights, Log Analytics, and deployment-container patterns.
- Added a dedicated Free pricing Static Web App, Standard LRS StorageV2 account, private `pricing-config` blob container, Key Vault with purge protection, and West US 2 telemetry resources.
- The pricing Function uses a user-assigned managed identity for Blob configuration and never receives a storage key or connection string. Shared-key access and public blob access are disabled.
- Existing Azure application settings, Function identity, Static Web App deployment token, custom domains, and GitHub secrets are not modified by the repository migration.
- Added independently path-filtered GitHub workflows for Casa, pricing SPA, pricing API, and manually gated infrastructure.
- Generated deterministic static builds in `dist/casadepedra-rio` and `dist/pricing-casadepedra-rio`; generated output and deployment bundles are ignored by Git.
- Verified 19 engine tests, 7 pricing-SPA tests, and 10 pricing-API tests. Verified a production-style Function bundle includes the injected workspace engine dependency.
- Browser verification confirmed 1/2/3-night switching, minimum-stay highlighting, a two-night quote and adjustment breakdown, the two-year chart, and zero console errors.
- Bicep compiles without diagnostics. Secret scanning found no provider feed URLs, credentials, connection strings, Stripe keys, or deployment-token values.
- The browser JSON and authoritative YAML rules compile to identical canonical rule documents. The sanitized calendar covers 2026–2029 and expires after the supported two-year horizon.

## 15. Azure Validation

- [x] All validation checks pass
  - [x] Bicep compilation
  - [x] Subscription-scope template validation
  - [x] Subscription-scope what-if preview
  - [x] Azure authentication and subscription verification
  - [x] Bicep linting
  - [x] Azure Policy compatibility review
  - [x] Static managed-identity and RBAC verification
  - [x] Application build and test verification

### Validation Proof

- 2026-08-05 pricing SPA release validation: confirmed subscription `Azure subscription 1` (`9c76be28-01ff-41da-80e6-9c66568b4f6c`) and target Free Static Web App `CasaDePedra-Pricing` in `STR-Pricing-West2`, West US 2, with hostname `proud-rock-087e47d1e.7.azurestaticapps.net`.
- `pnpm test:pricing-spa`: 7 tests passed.
- `PRICING_API_BASE_URL=https://str-price-engine-h9dfgcaeh9hnc8ga.westus2-01.azurewebsites.net pnpm build:static`: passed; generated 16 pricing SPA files totaling 141,361 bytes.
- Release scan confirmed the built SPA contains the intended pricing API URL and contains no supplied Static Web Apps deployment token or deployment-secret name.

- `az bicep build --file infra/main.bicep`: passed without diagnostics.
- `az bicep lint --file infra/main.bicep`: passed without diagnostics.
- `az deployment sub validate --location westus2 --template-file infra/main.bicep --parameters infra/main.parameters.json`: `Succeeded` after the final RBAC change.
- `az deployment sub what-if ... --result-format ResourceIdOnly`: `Succeeded`; eight visible changes were all `Create` operations inside the new pricing resource group, with no `Modify` or `Delete` operation.
- `az account show`: authenticated to the confirmed enabled subscription and tenant.
- `az policy assignment list`: only the default Microsoft Defender for Cloud assignment; no incompatible location or SKU policy.
- Static RBAC review: Function UAMI has Storage Blob Data Owner for its Functions host/deployment storage, Monitoring Metrics Publisher for Application Insights, and Key Vault Secrets User. The optional GitHub configuration publisher is narrowed to Storage Blob Data Contributor. All roles are resource-scoped.
- Application verification: 19 engine tests, 7 pricing-SPA tests, 10 pricing-API tests, deterministic static build, production Function packaging dry run, canonical YAML/JSON parity, secret scan, and local browser interaction all passed.

## 16. Deployment Record

- Pricing SPA production deployment completed on 2026-08-05 to Static Web App `CasaDePedra-Pricing` in resource group `STR-Pricing-West2`.
- Production SPA hostname: `https://proud-rock-087e47d1e.7.azurestaticapps.net`.
- The production build targets `https://str-price-engine-h9dfgcaeh9hnc8ga.westus2-01.azurewebsites.net`.
- Post-deployment checks passed: SPA root `200`, configuration loaded, pricing API readiness `200`, rule-set `200`, and CORS explicitly allowed the Static Web App production origin.
- Remaining release work: rotate the exposed Static Web Apps deployment token, bind and validate `pricing.casadepedra.rio`, and complete owner acceptance testing.

- Subscription deployment `casadepedra-pricing-prod-20260804`: `Succeeded` on 2026-08-04.
- Created only the isolated `rg-casadepedra-pricing-prod` resources previewed by what-if; existing Casa and reservation resources were not changed.
- Pricing Static Web App Azure hostname: `https://blue-stone-07f9e6e1e.7.azurestaticapps.net` (application content not yet published).
- Pricing Function Azure hostname: `https://func-api-y5sks6ly34pja.azurewebsites.net` (production bundle uploaded; Azure trigger synchronization and platform health check completed).
- Private Blob configuration: `casa-de-pedra.yaml` and `rio-calendar.json` uploaded and listed successfully.
- Live RBAC verification passed: Function identity has Storage Blob Data Owner on its storage account and Key Vault Secrets User on its vault. The interactive owner has the planned configuration-publisher role.
- Local repository commit: `7da2abc feat: add shared pricing monorepo and Azure deployment` on branch `codex/casadepedra-monorepo-pricing`.
- Remaining gate: the execution environment exhausted its approval quota and rejected `git push`. The branch, workflows, GitHub secrets/variables, Static Web App content, custom domain, and independent public endpoint smoke tests remain pending.

## 17. WebLLM Pricing Assistant Update

> **Status:** Validated and ready for deployment on 2026-08-13

- Add an English-language pricing assistant only to `pricing.casadepedra.rio`; do not change the public reservation website or authoritative pricing API.
- Keep initial page loading fast by downloading the WebLLM runtime and model only after the user activates the assistant.
- Use WebLLM 0.2.84 with the low-resource `SmolLM2-360M-Instruct-q4f16_1-MLC` model in a dedicated Web Worker. Cache model artifacts in browser-origin private storage. This model requires about 376 MB of GPU memory; the originally evaluated Llama 3.2 1B model exceeded the target browser's WebAssembly memory limit.
- Supply sanitized, compact rule and event context from the documents already loaded in the editor. Do not transmit rules, calendar facts, prompts, or responses to a model service.
- Ground common numeric answers and explicit base-price edits directly in the loaded rule document so the low-resource model cannot reinterpret ordering priorities as prices or percentages.
- Permit the model to propose only structured rule operations. Apply those operations to a cloned rule document, automatically increment the rule-set version, and validate the complete two-year candidate through the existing price engine.
- Show the proposed changes and calculated impact before allowing a user to copy the validated candidate into the local editor.
- Never publish, upload, or persist an AI proposal. Production publication remains an authenticated, separately approved server/repository workflow.
- Extend the Static Web App content security policy only for WebLLM's documented model/WASM sources and Web Worker execution.
- Validate unit tests, syntax, deterministic static build, security headers, Azure resource identity, and production UI behavior before completion.

Validation evidence: all 49 workspace tests pass; the deterministic production build succeeds; opt-in loading, cached model initialization, exact 50%/25% short-stay answers, two-year draft validation, and local-only draft application passed browser acceptance testing. Azure target identity was confirmed as `CasaDePedra-Pricing` in `STR-Pricing-West2` (`proud-rock-087e47d1e.7.azurestaticapps.net`, Free, West US 2).
