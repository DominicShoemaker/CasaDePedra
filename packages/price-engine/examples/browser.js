import { createPriceEngine } from "../src/index.js";

const ruleSet = {
  schema: "pmc.price-rules/v1",
  rule_set: { id: "browser-smoke", version: 1, effective_from: "2026-01-01" },
  listing_context: {
    currency: "USD",
    timezone: "America/Sao_Paulo",
    jurisdiction: { country: "BR" },
  },
  base: { weekday: "100.00", weekend: "120.00", weekend_days: ["fri", "sat"] },
  rules: [],
  guardrails: {
    hard_floor: "50.00",
    hard_ceiling: "500.00",
    maximum_automatic_change_percent: "50",
    rounding: { method: "nearest", increment: "5.00" },
  },
};

const quote = createPriceEngine(ruleSet).evaluateStay({
  checkIn: "2027-05-17",
  checkOut: "2027-05-19",
});

document.querySelector("#result").textContent = JSON.stringify(quote, null, 2);
