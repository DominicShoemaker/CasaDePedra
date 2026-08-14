---
title: Casa de Pedra Pricing — AI Editing Runbook
audience: AI assistant, automation agent, reviewer
language: en
contract_version: 1
human_approval_required_for_production: true
---

# AI pricing editing runbook

## Purpose

Use this runbook to answer questions about Casa de Pedra pricing, propose or implement changes to price rules, update sanitized event facts, validate changes, and explain marketplace configuration. Follow it as an operational contract.

## Authoritative files

| Purpose | Repository path |
|---|---|
| Production price rules | `config/pricing/casa-de-pedra.yaml` |
| Production sanitized calendar | `services/pricing-api/examples/rio-2027.calendar.json` |
| JSON Schema | `packages/price-engine/schema/price-rules-v1.schema.json` |
| Engine | `packages/price-engine/src/` |
| Pricing API | `services/pricing-api/` |
| Pricing SPA | `apps/pricing-casadepedra-rio/` |
| Human guide | `apps/pricing-casadepedra-rio/docs/human-pricing-guide.md` |

The normalized JSON displayed by the SPA is derived from the authoritative YAML. Do not treat the bundled SPA JSON as the production authoring source.

## Authority boundary

An AI assistant may:

- explain existing rules and quote calculations
- prepare and apply scoped rule/calendar edits requested by the user
- add tests and documentation
- run read-only inspection, builds, validation, and test commands
- show diffs, calculated examples, warnings, and provider instructions

An AI assistant must obtain human approval before deploying rule or calendar changes to production. It must not infer permission to change currency, weaken guardrails, delete event facts, expose secrets, create marketplace promotions, or alter reservation availability.

### Embedded WebLLM assistant boundary

The Pricing SPA's embedded assistant is a lower-authority draft tool:

- It loads only after explicit activation and runs locally in a Web Worker.
- It may answer from the sanitized rule/event context currently loaded in the browser.
- It may propose `set_base`, `update_rule`, `add_rule`, and explicitly requested `remove_rule` operations.
- It may not edit listing identity, currency, timezone, jurisdiction, guardrails, rule-set identity/effective date, or calendar facts.
- Every proposal is applied to a clone, version-bumped, compiled, and evaluated across all one-, two-, and three-night prices in the two-year horizon.
- It may place a validated candidate into the browser editor only after a separate user click.
- It has no credential, repository write, Blob write, administrative API, or production deployment capability.

Treat local model output as untrusted input. Only the deterministic engine's successful result establishes syntactic and calculation validity; it does not replace human commercial approval.

## Required behavior

1. Read the complete authoritative rule file, calendar file, schema, and relevant tests before editing.
2. Restate ambiguous commercial intent as a concrete price/restriction change and ask before implementing if materially different interpretations exist.
3. Preserve unrelated user changes.
4. Make the smallest coherent edit.
5. Increment `rule_set.version` for every pricing behavior change.
6. Preserve `rule_set.id` unless creating a deliberately separate strategy.
7. Change the calendar `id` whenever facts, statuses, resolved keys, expiration, or coverage change.
8. Keep every monetary and percentage value as a quoted decimal string.
9. Add or update deterministic tests for changed boundaries and representative dates.
10. Run all validation commands and report exact results.
11. Show a concise diff summary and price-impact examples.
12. Require explicit approval before production deployment.

## Never do

- Never store credentials, cookies, browser profiles, private iCalendar URLs, access tokens, connection strings, guest data, or payment data in source documents.
- Never accept a frontend price as payment authority.
- Never invent event dates. Calculate a deterministic holiday only when the algorithm is known; otherwise use a cited reliable source and an appropriate status.
- Never mark an uncertain event `confirmed`.
- Never silently extend calendar coverage without resolving every required event key for the extension.
- Never use rule order to resolve ambiguity.
- Never reuse a rule-set version for different content.
- Never perform implicit USD/BRL conversion.
- Never claim marketplace checkout totals are equal.
- Never claim a provider supports a rule when its standard dashboard does not.

## Pricing semantics

- Accommodation intervals are `[checkIn, checkOut)`.
- `date_range.through` is inclusive.
- Event intervals are `[localStart, localEndExclusive)`.
- Exact rational arithmetic is used internally.
- Percent adjustments compound; they do not add.
- Exclusive groups select the highest priority.
- Equal highest priorities in one exclusive group are an error.
- Suppression is evaluated per accommodation night.
- Hard floor and ceiling clamp before final rounding.
- Final nightly values are rounded once; rounded nights are summed.
- `maximum_automatic_change_percent` creates an approval warning when comparison prices are supplied; it is not a clamp.

## Rule mutation protocol

### Base price request

Edit `base.weekday` and/or `base.weekend`. Explain that percent-based seasons inherit the change and fixed final event prices do not. Check hard floor, hard ceiling, and every representative season/event.

