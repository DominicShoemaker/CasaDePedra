export function makeRuleSet() {
  return {
    schema: "pmc.price-rules/v1",
    rule_set: { id: "casa-test", version: 1, effective_from: "2026-09-01" },
    listing_context: {
      currency: "USD",
      timezone: "America/Sao_Paulo",
      jurisdiction: { country: "BR", subdivision: "BR-RJ", municipality: "IBGE:3304557" },
    },
    base: { weekday: "380.00", weekend: "420.00", weekend_days: ["fri", "sat"] },
    rules: [
      {
        id: "low-season",
        name: "Low season",
        layer: "season",
        group: "annual-season",
        priority: 100,
        stacking: "exclusive",
        when: { annually: { from: "05-15", through: "06-30" } },
        apply: { adjust_nightly_percent: "-10" },
      },
      {
        id: "summer",
        name: "Summer",
        layer: "season",
        group: "annual-season",
        priority: 120,
        stacking: "exclusive",
        when: { annually: { from: "12-01", through: "03-31" } },
        apply: { adjust_nightly_percent: "15" },
      },
      {
        id: "christmas",
        name: "Christmas",
        layer: "event",
        group: "major-event",
        priority: 700,
        stacking: "exclusive",
        when: { annually: { from: "12-20", through: "12-26" } },
        apply: { adjust_nightly_percent: "25", minimum_stay: 4 },
        suppresses: ["length-of-stay"],
      },
      {
        id: "carnival",
        name: "Carnival",
        layer: "event",
        group: "major-event",
        priority: 900,
        stacking: "exclusive",
        when: {
          event: {
            key: "br.rj.rio.carnival",
            days_before: 2,
            days_after: 1,
            accepted_status: ["confirmed", "calculated"],
          },
        },
        apply: { set_final_nightly: "820.00", minimum_stay: 6 },
        suppresses: ["annual-season", "length-of-stay"],
      },
      {
        id: "carnival-prime",
        name: "Carnival prime",
        layer: "event",
        group: "major-event",
        priority: 910,
        stacking: "exclusive",
        when: {
          all: [
            { event: { key: "br.rj.rio.carnival", days_before: 2, days_after: 1, accepted_status: ["confirmed", "calculated"] } },
            { weekday: ["fri", "sat", "sun"] },
          ],
        },
        apply: { set_final_nightly: "950.00", minimum_stay: 6 },
        suppresses: ["annual-season", "length-of-stay"],
      },
      {
        id: "new-year",
        name: "New Year",
        layer: "event",
        group: "major-event",
        priority: 950,
        stacking: "exclusive",
        when: { event: { key: "gregorian.new-year", days_before: 4, days_after: 1, accepted_status: ["confirmed", "calculated"] } },
        apply: { set_final_nightly: "920.00", minimum_stay: 6 },
        suppresses: ["annual-season", "length-of-stay"],
      },
      {
        id: "new-year-tail",
        name: "New Year tail",
        layer: "event",
        group: "major-event",
        priority: 955,
        stacking: "exclusive",
        when: {
          all: [
            { event: { key: "gregorian.new-year", days_before: 4, days_after: 1, accepted_status: ["confirmed", "calculated"] } },
            { annually: { from: "01-02", through: "01-02" } },
          ],
        },
        apply: { set_final_nightly: "800.00", minimum_stay: 6 },
        suppresses: ["annual-season", "length-of-stay"],
      },
      {
        id: "one-night",
        name: "One-night premium",
        layer: "stay",
        group: "length-of-stay",
        priority: 200,
        stacking: "exclusive",
        when: { stay_nights: { exactly: 1 } },
        apply: { adjust_nightly_percent: "50" },
      },
      {
        id: "two-night",
        name: "Two-night premium",
        layer: "stay",
        group: "length-of-stay",
        priority: 190,
        stacking: "exclusive",
        when: { stay_nights: { exactly: 2 } },
        apply: { adjust_nightly_percent: "25" },
      },
      {
        id: "weekly",
        name: "Weekly discount",
        layer: "stay",
        group: "length-of-stay",
        priority: 100,
        stacking: "exclusive",
        when: { stay_nights: { at_least: 7, fewer_than: 14 } },
        apply: { stay_discount_percent: "7" },
      },
    ],
    guardrails: {
      hard_floor: "300.00",
      hard_ceiling: "1250.00",
      maximum_automatic_change_percent: "50",
      rounding: { method: "nearest", increment: "5.00" },
    },
  };
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export const carnivalCalendar = {
  id: "rio-2027-test",
  expiresAt: "2028-12-31T23:59:59Z",
  coverage: {
    from: "2026-09-01",
    through: "2028-12-31",
    resolvedKeys: ["br.rj.rio.carnival", "gregorian.new-year"],
  },
  events: [
    {
      key: "br.rj.rio.carnival",
      localStart: "2027-02-07",
      localEndExclusive: "2027-02-10",
      status: "calculated",
    },
    { key: "gregorian.new-year", date: "2027-01-01", status: "calculated" },
  ],
};
