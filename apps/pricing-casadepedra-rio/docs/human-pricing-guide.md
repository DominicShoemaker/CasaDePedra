---
title: Casa de Pedra Pricing — Human Guide
audience: owner, pricing manager, developer
language: en
source_of_truth: config/pricing/casa-de-pedra.yaml
---

# Casa de Pedra pricing guide

This guide explains how to understand, edit, validate, and publish the Casa de Pedra price rules and event calendar. It also defines what it means for Airbnb, Vrbo, Booking.com, and direct booking to have the “same price.”

## The two source documents

Pricing uses two independent documents:

1. **Price rules** describe amounts, seasons, special-event behavior, stay-length adjustments, restrictions, and safety limits. The production source is `config/pricing/casa-de-pedra.yaml`.
2. **Calendar description** resolves named events to local dates. The production source is `services/pricing-api/examples/rio-2027.calendar.json`.

The rules say what to do for “Rio Carnival.” The calendar says when Rio Carnival occurs. Do not hard-code movable holiday dates in a recurring annual rule.

The Pricing SPA loads the server-approved YAML as normalized JSON. The JSON shown in its editor has the same pricing meaning as the YAML source.

## Price parity definition

“Same price” means the same **USD accommodation subtotal before cleaning fees, taxes, marketplace fees, marketplace-funded savings, and currency conversion**.

The final amount shown to a guest can differ because each marketplace controls its own fees, tax presentation, promotions, and foreign-exchange behavior. Never promise identical checkout totals across providers.

## How a stay is calculated

- Check-in is included; checkout is excluded.
- Every accommodation night starts with the weekday or weekend base.
- Matching seasonal and event rules are selected by layer, group, priority, and stacking behavior.
- A rule may suppress another rule group for the same night.
- Stay-length premiums or discounts are applied after nightly rules.
- Guardrails clamp unsafe values.
- Each night is rounded once, then the rounded nights are summed.

The current normal three-to-six-night price is the reference rate. Current short and long stays are adjusted as follows:

| Stay | Adjustment from the reference rate |
|---|---:|
| 1 night | +50% nightly premium |
| 2 nights | +25% nightly premium |
| 3–6 nights | No stay-length adjustment |
| 7–13 nights | 7% stay discount |
| 14–27 nights | 12% stay discount |
| 28+ nights | 18% stay discount |

Special-event rules can suppress stay-length adjustments. For example, a six-night Carnival minimum and final Carnival nightly price take precedence over the normal one- and two-night premiums.

## Rule document anatomy

All money and percentages must be quoted decimal strings. Write `"380.00"`, not `380`.

```yaml
schema: pmc.price-rules/v1
rule_set:
  id: casa-de-pedra-copacabana-direct
  version: 3
  effective_from: 2026-01-01
listing_context:
  currency: USD
  timezone: America/Sao_Paulo
base:
  weekday: "380.00"
  weekend: "420.00"
  weekend_days: [fri, sat]
rules: []
guardrails:
  hard_floor: "300.00"
  hard_ceiling: "1250.00"
  maximum_automatic_change_percent: "50"
  rounding:
    method: nearest
    increment: "5.00"
```

### Conditions

A rule can match:

- one date: `date`
- an inclusive date range: `date_range.from` through `date_range.through`
- a recurring month/day range: `annually`
- weekdays
- a stay length
- a named event from the calendar description
- combinations using `all`, `any`, and `not`

### Actions

A matching rule can:

- set or adjust a nightly price
- set the final nightly price
- apply a stay discount
- set nightly floors or ceilings
- set minimum or maximum stays

Use `set_final_nightly` for an event price that must replace ordinary seasonal calculations. Use a percent adjustment when the price should follow the base.

### Selection and precedence

- Rules in an `exclusive` group compete; the highest priority wins.
- Two matching exclusive rules with the same highest priority are invalid and fail closed.
- `compound` rules combine in the engine’s defined layer order.
- `suppresses` names rule groups, not individual rule IDs.
- Rule file order is not a tie-breaker.

## Common edits

### Change the normal base

Edit `base.weekday` or `base.weekend`. Review every percent-based season because it will inherit the new base. Fixed final event prices will not.

### Add or change a low season

Use an annual season rule:

```yaml
- id: low-season
  name: Late autumn and early winter low season
  layer: season
  group: annual-season
  priority: 100
  stacking: exclusive
  when:
    annually: { from: "05-15", through: "06-30" }
  apply:
    adjust_nightly_percent: "-10"
```

Before adding another annual season, check that overlapping dates have intentional priorities.

### Add a one-time event

If the event has no stable resolver key, use a dated rule and bump the rule-set version:

```yaml
- id: special-concert-2027
  name: Special concert 2027
  layer: event
  group: major-event
  priority: 850
  stacking: exclusive
  when:
    date_range: { from: 2027-10-08, through: 2027-10-10 }
  apply:
    set_final_nightly: "760.00"
    minimum_stay: 3
  suppresses: [annual-season, length-of-stay]
```

Use a named event instead when its dates should be maintained in the calendar description.

## Calendar description

The calendar contains sanitized event facts only. It must not contain guest names, reservation records, private iCalendar URLs, authentication tokens, or provider cookies.

```json
{
  "id": "casa-de-pedra-rio-2026-2029-v2",
  "expiresAt": "2029-12-31T23:59:59Z",
  "coverage": {
    "from": "2026-01-01",
    "through": "2029-12-31",
    "resolvedKeys": ["br.rj.rio.carnival"]
  },
  "events": [
    {
      "key": "br.rj.rio.carnival",
      "localStart": "2027-02-07",
      "localEndExclusive": "2027-02-10",
      "status": "calculated"
    }
  ]
}
```