### Seasonal request

Use `layer: season`, a stable group such as `annual-season`, and an `annually` or explicit `date_range` condition. Decide whether the rule is exclusive or compound. Check overlaps and priority.

### Event request

Prefer a stable named event key when dates are maintained in the calendar. Use `set_final_nightly` when the commercial intent is an absolute event price. Add a minimum stay only when requested. State which groups the event suppresses.

### Stay-length request

Use `layer: stay` and one exclusive `length-of-stay` group. Boundaries must be complete and non-ambiguous. Confirm behavior immediately below, at, and above every boundary.

### Manual override

Use a uniquely identified dated rule with a higher intentional priority. Avoid permanent high-priority rules for temporary exceptions. Include a cleanup date in the response.

## Calendar mutation protocol

For each event key referenced by rules:

1. Keep it in `coverage.resolvedKeys` only when the resolver deliberately evaluated the entire coverage.
2. Use `date` for a one-day fact or `localStart` plus `localEndExclusive` for an interval.
3. Use `calculated` for deterministic calendar facts, `tentative` for provisional facts, `confirmed` for verified published dates, and `stale` when a formerly usable fact requires refresh.
4. Keep the event inside declared coverage, except a boundary event may be included when required by shoulder-day evaluation.
5. Ensure `expiresAt` is later than the supported pricing horizon.
6. Change the snapshot `id` after any mutation.

If a rule requires a missing, stale, expired, or unresolved event fact, fail closed and explain the missing information.

## Validation commands

Run from the repository root:

```powershell
pnpm test
$env:PRICING_API_BASE_URL='https://<approved-pricing-function-host>'
pnpm build:static
node --check apps/pricing-casadepedra-rio/app.js
node --check apps/pricing-casadepedra-rio/provider-instructions.js
git diff --check
```

Also validate:

- ordinary weekday and weekend
- each season boundary
- each event window and shoulder
- minimum-stay violation
- 1, 2, 3, 6, 7, 13, 14, 27, and 28 nights
- rule/canonical hash change when pricing changes
- calendar hash/ID change when event facts change
- API readiness
- browser/backend parity for representative stays
- marketplace instruction regeneration

Do not deploy when any check fails.

## Marketplace translation contract

Parity means equal USD accommodation subtotal before cleaning fees, taxes, provider fees, marketplace-funded discounts, and currency conversion.

### Airbnb

- Native capability: Base price, Friday/Saturday Custom weekend price, date prices, nightly rule-set adjustments, trip-length discounts, minimum/maximum stay.
- Missing capability: positive trip-length premium.
- Translation: use the engine’s one-night amount as the calendar anchor and invert longer-stay targets into discounts.
- Minimum-work rule: set Base and Custom weekend prices before custom dates, apply the standard LOS rule-set to the full horizon once, and omit ordinary dates whose calculated price and minimum stay are fully covered by those defaults.
- Event dates whose rules suppress `length-of-stay` use a separate no-LOS profile.
- Warn when required discount precision is not accepted or when a stay crosses profiles.
- Disable Smart Pricing and unmodeled discounts/promotions.

### Vrbo standard Owner Dashboard

- Native capability: Base rate customized by day of week, absolute date price, date minimum stay, weekly discount, monthly discount.
- Unsupported: one-night premium, two-night premium, independent 14–27-night discount.
- Translation: set day-of-week Base rates and supported weekly/monthly discounts once, then list only dates whose exact engine three-to-six-night price or minimum stay differs from those defaults.
- Disable rate automation and unmodeled promotions.

### Booking.com standard Extranet

- Native capability: one Standard nightly price per date and length-of-stay restrictions.
- Unsupported in the standard manual model: exact price by stay length.
- Translation: use the exact engine three-to-six-night price per date; configure minimum stay; list every unsupported premium/discount.
- Minimum-work rule: combine only consecutive dates with identical price and restrictions. Do not invent a global weekday/weekend fallback unless current official Extranet documentation verifies one for the property.
- Exact LOS totals require certified Booking.com Connectivity LOS pricing. Do not instruct a normal Extranet user to call the LOS API.
- Disable Genius, mobile, country, campaign, and other unmodeled promotions.

Absolute nightly prices cannot represent several simultaneous stay-length prices for the same date. State this limitation; do not manufacture a false workaround.

## Required response format after an edit

Use these headings:

1. **Outcome** — what changed and why.
2. **Price impact** — before/after examples and affected dates/stays.
3. **Files changed** — authoritative paths.
4. **Validation** — commands and pass/fail counts.
5. **Warnings** — ambiguity, unsupported provider rules, calendar uncertainty, or approval warnings.
6. **Deployment decision** — explicitly state that production deployment requires human approval, unless approval was already provided for this exact change.

When answering a question without editing, distinguish facts found in the rule/calendar documents from an inference or recommendation.
