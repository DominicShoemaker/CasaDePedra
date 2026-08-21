import { cloneJson, deepFreeze } from "./canonical.js";
import { decimal, isMultiple, toDecimalString, ZERO, compare } from "./decimal.js";
import { isWeekdayName, parseLocalDate, validateMonthDay } from "./dates.js";
import { PriceEngineError } from "./errors.js";

const COMPILED = Symbol("pmc.compiled-price-rules");
const ROOT_KEYS = ["schema", "rule_set", "listing_context", "base", "rules", "guardrails"];
const RULE_KEYS = ["id", "name", "layer", "group", "priority", "stacking", "when", "apply", "suppresses"];
const ACTION_KEYS = [
  "set_nightly",
  "set_final_nightly",
  "adjust_nightly_percent",
  "adjust_nightly_amount",
  "stay_discount_percent",
  "nightly_floor",
  "nightly_ceiling",
  "minimum_stay",
  "maximum_stay",
];
const MONEY_ACTIONS = ["set_nightly", "set_final_nightly", "adjust_nightly_amount", "nightly_floor", "nightly_ceiling"];
const LAYERS = ["season", "weekday_channel", "event", "demand", "manual_override", "stay"];
const EVENT_STATUSES = ["calculated", "tentative", "confirmed", "stale"];

function object(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function addError(errors, path, message) {
  errors.push({ path, message });
}

function keysAre(value, allowed, path, errors) {
  if (!object(value)) {
    addError(errors, path, "must be an object");
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      addError(errors, `${path}.${key}`, "is not supported by schema pmc.price-rules/v1");
    }
  }
  return true;
}

function required(value, names, path, errors) {
  for (const name of names) {
    if (!(name in value)) {
      addError(errors, `${path}.${name}`, "is required");
    }
  }
}

function stringValue(value, path, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    addError(errors, path, "must be a non-empty string");
    return false;
  }
  return true;
}

function integer(value, path, errors, minimum = undefined, maximum = undefined) {
  if (!Number.isInteger(value)) {
    addError(errors, path, "must be an integer");
    return false;
  }
  if (minimum !== undefined && value < minimum) addError(errors, path, `must be at least ${minimum}`);
  if (maximum !== undefined && value > maximum) addError(errors, path, `must be at most ${maximum}`);
  return true;
}

function decimalValue(value, path, errors, { nonnegative = false, positive = false } = {}) {
  if (typeof value !== "string") {
    addError(errors, path, "must be a quoted decimal string");
    return null;
  }
  try {
    const parsed = decimal(value, path);
    if (nonnegative && compare(parsed, ZERO) < 0) addError(errors, path, "must not be negative");
    if (positive && compare(parsed, ZERO) <= 0) addError(errors, path, "must be greater than zero");
    return parsed;
  } catch (error) {
    addError(errors, path, error.message);
    return null;
  }
}

function validateDate(value, path, errors) {
  try {
    parseLocalDate(value, path);
  } catch (error) {
    addError(errors, path, error.message);
  }
}

function validateMonthDayValue(value, path, errors) {
  try {
    validateMonthDay(value, path);
  } catch (error) {
    addError(errors, path, error.message);
  }
}

