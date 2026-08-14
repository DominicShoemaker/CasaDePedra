import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  applyCalendarOperations,
  applyRuleOperations,
  comparePricingModels,
  createAssistantContext,
  createDeterministicAnswer,
  createDeterministicProposal,
  isRuleChangeRequest,
  parseAssistantResponse,
} from "../assistant-tools.js";
import { createPuterPricingAssistant, PRICING_ASSISTANT_MODEL } from "../assistant-runtime.js";
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

  const proposal = parseAssistantResponse('```json\n{"answer":"I prepared a draft.","proposal":{"summary":"Change documents.","rule_operations":[{"type":"set_base","weekday":"400.00"}],"calendar_operations":[{"type":"update_event","selector":{"key":"gregorian.new-year","date":"2027-01-01"},"changes":{"status":"confirmed"}}]}}\n```');
  assert.equal(proposal.proposal.ruleOperations[0].weekday, "400.00");
  assert.equal(proposal.proposal.calendarOperations[0].changes.status, "confirmed");
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
  assert.equal(
    createDeterministicAnswer(rules, "What is a price difference between 3-day and 2-day Christmas reservation?"),
    "There is no valid price difference: Casa de Pedra's Christmas window requires at least 4 nights, so neither a 2-night nor a 3-night reservation is eligible. Reservation length is measured in nights; select an eligible date range of 4 nights or more to calculate its exact accommodation subtotal.",
  );
  assert.match(
    createDeterministicAnswer(rules, "Compare a 4-night and 5-night Christmas reservation."),
    /requires the year and check-in date/,
  );
});

test("turns explicit base edits into an exact constrained proposal", async () => {
  const { rules } = await fixture();
  const response = createDeterministicProposal(rules, "Set the weekday base to 400 and weekend base to 450.00.");
  assert.deepEqual(response.proposal.ruleOperations, [{ type: "set_base", weekday: "400.00", weekend: "450.00" }]);
  assert.deepEqual(response.proposal.calendarOperations, []);
  assert.equal(createDeterministicProposal(rules, "Lower the low season discount."), null);
});

test("applies constrained calendar operations without mutating the source", async () => {
  const { calendar } = await fixture();
  const candidate = applyCalendarOperations(calendar, [{
    type: "update_event",
    selector: { key: "gregorian.new-year", date: "2027-01-01" },
    changes: { status: "confirmed" },
  }]);
  assert.equal(candidate.events.find(event => event.key === "gregorian.new-year" && event.date === "2027-01-01").status, "confirmed");
  assert.equal(calendar.events.find(event => event.key === "gregorian.new-year" && event.date === "2027-01-01").status, "calculated");
  assert.throws(
    () => applyCalendarOperations(calendar, [{ type: "remove_event", selector: { key: "gregorian.new-year" } }]),
    /match exactly one event/,
  );
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

test("uses Puter Terra directly from the SPA and never calls the pricing backend", async () => {
  const [app, controller, runtime, page] = await Promise.all([
    readFile(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8"),
    readFile(fileURLToPath(new URL("../assistant-controller.js", import.meta.url)), "utf8"),
    readFile(fileURLToPath(new URL("../assistant-runtime.js", import.meta.url)), "utf8"),
    readFile(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8"),
  ]);
  assert.doesNotMatch(app, /@mlc-ai\/web-llm/);
  assert.doesNotMatch(app, /\/api\/v1\/rule-set|\/api\/v1\/calendar-snapshot/);
  assert.match(controller, /from "\.\/assistant-runtime\.js"/);
  assert.match(runtime, /globalThis\.puter\.ai\.chat/);
  assert.doesNotMatch(runtime, /auth\.signIn|attempt_temp_user_creation/);
  assert.match(runtime, /openai\/gpt-5\.6-terra/);
  assert.match(page, /https:\/\/js\.puter\.com\/v2\//);
  assert.doesNotMatch(runtime, /WebLLM|WebGPU|@mlc-ai/);
});

test("normalizes Puter tool calls into validated proposal JSON", async () => {
  const originalPuter = globalThis.puter;
  globalThis.puter = {
    ai: { chat: async (_messages, options) => {
    assert.equal(options.model, "openai/gpt-5.6-terra");
    assert.equal(options.tools[0].function.name, "propose_pricing_changes");
    assert.equal(options.tool_choice.function.name, "propose_pricing_changes");
    return { message: { tool_calls: [{ function: { name: "propose_pricing_changes", arguments: JSON.stringify({
      answer: "Draft prepared.",
      summary: "Raise every New Year rule.",
      rule_operations: [{ type: "update_rule", rule_id: "copacabana-new-year-prime", changes: { apply: { set_final_nightly: "1200.00" } } }],
      calendar_operations: [],
    }) } }] } };
  } } };
  try {
    const runtime = await createPuterPricingAssistant();
    assert.equal(runtime.model, PRICING_ASSISTANT_MODEL);
    const response = parseAssistantResponse(await runtime.respond("system", [], "Set New Year to 1200", true));
    assert.equal(response.proposal.ruleOperations[0].changes.apply.set_final_nightly, "1200.00");
  } finally {
    globalThis.puter = originalPuter;
  }
});

test("collects anonymous Puter streaming answers without an auth flow", async () => {
  const originalPuter = globalThis.puter;
  let requestedOptions;
  globalThis.puter = { ai: { chat: async (_messages, options) => {
    requestedOptions = options;
    return (async function* () {
      yield { text: "Carnival uses " };
      yield { text: "event pricing." };
    })();
  } } };
  try {
    const runtime = await createPuterPricingAssistant();
    assert.equal(await runtime.respond("system", [], "Explain Carnival", false), "Carnival uses event pricing.");
    assert.equal(requestedOptions.stream, true);
    assert.equal(requestedOptions.model, PRICING_ASSISTANT_MODEL);
  } finally {
    globalThis.puter = originalPuter;
  }
});
