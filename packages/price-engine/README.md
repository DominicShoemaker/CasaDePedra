# @pmc/price-engine

`@pmc/price-engine` is a pure JavaScript pricing engine. It has no runtime dependencies and does not access Node APIs, the DOM, the network, the filesystem, environment variables, provider APIs, or the current clock. The same ES module can run in a browser, Web Worker, Node service, or background process.

The engine accepts an already parsed JavaScript object. YAML parsing and file loading deliberately belong to the separate pricing service.

## Public API

```js
import { compileRuleSet, createPriceEngine } from "@pmc/price-engine";

const compiled = compileRuleSet(ruleObject);
const engine = createPriceEngine(compiled, {
  ruleSetHash: "sha256:optional-service-supplied-hash",
});

const quote = engine.evaluateStay({
  checkIn: "2027-02-05",
  checkOut: "2027-02-11",
  calendarSnapshot: {
    id: "rio-2027.1",
    expiresAt: "2027-01-31T23:59:59Z",
    events: [
      {
        key: "br.rj.rio.carnival",
        localStart: "2027-02-07",
        localEndExclusive: "2027-02-10",
        status: "calculated"
      }
    ],
    coverage: {
      from: "2027-01-01",
      through: "2027-12-31",
      resolvedKeys: ["br.rj.rio.carnival"]
    }
  }
});
```

The stay interval is check-in inclusive and check-out exclusive. Event intervals are also half-open. A one-day event may use the shorthand `{ "date": "2027-01-01" }`.

When rules refer to named events, the snapshot must declare a coverage range and every event key resolved for that range. A resolved key may have no occurrence; listing it means the calendar resolver deliberately determined that there is no matching event. Missing keys and dates outside coverage fail closed.

For date-only prices:

```js
const calendar = engine.evaluateCalendar({
  from: "2027-05-15",
  through: "2027-05-21"
});
```

Ordinary calendar evaluation excludes length-of-stay rules. Supplying `assumedStayNights` enables them only for a result explicitly marked `previewOnly: true`.

## Browser use

No bundle is required when the package source is served as an ES module:

```html
<script type="module">
  import { createPriceEngine } from "/price-engine/src/index.js";
  const engine = createPriceEngine(window.normalizedRuleObject);
</script>
```

The browser result is suitable for an immediate preview. A backend must still recalculate or retrieve a stored authoritative quote before payment.

Run the included smoke page with `pnpm example:browser`, then open `http://127.0.0.1:8765/examples/browser.html`.

## Deterministic behavior

- Currency arithmetic uses exact `BigInt` rational values internally; JavaScript floating-point arithmetic is never used for prices.
- All money and percentage values in a rule document must be quoted decimal strings; numeric JSON/YAML scalars are rejected before they can lose precision.
- Percentages compound multiplicatively and intermediate prices are not rounded.
- Exclusive groups choose the highest priority. Equal-priority matches fail with `AMBIGUOUS_RULE`.
- Suppression is evaluated per accommodation night.
- Hard bounds clamp; `maximum_automatic_change_percent` only raises an approval warning when comparison prices are supplied.
- Every final night is rounded once, then rounded nightly prices are summed.
- `nightlySubtotal + stayPremium - stayDiscount` and `nightlySubtotal + stayAdjustment` both equal `totalBeforeFeesAndTax`; displayed stay adjustments therefore reconcile with the rounded nightly ledger.

See `schema/price-rules-v1.schema.json` for the authoring contract.