function validateCondition(condition, path, errors, depth = 0) {
  if (depth > 20) {
    addError(errors, path, "cannot be nested more than 20 levels");
    return;
  }
  if (!object(condition)) {
    addError(errors, path, "must be an object");
    return;
  }
  const operators = Object.keys(condition);
  if (operators.length !== 1) {
    addError(errors, path, "must contain exactly one condition operator");
    return;
  }
  const operator = operators[0];
  const value = condition[operator];

  if (operator === "all" || operator === "any") {
    if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
      addError(errors, `${path}.${operator}`, "must be a non-empty array");
      return;
    }
    value.forEach((child, index) => validateCondition(child, `${path}.${operator}[${index}]`, errors, depth + 1));
    return;
  }

  if (operator === "not") {
    validateCondition(value, `${path}.not`, errors, depth + 1);
    return;
  }

  if (operator === "date") {
    validateDate(value, `${path}.date`, errors);
    return;
  }

  if (operator === "date_range") {
    if (!keysAre(value, ["from", "through"], `${path}.date_range`, errors)) return;
    required(value, ["from", "through"], `${path}.date_range`, errors);
    if ("from" in value) validateDate(value.from, `${path}.date_range.from`, errors);
    if ("through" in value) validateDate(value.through, `${path}.date_range.through`, errors);
    if (typeof value.from === "string" && typeof value.through === "string" && value.from > value.through) {
      addError(errors, `${path}.date_range`, "from must not be after through");
    }
    return;
  }

  if (operator === "annually") {
    if (!keysAre(value, ["from", "through"], `${path}.annually`, errors)) return;
    required(value, ["from", "through"], `${path}.annually`, errors);
    if ("from" in value) validateMonthDayValue(value.from, `${path}.annually.from`, errors);
    if ("through" in value) validateMonthDayValue(value.through, `${path}.annually.through`, errors);
    return;
  }

  if (operator === "weekday") {
    if (!Array.isArray(value) || value.length === 0 || value.some((day) => !isWeekdayName(day))) {
      addError(errors, `${path}.weekday`, "must be a non-empty array containing mon through sun");
    } else if (new Set(value).size !== value.length) {
      addError(errors, `${path}.weekday`, "must not contain duplicate days");
    }
    return;
  }

  if (operator === "stay_nights") {
    if (!keysAre(value, ["exactly", "at_least", "fewer_than"], `${path}.stay_nights`, errors)) return;
    const hasExactly = "exactly" in value;
    const hasRange = "at_least" in value || "fewer_than" in value;
    if (hasExactly === hasRange || (!hasExactly && !("at_least" in value))) {
      addError(errors, `${path}.stay_nights`, "must use exactly, or at_least with optional fewer_than");
    }
    if (hasExactly) integer(value.exactly, `${path}.stay_nights.exactly`, errors, 1, 3660);
    if ("at_least" in value) integer(value.at_least, `${path}.stay_nights.at_least`, errors, 1, 3660);
    if ("fewer_than" in value) integer(value.fewer_than, `${path}.stay_nights.fewer_than`, errors, 2, 3661);
    if (Number.isInteger(value.at_least) && Number.isInteger(value.fewer_than) && value.fewer_than <= value.at_least) {
      addError(errors, `${path}.stay_nights`, "fewer_than must be greater than at_least");
    }
    return;
  }

  if (operator === "event") {
    if (!keysAre(value, ["key", "days_before", "days_after", "accepted_status"], `${path}.event`, errors)) return;
    required(value, ["key"], `${path}.event`, errors);
    if ("key" in value) stringValue(value.key, `${path}.event.key`, errors);
    if ("days_before" in value) integer(value.days_before, `${path}.event.days_before`, errors, 0, 366);
    if ("days_after" in value) integer(value.days_after, `${path}.event.days_after`, errors, 0, 366);
    if ("accepted_status" in value) {
      if (!Array.isArray(value.accepted_status) || value.accepted_status.length === 0 || value.accepted_status.some((status) => !EVENT_STATUSES.includes(status))) {
        addError(errors, `${path}.event.accepted_status`, `must contain only ${EVENT_STATUSES.join(", ")}`);
      }
    }
    return;
  }

  addError(errors, `${path}.${operator}`, "is not a supported v1 condition");
}

