import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, compileRuleSet, PriceEngineError, validateRuleSet } from "../src/index.js";
import { clone, makeRuleSet } from "./fixture.js";

test("requires quoted decimal author values and normalizes their scale", () => {
  const rules = makeRuleSet();
  const compiled = compileRuleSet(rules);
  assert.equal(compiled.base.weekday, "380.00");
  assert.equal(compiled.guardrails.rounding.increment, "5.00");
  assert(Object.isFrozen(compiled));
  assert(Object.isFrozen(compiled.rules));

  const unsafe = makeRuleSet();
  unsafe.base.weekday = 380;
  const validation = validateRuleSet(unsafe);
  assert.equal(validation.valid, false);
  assert(validation.errors.some((error) => error.path === "$.base.weekday" && error.message.includes("quoted decimal")));
});

test("rejects duplicate rule ids and unknown fields", () => {
  const rules = makeRuleSet();
  rules.rules[1].id = rules.rules[0].id;
  rules.rules[0].execute = "alert(1)";
  const result = validateRuleSet(rules);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.message === "must be unique"));
  assert(result.errors.some((error) => error.path.endsWith(".execute")));
  assert.throws(() => compileRuleSet(rules), (error) => error instanceof PriceEngineError && error.code === "RULE_SET_INVALID");
});

test("canonical compilation is independent of author file order", () => {
  const first = compileRuleSet(makeRuleSet());
  const reordered = clone(makeRuleSet());
  reordered.rules.reverse();
  const second = compileRuleSet(reordered);
  assert.equal(canonicalJson(first), canonicalJson(second));
});

test("rejects a suppression cycle", () => {
  const rules = makeRuleSet();
  rules.rules.find((rule) => rule.id === "low-season").suppresses = ["major-event"];
  const result = validateRuleSet(rules);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.message.includes("suppression groups contain a cycle")));
});

test("requires rule-level floors and ceilings to align with final rounding", () => {
  const rules = makeRuleSet();
  rules.rules[0].apply.nightly_floor = "302.00";
  const result = validateRuleSet(rules);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.path.endsWith("nightly_floor") && error.message.includes("rounding increment")));
});