- `coverage.from` and `coverage.through` are inclusive accommodation dates.
- Event intervals use `localStart` inclusive and `localEndExclusive` exclusive.
- A one-day event may use `date`.
- `resolvedKeys` means each key was deliberately checked throughout the coverage, even when it has no occurrence.
- Allowed status values are `calculated`, `tentative`, `confirmed`, and `stale`.
- A required stale event, missing key, expired snapshot, or date outside coverage fails readiness.
- Change the calendar `id` whenever event facts or coverage change.

Availability and reservations are outside this calendar document.

## Safe editing workflow

1. Pull the latest `main` branch.
2. Edit the YAML rules and/or sanitized calendar JSON.
3. Increment `rule_set.version` for every pricing behavior change. Do not reuse a version for different pricing content.
4. Change the calendar `id` when calendar facts change.
5. Run `pnpm test`.
6. Run `pnpm build:static` and inspect the Pricing SPA.
7. Compare representative ordinary, low-season, holiday, Carnival, New Year, 1-, 2-, 3-, 7-, 14-, and 28-night quotes.
8. Review the generated marketplace instructions and warnings.
9. Present the diff and validation results for human approval.
10. Deploy only after approval. Verify readiness and live sample quotes after deployment.

An invalid candidate must never replace the last known good production rules.

## Optional Puter pricing assistant

The Pricing SPA includes Puter.js and uses `openai/gpt-5.6-terra`. After **Activate Puter pricing assistant** is selected, the SPA calls `puter.ai.chat()` directly and does not invoke a sign-in flow or request a username, password, application API key, or Casa de Pedra account. AI requests travel directly from the browser to Puter; they do not pass through the Casa de Pedra or Azure backend. No GPU is required.

The assistant receives a compact, sanitized summary generated from the rule and calendar documents currently shown in the page. The question and this context are processed externally by Puter/OpenAI. The pricing documents remain in the page unless the user separately applies a validated draft.

For an explicit requested change, the assistant must return constrained rule and/or calendar operations rather than unrestricted replacement documents. The page applies proposed operations to clones, increments the rule-set version when pricing rules change, validates the entire candidate with the existing engine, and calculates the two-year impact. The user must then choose **Apply draft locally** before either textarea changes.

Applying a draft changes only the browser editor, calendar preview, chart, and marketplace instructions. It does not save a file, update Blob Storage, commit to Git, call an administrative endpoint, or publish production prices. Follow the full safe editing workflow above before production deployment. A model response can be mistaken; deterministic validation and human commercial review remain mandatory.

## Marketplace instructions

The Pricing SPA regenerates three instruction tabs whenever **Apply inputs** succeeds.

### Airbnb

Airbnb rule-sets support nightly adjustments, trip-length discounts, and minimum stays. Airbnb does not provide a positive trip-length premium. The generated instructions therefore use the one-night price as an anchor and mathematically invert the premium into discounts for longer stays.

To minimize manual entry, configure the calculated **Base price** and **Custom weekend price** once, before entering any custom dates. Apply the standard LOS rule-set to the complete horizon in one selection. The generated schedule then omits ordinary dates covered by those defaults and lists only seasonal, event, or restriction exceptions. Event dates that suppress stay pricing use a separate no-LOS profile. Airbnb documents [default and custom price precedence](https://www.airbnb.com/help/article/474), [Friday/Saturday weekend pricing](https://www.airbnb.com/help/article/512), and [rule-set capabilities](https://www.airbnb.com/help/article/2061).

Fractional discount precision and stays crossing unlike rule profiles may prevent exact parity. Verify representative searches in Airbnb before publishing.

### Vrbo

Vrbo supports a Base rate customized by day of week, date-specific nightly prices, minimum stays, and weekly/monthly discounts. It does not expose native one-night, two-night, or 14–27-night price brackets in the standard Owner Dashboard. The generated fallback sets the Sunday–Thursday and Friday–Saturday Base rates plus weekly/monthly discounts once, omits every ordinary date they cover, and lists only seasonal, event, or restriction exceptions. See [Manage your rates and discounts](https://help.vrbo.com/articles/How-do-I-manage-my-rates).

### Booking.com

A standard Booking.com rate plan uses one nightly price per date. Exact stay-length totals require its certified LOS connectivity model, which accepts an explicit total by check-in date and stay length. The manual instructions use the Standard rate-plan fallback and combine consecutive dates only when price and restrictions are identical. They do not claim an unverified global weekday/weekend control. See [Booking.com LOS pricing](https://developers.booking.com/connectivity/docs/csv-los_pricing) and [pricing-type certification](https://developers.booking.com/connectivity/docs/configuring-retrieving-pricing-types).

## Troubleshooting

- **Pricing service not ready:** inspect `/api/health/ready`; check rule parsing, required event keys, calendar expiration, and file paths.
- **Different browser and backend price:** compare rule-set hash, calendar snapshot ID/hash, dates, currency, and engine version.
- **Marketplace price differs:** check Smart Pricing/rate automation, promotions, provider currency, fees, taxes, rounding, and unsupported stay-length rules.
- **A date cannot be booked:** check minimum stay, maximum stay, availability, check-in/check-out restrictions, and provider-specific restrictions.
- **Unexpected rule wins:** inspect exclusive group, priority, condition overlap, and suppression.

## Non-negotiable safety rules

- The backend is authoritative for direct-booking payment.
- Browser-provided totals are never trusted.
- Currency is USD unless a new reviewed rule-set version explicitly changes it.
- Do not convert currency implicitly.
- Do not put secrets, PII, private feeds, or credentials in rules, calendar facts, documentation, Git, or browser storage.
- Never describe unsupported marketplace behavior as exact parity.