function validateAction(action, path, errors, currencyIncrement, roundingIncrement) {
  if (!keysAre(action, ACTION_KEYS, path, errors)) return;
  if (Object.keys(action).length === 0) addError(errors, path, "must contain at least one action");

  for (const key of MONEY_ACTIONS) {
    if (!(key in action)) continue;
    const parsed = decimalValue(action[key], `${path}.${key}`, errors, {
      nonnegative: key !== "adjust_nightly_amount",
    });
    if (parsed && currencyIncrement && !isMultiple(parsed, currencyIncrement)) {
      addError(errors, `${path}.${key}`, "must not use fractions smaller than the configured currency precision");
    }
    if (parsed && roundingIncrement && ["nightly_floor", "nightly_ceiling"].includes(key) && !isMultiple(parsed, roundingIncrement)) {
      addError(errors, `${path}.${key}`, "must be a multiple of the global rounding increment");
    }
  }

  if ("adjust_nightly_percent" in action) {
    const parsed = decimalValue(action.adjust_nightly_percent, `${path}.adjust_nightly_percent`, errors);
    if (parsed && compare(parsed, decimal(-100)) <= 0) addError(errors, `${path}.adjust_nightly_percent`, "must be greater than -100");
  }
  if ("stay_discount_percent" in action) {
    const parsed = decimalValue(action.stay_discount_percent, `${path}.stay_discount_percent`, errors, { nonnegative: true });
    if (parsed && compare(parsed, decimal(100)) >= 0) addError(errors, `${path}.stay_discount_percent`, "must be less than 100");
  }
  if ("minimum_stay" in action) integer(action.minimum_stay, `${path}.minimum_stay`, errors, 1, 3660);
  if ("maximum_stay" in action) integer(action.maximum_stay, `${path}.maximum_stay`, errors, 1, 3660);
  if (Number.isInteger(action.minimum_stay) && Number.isInteger(action.maximum_stay) && action.minimum_stay > action.maximum_stay) {
    addError(errors, path, "minimum_stay must not exceed maximum_stay");
  }
  if ("nightly_floor" in action && "nightly_ceiling" in action) {
    try {
      if (compare(decimal(action.nightly_floor), decimal(action.nightly_ceiling)) > 0) {
        addError(errors, path, "nightly_floor must not exceed nightly_ceiling");
      }
    } catch {
      // Individual decimal errors are already recorded above.
    }
  }
}

