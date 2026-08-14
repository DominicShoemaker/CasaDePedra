import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  applyRuleOperations,
  comparePricingModels,
  createAssistantContext,
  createDeterministicAnswer,
  createDeterministicProposal,
  isRuleChangeRequest,
  isDisposedRuntimeError,
  isGpuCompatibilityError,
  parseAssistantResponse,
} from "../assistant-tools.js";
import { createCalendarPricingModel, createCalendarYearHorizon } from "../pricing-model.js";

const rulesPath = fileURLToPath(new URL("../casa-de-pedra.rules.json", import.meta.url));
const calendarPath = fileURLToPath(new URL("../rio-2027.calendar.json", import.meta.url));

async function fixture() {
  const [rules, calendar] = await Promise.all([
    readFile(rulesPath, "utf8").then(JSON.parse),
    readFile(calendarPath, "utf8").then(JSON.parse),
  ]);
  return { rules, calendar };
}

test("creates compact sanitized context from the currently loaded documents", async () => {
  const { rules, calendar } = await fixture();
  const context = createAssistantContext(rules, calendar, "Explain the one-night premium and Rio Carnival.");
  assert.match(context, /Base: weekday 380\.00; weekend 420\.00/);
  assert.match(context, /one-night-premium/);
  assert.match(context, /one night is 50% above/);
  assert.match(context, /ordering-priority only chooses rule precedence/);
  assert.match(context, /br\.rj\.rio\.carnival/);
  assert.doesNotMatch(context, /token|cookie|guest name/i);
});

test("parses structured answers and proposals", () => {
  const answer = parseAssistantResponse('{"answer":"The weekday base is 380 USD.","proposal":null}');
  assert.equal(answer.answer, "The weekday base is 380 USD.");
  assert.equal(answer.proposal, null);

  const proposal = parseAssistantResponse('```json\n{"answer":"I prepared a draft.","proposal":{"summary":"Change base prices.","operations":[{"type":"set_base","weekday":"400.00"}]}}\n```');
  assert.equal(proposal.proposal.operations[0].weekday, "400.00");
});

test("routes explanations to plain text and explicit edits to structured generation", () => {
  assert.equal(isRuleChangeRequest("Explain the current short-stay premiums."), false);
  assert.equal(isRuleChangeRequest("Propose changing the weekday base to 400.00."), true);
  assert.equal(isRuleChangeRequest("Lower the low-season adjustment to -12%."), true);
});

test("answers common numeric questions from deterministic rule data", async () => {
  const { rules } = await fixture();
  assert.match(createDeterministicAnswer(rules, "Explain the one-night and two-night premiums."), /one-night nightly rate is 50%/);
  assert.match(createDeterministicAnswer(rules, "What is the weekday base price?"), /USD 380\.00/);
  assert.equal(createDeterministicAnswer(rules, "Why is Carnival expensive?"), null);
  assert.equal(
    createDeterministicAnswer(rules, "What is a price difference between 3-day and 2-day New Year reservation?"),
    "There is no valid price difference: Casa de Pedra's New Year window requires at least 6 nights, so neither a 2-night nor a 3-night reservation is eligible. Reservation length is measured in nights; select an eligible date range of 6 nights or more to calculate its exact accommodation subtotal.",
  );
});

test("recognizes a disposed browser model session for one-time recovery", () => {
  assert.equal(isDisposedRuntimeError(new Error("Object has already been disposed")), true);
  assert.equal(isDisposedRuntimeError(new Error("Network request failed")), false);
});

test("recognizes GPU compatibility failures for rules-only fallback", () => {
  assert.equal(isGpuCompatibilityError(new Error("Unable to find a compatible GPU")), true);
  assert.equal(isGpuCompatibilityError(new Error("No compatible graphics adapter is available")), true);
  assert.equal(isGpuCompatibilityError(new Error("Network request failed")), false);
});

test("turns explicit base edits into an exact constrained proposal", async () => {
  const { rules } = await fixture();
  const response = createDeterministicProposal(rules, "Set the weekday base to 400 and weekend base to 450.00.");
  assert.deepEqual(response.proposal.operations, [{ type: "set_base", weekday: "400.00", weekend: "450.00" }]);
  assert.equal(createDeterministicProposal(rules, "Lower the low season discount."), null);
});

test("applies constrained operations to a clone and increments the rule version", async () => {
  const { rules } = await fixture();
  const candidate = applyRuleOperations(rules, [
    { type: "set_base", weekday: "400.00", weekend: "450.00" },
    { type: "update_rule", rule_id: "low-season", changes: { apply: { adjust_nightly_percent: "-12" } } },
  ]);
  assert.equal(candidate.base.weekday, "400.00");
  assert.equal(candidate.base.weekend, "450.00");
  assert.equal(candidate.rules.find(rule => rule.id === "low-season").apply.adjust_nightly_percent, "-12");
  assert.equal(candidate.rule_set.version, rules.rule_set.version + 1);
  assert.equal(rules.base.weekday, "380.00");
  assert.equal(rules.rules.find(rule => rule.id === "low-season").apply.adjust_nightly_percent, "-10");
});

test("rejects unsupported direct guardrail and currency edits", async () => {
  const { rules } = await fixture();
  assert.throws(
    () => applyRuleOperations(rules, [{ type: "set_guardrail", hard_floor: "1.00" }]),
    /unsupported type/,
  );
  assert.throws(
    () => applyRuleOperations(rules, [{ type: "set_base", weekday: 400 }]),
    /quoted decimal string/,
  );
});

test("validates a candidate through the real engine and quantifies its two-year impact", async () => {
  const { rules, calendar } = await fixture();
  const horizon = createCalendarYearHorizon("America/Sao_Paulo", 2, new Date("2026-08-04T12:00:00Z"));
  const currentModel = createCalendarPricingModel(rules, calendar, horizon);
  const candidate = applyRuleOperations(rules, [{ type: "set_base", weekday: "400.00" }]);
  const candidateModel = createCalendarPricingModel(candidate, calendar, horizon);
  const impact = comparePricingModels(currentModel, candidateModel);
  assert(impact.changedDates > 0);
  assert(impact.changedValues > impact.changedDates);
  assert(impact.largestIncrease.delta > 0);
  assert.equal(impact.largestDecrease, null);
});

test("keeps WebLLM behind the activation-time dynamic import", async () => {
  const [app, controller, runtime] = await Promise.all([
    readFile(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8"),
    readFile(fileURLToPath(new URL("../assistant-controller.js", import.meta.url)), "utf8"),
    readFile(fileURLToPath(new URL("../assistant-runtime.js", import.meta.url)), "utf8"),
  ]);
  assert.doesNotMatch(app, /@mlc-ai\/web-llm/);
  assert.match(controller, /await import\("\.\/assistant-runtime\.js"\)/);
  assert.doesNotMatch(controller, /@mlc-ai\/web-llm/);
  assert.match(controller, /Rules-only mode/);
  assert.match(runtime, /@mlc-ai\/web-llm/);
});
