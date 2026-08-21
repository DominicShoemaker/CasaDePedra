# @pmc/pricing-calendar-spa

This is a static, offline pricing laboratory for the Casa de Pedra calendar. It imports the local `@pmc/price-engine` source directly in the browser; it does not call the pricing HTTP service or any other pricing backend.

The optional pricing assistant uses Puter.js with `openai/gpt-5.6-terra`. On activation it requests Puter's documented temporary-user flow (`attempt_temp_user_creation`), so the visitor does not enter a username, password, or application API key. Puter still authenticates that temporary identity internally. Requests go directly from the browser to Puter and never through the Casa de Pedra or Azure backend. The assistant reads compact, sanitized context generated from the rule and calendar textareas, then returns constrained local rule/calendar operations. No GPU is required. Every candidate passes deterministic engine validation, and the assistant cannot save or publish it.

Exact questions about configured event dates, missing event records, and event price schedules are answered locally from the current documents before Puter is consulted. Remaining Puter explanations are independent requests with no prior model replies replayed into the prompt, preventing a stale generic answer from replacing the current pricing question.

The calculation horizon is always two calendar years beginning on **today in `America/Sao_Paulo`**, inclusive, and ending the day before the same local date two years later. For example, August 4, 2026 produces August 4, 2026 through August 3, 2028. This contains 731 accommodation dates because it crosses leap day in 2028.

The static build uses the shared component at:

`packages/date-range-picker/date-picker.js`

The copied component retains the original click, hover, busy-range, overlap, responsive-month, and `selection-changed` behavior. Its default minimum remains three nights. This SPA explicitly sets `min-stay-days="1"` to demonstrate shorter stays.

## Run

From the repository root:

```powershell
pnpm --filter @pmc/pricing-calendar-spa start
```

Open `http://127.0.0.1:7076/`.

The start script first creates the static build, including generated rule/calendar fixtures, and then `serve.js` exposes that build on loopback only. It performs no pricing calculation and exposes no pricing API.

## Opt-in date-picker options

The one-, two-, and three-night preview controls are absent by default. A host page enables them with the Boolean `show-stay-length-options` attribute:

```html
<str-date-range-picker
  show-stay-length-options
  display-stay-nights="3"
  min-stay-days="1">
</str-date-range-picker>
```

The host supplies precomputed preview data with `setPricingProvider()`:

```js
picker.setPricingProvider({
  getPriceForDate(localDate, assumedStayNights) {},
  getMinimumStayForDate(localDate) {},
  formatPrice(value) {},
});
```

Changing a preview option repaints only the displayed prices and emits `price-display-mode-changed`. It does not change the selected range. When available, `selection-changed` totals are calculated through the injected provider for the actual selected stay length; the host remains responsible for any authoritative selected-range quote.

## Editable documents

- `config/pricing/casa-de-pedra.yaml` is the only rule source. The static build validates and compiles it into `dist/pricing-casadepedra-rio/casa-de-pedra.rules.json`.
- `services/pricing-api/examples/rio-2027.calendar.json` is the only bundled calendar source. The static build copies it to `dist/pricing-casadepedra-rio/rio-2027.calendar.json`.

The page loads both into textareas. **Apply inputs** parses and validates them, then atomically replaces the three local preview series. An invalid edit leaves the last valid calendar and chart intact.

## Assistant safety

- The assistant context contains sanitized pricing rules and event facts only.
- Model output is parsed as untrusted structured input.
- Allowed operations cannot alter currency, listing identity, or guardrails. Calendar edits are limited to explicit event/metadata operations.
- A candidate is version-bumped and evaluated by the deterministic engine over the complete two-year horizon before it can enter the editor.
- **Apply draft locally** affects only the in-memory browser page. Production publication remains a separate authenticated and human-approved workflow.