function validateSuppressionGraph(rules, errors) {
  const graph = new Map();
  for (const rule of rules) {
    if (!graph.has(rule.group)) graph.set(rule.group, new Set());
    for (const target of rule.suppresses ?? []) graph.get(rule.group).add(target);
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(group, trail) {
    if (visiting.has(group)) {
      addError(errors, "rules", `suppression groups contain a cycle: ${[...trail, group].join(" -> ")}`);
      return;
    }
    if (visited.has(group)) return;
    visiting.add(group);
    for (const target of graph.get(group) ?? []) visit(target, [...trail, group]);
    visiting.delete(group);
    visited.add(group);
  }
  for (const group of graph.keys()) visit(group, []);
}

export function validateRuleSet(document) {
  const errors = [];
  if (!keysAre(document, ROOT_KEYS, "$", errors)) return { valid: false, errors };
  required(document, ROOT_KEYS, "$", errors);
  if (document.schema !== "pmc.price-rules/v1") addError(errors, "$.schema", "must equal pmc.price-rules/v1");

  if (keysAre(document.rule_set, ["id", "version", "effective_from"], "$.rule_set", errors)) {
    required(document.rule_set, ["id", "version", "effective_from"], "$.rule_set", errors);
    if ("id" in document.rule_set) stringValue(document.rule_set.id, "$.rule_set.id", errors);
    if ("version" in document.rule_set) integer(document.rule_set.version, "$.rule_set.version", errors, 1);
    if ("effective_from" in document.rule_set) validateDate(document.rule_set.effective_from, "$.rule_set.effective_from", errors);
  }

  let currencyDecimals = 2;
  if (keysAre(document.listing_context, ["currency", "currency_decimals", "timezone", "jurisdiction"], "$.listing_context", errors)) {
    required(document.listing_context, ["currency", "timezone", "jurisdiction"], "$.listing_context", errors);
    if ("currency" in document.listing_context && !/^[A-Z]{3}$/.test(document.listing_context.currency)) addError(errors, "$.listing_context.currency", "must be an uppercase ISO-style three-letter currency code");
    if ("currency_decimals" in document.listing_context) {
      if (integer(document.listing_context.currency_decimals, "$.listing_context.currency_decimals", errors, 0, 6)) currencyDecimals = document.listing_context.currency_decimals;
    }
    if ("timezone" in document.listing_context) stringValue(document.listing_context.timezone, "$.listing_context.timezone", errors);
    if (keysAre(document.listing_context.jurisdiction, ["country", "subdivision", "municipality"], "$.listing_context.jurisdiction", errors)) {
      required(document.listing_context.jurisdiction, ["country"], "$.listing_context.jurisdiction", errors);
      for (const key of ["country", "subdivision", "municipality"]) {
        if (key in document.listing_context.jurisdiction) stringValue(document.listing_context.jurisdiction[key], `$.listing_context.jurisdiction.${key}`, errors);
      }
    }
  }

  const minorIncrement = decimal(currencyDecimals === 0 ? "1" : `0.${"0".repeat(currencyDecimals - 1)}1`);
  if (keysAre(document.base, ["weekday", "weekend", "weekend_days"], "$.base", errors)) {
    required(document.base, ["weekday", "weekend", "weekend_days"], "$.base", errors);
    for (const key of ["weekday", "weekend"]) {
      if (!(key in document.base)) continue;
      const parsed = decimalValue(document.base[key], `$.base.${key}`, errors, { nonnegative: true });
      if (parsed && !isMultiple(parsed, minorIncrement)) addError(errors, `$.base.${key}`, "must not use fractions smaller than the configured currency precision");
    }
    if (!Array.isArray(document.base.weekend_days) || document.base.weekend_days.length === 0 || document.base.weekend_days.some((day) => !isWeekdayName(day))) {
      addError(errors, "$.base.weekend_days", "must be a non-empty array containing mon through sun");
    } else if (new Set(document.base.weekend_days).size !== document.base.weekend_days.length) {
      addError(errors, "$.base.weekend_days", "must not contain duplicate days");
    }
  }

  let roundingIncrement = null;
  if (keysAre(document.guardrails, ["hard_floor", "hard_ceiling", "maximum_automatic_change_percent", "rounding"], "$.guardrails", errors)) {
    required(document.guardrails, ["hard_floor", "hard_ceiling", "maximum_automatic_change_percent", "rounding"], "$.guardrails", errors);
    const floor = "hard_floor" in document.guardrails ? decimalValue(document.guardrails.hard_floor, "$.guardrails.hard_floor", errors, { nonnegative: true }) : null;
    const ceiling = "hard_ceiling" in document.guardrails ? decimalValue(document.guardrails.hard_ceiling, "$.guardrails.hard_ceiling", errors, { positive: true }) : null;
    if (floor && ceiling && compare(floor, ceiling) > 0) addError(errors, "$.guardrails", "hard_floor must not exceed hard_ceiling");
    decimalValue(document.guardrails.maximum_automatic_change_percent, "$.guardrails.maximum_automatic_change_percent", errors, { nonnegative: true });
    if (keysAre(document.guardrails.rounding, ["method", "increment"], "$.guardrails.rounding", errors)) {
      required(document.guardrails.rounding, ["method", "increment"], "$.guardrails.rounding", errors);
      if (!['nearest', 'up', 'down'].includes(document.guardrails.rounding.method)) addError(errors, "$.guardrails.rounding.method", "must be nearest, up, or down");
      roundingIncrement = decimalValue(document.guardrails.rounding.increment, "$.guardrails.rounding.increment", errors, { positive: true });
      if (roundingIncrement && !isMultiple(roundingIncrement, minorIncrement)) addError(errors, "$.guardrails.rounding.increment", "must align with the configured currency precision");
      if (floor && roundingIncrement && !isMultiple(floor, roundingIncrement)) addError(errors, "$.guardrails.hard_floor", "must be a multiple of the rounding increment");
      if (ceiling && roundingIncrement && !isMultiple(ceiling, roundingIncrement)) addError(errors, "$.guardrails.hard_ceiling", "must be a multiple of the rounding increment");
    }
  }

  if (!Array.isArray(document.rules)) {
    addError(errors, "$.rules", "must be an array");
  } else {
    if (document.rules.length > 1000) addError(errors, "$.rules", "cannot contain more than 1,000 rules");
    const ids = new Set();
    const groupDefinitions = new Map();
    const groups = new Set(document.rules.filter(object).map((rule) => rule.group));
    document.rules.forEach((rule, index) => {
      const path = `$.rules[${index}]`;
      if (!keysAre(rule, RULE_KEYS, path, errors)) return;
      required(rule, ["id", "name", "layer", "group", "priority", "stacking", "when", "apply"], path, errors);
      if ("id" in rule && stringValue(rule.id, `${path}.id`, errors)) {
        if (ids.has(rule.id)) addError(errors, `${path}.id`, "must be unique");
        ids.add(rule.id);
      }
      if ("name" in rule) stringValue(rule.name, `${path}.name`, errors);
      if (!LAYERS.includes(rule.layer)) addError(errors, `${path}.layer`, `must be one of ${LAYERS.join(", ")}`);
      if ("group" in rule) stringValue(rule.group, `${path}.group`, errors);
      integer(rule.priority, `${path}.priority`, errors);
      if (!['exclusive', 'compound'].includes(rule.stacking)) addError(errors, `${path}.stacking`, "must be exclusive or compound");
      validateCondition(rule.when, `${path}.when`, errors);
      validateAction(rule.apply, `${path}.apply`, errors, minorIncrement, roundingIncrement);
      if ("suppresses" in rule) {
        if (!Array.isArray(rule.suppresses) || rule.suppresses.some((group) => typeof group !== "string" || group === "")) {
          addError(errors, `${path}.suppresses`, "must be an array of group names");
        } else {
          for (const target of rule.suppresses) {
            if (target === rule.group) addError(errors, `${path}.suppresses`, "a rule cannot suppress its own group");
            if (!groups.has(target)) addError(errors, `${path}.suppresses`, `references unknown group ${target}`);
          }
        }
      }
      if (typeof rule.group === "string") {
        const previous = groupDefinitions.get(rule.group);
        const definition = `${rule.layer}:${rule.stacking}`;
        if (previous && previous !== definition) addError(errors, `${path}.group`, "all rules in a group must use the same layer and stacking mode");
        groupDefinitions.set(rule.group, definition);
      }
    });
    validateSuppressionGraph(document.rules.filter(object), errors);
  }

  return deepFreeze({ valid: errors.length === 0, errors });
}

function normalizeMoney(value, decimals) {
  return toDecimalString(decimal(value), decimals);
}

function normalizeCondition(condition) {
  const [operator, value] = Object.entries(condition)[0];
  if (operator === "all" || operator === "any") return { [operator]: value.map(normalizeCondition) };
  if (operator === "not") return { not: normalizeCondition(value) };
  if (operator === "event") {
    return {
      event: {
        key: value.key,
        days_before: value.days_before ?? 0,
        days_after: value.days_after ?? 0,
        accepted_status: [...(value.accepted_status ?? ["confirmed", "calculated"])].sort(),
      },
    };
  }
  return cloneJson(condition);
}

export function compileRuleSet(document) {
  if (document?.[COMPILED]) return document;
  const validation = validateRuleSet(document);
  if (!validation.valid) {
    throw new PriceEngineError("RULE_SET_INVALID", "The pricing rule set is invalid.", { errors: validation.errors });
  }

  const normalized = cloneJson(document, "rule set");
  const decimals = normalized.listing_context.currency_decimals ?? 2;
  normalized.listing_context.currency_decimals = decimals;
  normalized.base.weekday = normalizeMoney(normalized.base.weekday, decimals);
  normalized.base.weekend = normalizeMoney(normalized.base.weekend, decimals);
  normalized.guardrails.hard_floor = normalizeMoney(normalized.guardrails.hard_floor, decimals);
  normalized.guardrails.hard_ceiling = normalizeMoney(normalized.guardrails.hard_ceiling, decimals);
  normalized.guardrails.rounding.increment = normalizeMoney(normalized.guardrails.rounding.increment, decimals);
  normalized.guardrails.maximum_automatic_change_percent = String(normalized.guardrails.maximum_automatic_change_percent);

  for (const rule of normalized.rules) {
    rule.when = normalizeCondition(rule.when);
    rule.suppresses = [...(rule.suppresses ?? [])].sort();
    for (const key of MONEY_ACTIONS) {
      if (key in rule.apply) rule.apply[key] = normalizeMoney(rule.apply[key], decimals);
    }
    for (const key of ["adjust_nightly_percent", "stay_discount_percent"]) {
      if (key in rule.apply) rule.apply[key] = String(rule.apply[key]);
    }
  }
  normalized.rules.sort((left, right) => {
    const layer = LAYERS.indexOf(left.layer) - LAYERS.indexOf(right.layer);
    if (layer !== 0) return layer;
    return left.group.localeCompare(right.group) || right.priority - left.priority || left.id.localeCompare(right.id);
  });

  Object.defineProperty(normalized, COMPILED, { value: true, enumerable: false });
  return deepFreeze(normalized);
}

export const RULE_LAYERS = Object.freeze([...LAYERS]);
