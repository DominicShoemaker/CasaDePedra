import { cloneJson, deepFreeze } from "./canonical.js";
import { compileRuleSet, RULE_LAYERS } from "./compile.js";
import {
  absolute,
  add,
  ceilToIncrement,
  compare,
  decimal,
  floorToIncrement,
  maximum,
  minimum,
  multiply,
  percentFactor,
  roundToIncrement,
  subtract,
  toDecimalString,
  toExactDecimalString,
  ZERO,
  HUNDRED,
} from "./decimal.js";
import {
  addDays,
  compareDates,
  daysBetween,
  enumerateDates,
  matchesAnnualRange,
  parseLocalDate,
  weekday,
} from "./dates.js";
import { PriceEngineError, invariant } from "./errors.js";

export const ENGINE_VERSION = "0.1.0";
const KNOWN_EVENT_STATUSES = new Set(["calculated", "tentative", "confirmed", "cancelled", "stale"]);

function money(value, decimals) {
  return toDecimalString(value, decimals);
}

function traceMoney(value) {
  return toExactDecimalString(value, 2);
}

export function compileCalendarSnapshot(calendar) {
  if (calendar === undefined || calendar === null) {
    return deepFreeze({ id: "none", events: [] });
  }
  invariant(calendar && typeof calendar === "object" && !Array.isArray(calendar), "INVALID_CALENDAR", "calendarSnapshot must be an object.");
  invariant(typeof calendar.id === "string" && calendar.id.trim() !== "", "INVALID_CALENDAR", "calendarSnapshot.id is required.");
  invariant(Array.isArray(calendar.events), "INVALID_CALENDAR", "calendarSnapshot.events must be an array.");
  invariant(calendar.events.length <= 10_000, "INVALID_CALENDAR", "calendarSnapshot cannot contain more than 10,000 event facts.");
  if (calendar.coverage !== undefined) {
    invariant(calendar.coverage && typeof calendar.coverage === "object" && !Array.isArray(calendar.coverage), "INVALID_CALENDAR", "calendarSnapshot.coverage must be an object.");
    parseLocalDate(calendar.coverage.from, "calendarSnapshot.coverage.from");
    parseLocalDate(calendar.coverage.through, "calendarSnapshot.coverage.through");
    invariant(calendar.coverage.from <= calendar.coverage.through, "INVALID_CALENDAR", "calendarSnapshot.coverage.from must not be after through.");
    invariant(Array.isArray(calendar.coverage.resolvedKeys), "INVALID_CALENDAR", "calendarSnapshot.coverage.resolvedKeys must be an array.");
    invariant(calendar.coverage.resolvedKeys.every((key) => typeof key === "string" && key.trim() !== ""), "INVALID_CALENDAR", "calendarSnapshot.coverage.resolvedKeys must contain non-empty strings.");
    invariant(new Set(calendar.coverage.resolvedKeys).size === calendar.coverage.resolvedKeys.length, "INVALID_CALENDAR", "calendarSnapshot.coverage.resolvedKeys must not contain duplicates.");
  }
  if (calendar.expiresAt !== undefined) {
    invariant(typeof calendar.expiresAt === "string" && Number.isFinite(Date.parse(calendar.expiresAt)), "INVALID_CALENDAR", "calendarSnapshot.expiresAt must be an ISO timestamp.");
  }

  const events = calendar.events.map((event, index) => {
    const label = `calendarSnapshot.events[${index}]`;
    invariant(event && typeof event === "object" && !Array.isArray(event), "INVALID_CALENDAR", `${label} must be an object.`);
    invariant(typeof event.key === "string" && event.key.trim() !== "", "INVALID_CALENDAR", `${label}.key is required.`);
    invariant(typeof event.status === "string" && KNOWN_EVENT_STATUSES.has(event.status), "INVALID_CALENDAR", `${label}.status is invalid.`);

    let localStart;
    let localEndExclusive;
    if (event.date !== undefined) {
      parseLocalDate(event.date, `${label}.date`);
      localStart = event.date;
      localEndExclusive = addDays(event.date, 1);
    } else {
      parseLocalDate(event.localStart, `${label}.localStart`);
      parseLocalDate(event.localEndExclusive, `${label}.localEndExclusive`);
      invariant(compareDates(event.localStart, event.localEndExclusive) < 0, "INVALID_CALENDAR", `${label}.localEndExclusive must be after localStart.`);
      localStart = event.localStart;
      localEndExclusive = event.localEndExclusive;
    }

    return {
      ...cloneJson(event, label),
      localStart,
      localEndExclusive,
    };
  });
  events.sort((left, right) => left.key.localeCompare(right.key) || left.localStart.localeCompare(right.localStart) || left.status.localeCompare(right.status));
  return deepFreeze({ ...cloneJson(calendar), events });
}

function conditionEventKeys(condition, keys) {
  const [operator, value] = Object.entries(condition)[0];
  if (operator === "event") keys.add(value.key);
  else if (operator === "all" || operator === "any") value.forEach((child) => conditionEventKeys(child, keys));
  else if (operator === "not") conditionEventKeys(value, keys);
}

export function getRequiredEventKeys(ruleDocument) {
  const ruleSet = compileRuleSet(ruleDocument);
  const keys = new Set();
  ruleSet.rules.forEach((rule) => conditionEventKeys(rule.when, keys));
  return Object.freeze([...keys].sort());
}

function assertCalendarCoverage(ruleSet, calendar, dates) {
  const requiredKeys = getRequiredEventKeys(ruleSet);
  if (requiredKeys.length === 0) return;
  invariant(calendar.id !== "none", "CALENDAR_REQUIRED", "This rule set contains event conditions and requires an immutable calendar snapshot.");
  invariant(calendar.coverage, "CALENDAR_INCOMPLETE", "Calendar snapshot must declare its date coverage and resolved event keys.");
  const missingKeys = requiredKeys.filter((key) => !calendar.coverage.resolvedKeys.includes(key));
  invariant(missingKeys.length === 0, "CALENDAR_INCOMPLETE", "Calendar snapshot has not resolved every event key required by the rule set.", { missingKeys });
  const outsideCoverage = dates.filter((date) => date < calendar.coverage.from || date > calendar.coverage.through);
  invariant(outsideCoverage.length === 0, "CALENDAR_OUT_OF_RANGE", "Requested accommodation dates fall outside the calendar snapshot coverage.", {
    coverage: { from: calendar.coverage.from, through: calendar.coverage.through },
    firstOutsideDate: outsideCoverage[0],
  });
}

function indexEvents(calendar) {
  const index = new Map();
  for (const event of calendar.events) {
    if (!index.has(event.key)) index.set(event.key, []);
    index.get(event.key).push(event);
  }
  return index;
}

function eventMatches(condition, date, eventIndex) {
  if (condition.accepted_status.length === 0) return false;
  return (eventIndex.get(condition.key) ?? []).some((event) => {
    if (event.status === "cancelled" || !condition.accepted_status.includes(event.status)) return false;
    const windowStart = addDays(event.localStart, -condition.days_before);
    const windowEndExclusive = addDays(event.localEndExclusive, condition.days_after);
    return date >= windowStart && date < windowEndExclusive;
  });
}

function conditionMatches(condition, context) {
  const [operator, value] = Object.entries(condition)[0];
  switch (operator) {
    case "all":
      return value.every((child) => conditionMatches(child, context));
    case "any":
      return value.some((child) => conditionMatches(child, context));
    case "not":
      return !conditionMatches(value, context);
    case "date":
      return context.date === value;
    case "date_range":
      return context.date >= value.from && context.date <= value.through;
    case "annually":
      return matchesAnnualRange(context.date, value.from, value.through);
    case "weekday":
      return value.includes(weekday(context.date));
    case "stay_nights":
      if (context.stayNights === null) return false;
      if ("exactly" in value) return context.stayNights === value.exactly;
      return context.stayNights >= value.at_least && (!("fewer_than" in value) || context.stayNights < value.fewer_than);
    case "event":
      return eventMatches(value, context.date, context.eventIndex);
    default:
      throw new PriceEngineError("UNSUPPORTED_CONDITION", `Unsupported condition operator: ${operator}.`);
  }
}

function sortedRules(rules) {
  return [...rules].sort((left, right) => {
    const layer = RULE_LAYERS.indexOf(left.layer) - RULE_LAYERS.indexOf(right.layer);
    return layer || right.priority - left.priority || left.id.localeCompare(right.id);
  });
}

function sameRuleSet(left, right) {
  if (left.length !== right.length) return false;
  const leftIds = left.map((rule) => rule.id).sort();
  const rightIds = right.map((rule) => rule.id).sort();
  return leftIds.every((id, index) => id === rightIds[index]);
}

function selectRules(ruleSet, context, includeStayRules) {
  const matched = ruleSet.rules.filter((rule) => (includeStayRules || rule.layer !== "stay") && conditionMatches(rule.when, context));
  const groups = new Map();
  for (const rule of matched) {
    if (!groups.has(rule.group)) groups.set(rule.group, []);
    groups.get(rule.group).push(rule);
  }

  const selected = [];
  const rejected = [];
  for (const [group, rules] of groups) {
    const ordered = sortedRules(rules);
    if (ordered[0].stacking === "compound") {
      selected.push(...ordered);
      continue;
    }
    const highestPriority = Math.max(...ordered.map((rule) => rule.priority));
    const winners = ordered.filter((rule) => rule.priority === highestPriority);
    if (winners.length > 1) {
      throw new PriceEngineError("AMBIGUOUS_RULE", `Exclusive group ${group} has multiple matching rules at priority ${highestPriority}.`, {
        group,
        priority: highestPriority,
        ruleIds: winners.map((rule) => rule.id).sort(),
        date: context.date,
      });
    }
    selected.push(winners[0]);
    for (const rule of ordered) {
      if (rule !== winners[0]) rejected.push({ id: rule.id, reason: "lower_priority", selected: winners[0].id });
    }
  }

  let active = [...selected];
  for (let pass = 0; pass <= selected.length; pass += 1) {
    const suppressedGroups = new Set(active.flatMap((rule) => rule.suppresses));
    const next = selected.filter((rule) => !suppressedGroups.has(rule.group));
    if (sameRuleSet(active, next)) {
      active = next;
      break;
    }
    active = next;
    if (pass === selected.length) {
      throw new PriceEngineError("SUPPRESSION_NOT_STABLE", "Rule suppression did not converge.", { date: context.date });
    }
  }

  const suppressors = new Map();
  for (const rule of active) {
    for (const group of rule.suppresses) {
      if (!suppressors.has(group)) suppressors.set(group, []);
      suppressors.get(group).push(rule.id);
    }
  }
  const suppressed = selected
    .filter((rule) => !active.includes(rule))
    .map((rule) => ({ id: rule.id, group: rule.group, by: [...(suppressors.get(rule.group) ?? [])].sort() }))
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    matched: sortedRules(matched),
    selected: sortedRules(selected),
    active: sortedRules(active),
    rejected: rejected.sort((left, right) => left.id.localeCompare(right.id)),
    suppressed,
    suppressedGroups: [...suppressors.keys()].sort(),
  };
}

function operation(rule, name, before, after) {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    layer: rule.layer,
    operation: name,
    before: traceMoney(before),
    after: traceMoney(after),
  };
}

function applyLayer(start, rules, layer, decimals) {
  let value = start;
  const trace = [];
  const layerRules = sortedRules(rules.filter((rule) => rule.layer === layer));
  if (layerRules.length === 0) return { value, trace };

  const setters = layerRules.filter((rule) => "set_nightly" in rule.apply);
  if (setters.length > 1) {
    throw new PriceEngineError("AMBIGUOUS_ACTION", `Layer ${layer} selected multiple set_nightly actions.`, { ruleIds: setters.map((rule) => rule.id) });
  }
  if (setters.length === 1) {
    const before = value;
    value = decimal(setters[0].apply.set_nightly);
    trace.push(operation(setters[0], "set_nightly", before, value));
  }

  for (const rule of layerRules) {
    if (!("adjust_nightly_percent" in rule.apply)) continue;
    const before = value;
    value = multiply(value, percentFactor(rule.apply.adjust_nightly_percent));
    trace.push(operation(rule, "adjust_nightly_percent", before, value));
  }
  for (const rule of layerRules) {
    if (!("stay_discount_percent" in rule.apply)) continue;
    const before = value;
    value = multiply(value, percentFactor(rule.apply.stay_discount_percent, "discount"));
    trace.push(operation(rule, "stay_discount_percent", before, value));
  }
  for (const rule of layerRules) {
    if (!("adjust_nightly_amount" in rule.apply)) continue;
    const before = value;
    value = add(value, decimal(rule.apply.adjust_nightly_amount));
    trace.push(operation(rule, "adjust_nightly_amount", before, value));
  }

  const finalSetters = layerRules.filter((rule) => "set_final_nightly" in rule.apply);
  if (finalSetters.length > 1) {
    throw new PriceEngineError("AMBIGUOUS_ACTION", `Layer ${layer} selected multiple set_final_nightly actions.`, { ruleIds: finalSetters.map((rule) => rule.id) });
  }
  if (finalSetters.length === 1) {
    const before = value;
    value = decimal(finalSetters[0].apply.set_final_nightly);
    trace.push(operation(finalSetters[0], "set_final_nightly", before, value));
  }

  const floors = layerRules.filter((rule) => "nightly_floor" in rule.apply);
  const ceilings = layerRules.filter((rule) => "nightly_ceiling" in rule.apply);
  const floor = floors.reduce((current, rule) => current === null ? decimal(rule.apply.nightly_floor) : maximum(current, decimal(rule.apply.nightly_floor)), null);
  const ceiling = ceilings.reduce((current, rule) => current === null ? decimal(rule.apply.nightly_ceiling) : minimum(current, decimal(rule.apply.nightly_ceiling)), null);
  if (floor && ceiling && compare(floor, ceiling) > 0) {
    throw new PriceEngineError("CONFLICTING_GUARDRAIL", `Layer ${layer} produced a floor above its ceiling.`);
  }
  if (floor && compare(value, floor) < 0) {
    const before = value;
    value = floor;
    const source = floors.find((rule) => compare(decimal(rule.apply.nightly_floor), floor) === 0);
    trace.push(operation(source, "nightly_floor", before, value));
  }
  if (ceiling && compare(value, ceiling) > 0) {
    const before = value;
    value = ceiling;
    const source = ceilings.find((rule) => compare(decimal(rule.apply.nightly_ceiling), ceiling) === 0);
    trace.push(operation(source, "nightly_ceiling", before, value));
  }
  return { value, trace, decimals };
}

function getRestrictions(activeRules) {
  let minimumStay = null;
  let maximumStay = null;
  for (const rule of activeRules) {
    if ("minimum_stay" in rule.apply) minimumStay = minimumStay === null ? rule.apply.minimum_stay : Math.max(minimumStay, rule.apply.minimum_stay);
    if ("maximum_stay" in rule.apply) maximumStay = maximumStay === null ? rule.apply.maximum_stay : Math.min(maximumStay, rule.apply.maximum_stay);
  }
  if (minimumStay !== null && maximumStay !== null && minimumStay > maximumStay) {
    throw new PriceEngineError("CONFLICTING_RESTRICTION", "Selected rules produced a minimum stay above the maximum stay.", { minimumStay, maximumStay });
  }
  return { minimumStay, maximumStay };
}

function finalizedAmount(ruleSet, amount) {
  const hardFloor = decimal(ruleSet.guardrails.hard_floor);
  const hardCeiling = decimal(ruleSet.guardrails.hard_ceiling);
  const increment = decimal(ruleSet.guardrails.rounding.increment);
  let value = maximum(hardFloor, minimum(amount, hardCeiling));
  value = roundToIncrement(value, increment, ruleSet.guardrails.rounding.method);
  if (compare(value, hardFloor) < 0) value = ceilToIncrement(hardFloor, increment);
  if (compare(value, hardCeiling) > 0) value = floorToIncrement(hardCeiling, increment);
  return value;
}

function evaluateNight(ruleSet, date, stayNights, calendar, eventIndex, comparisonPrice, includeStayRules) {
  const decimals = ruleSet.listing_context.currency_decimals;
  const baseName = ruleSet.base.weekend_days.includes(weekday(date)) ? "weekend" : "weekday";
  const baseAmount = decimal(ruleSet.base[baseName]);
  const selection = selectRules(ruleSet, { date, stayNights, calendar, eventIndex }, includeStayRules);
  const operations = [];
  let value = baseAmount;
  let beforeStay = value;
  let afterStay = value;

  for (const layer of RULE_LAYERS) {
    if (layer === "stay") beforeStay = value;
    const applied = applyLayer(value, selection.active, layer, decimals);
    value = applied.value;
    operations.push(...applied.trace);
    if (layer === "stay") afterStay = value;
  }

  const unrounded = value;
  const hardFloor = decimal(ruleSet.guardrails.hard_floor);
  const hardCeiling = decimal(ruleSet.guardrails.hard_ceiling);
  const warnings = [];
  if (compare(value, hardFloor) < 0) {
    operations.push({ ruleId: "guardrails", ruleName: "Global guardrails", layer: "guardrails", operation: "hard_floor", before: traceMoney(value), after: traceMoney(hardFloor) });
    warnings.push({ code: "HARD_FLOOR_APPLIED", date, message: `Price was raised to the hard floor of ${money(hardFloor, decimals)}.` });
    value = hardFloor;
  }
  if (compare(value, hardCeiling) > 0) {
    operations.push({ ruleId: "guardrails", ruleName: "Global guardrails", layer: "guardrails", operation: "hard_ceiling", before: traceMoney(value), after: traceMoney(hardCeiling) });
    warnings.push({ code: "HARD_CEILING_APPLIED", date, message: `Price was reduced to the hard ceiling of ${money(hardCeiling, decimals)}.` });
    value = hardCeiling;
  }
  const guarded = value;
  value = finalizedAmount(ruleSet, value);
  const finalAmount = value;
  const preStayFinalAmount = finalizedAmount(ruleSet, beforeStay);

  if (comparisonPrice !== undefined) {
    const previous = decimal(comparisonPrice, `comparisonPrices.${date}`);
    if (compare(previous, ZERO) > 0) {
      const absoluteChange = absolute(subtract(finalAmount, previous));
      const limit = decimal(ruleSet.guardrails.maximum_automatic_change_percent);
      if (compare(multiply(absoluteChange, HUNDRED), multiply(previous, limit)) > 0) {
        const percentage = multiply(absoluteChange, decimal(100));
        const changePercent = toDecimalString({ n: percentage.n * previous.d, d: percentage.d * previous.n }, 2);
        warnings.push({
          code: "AUTOMATIC_CHANGE_LIMIT_EXCEEDED",
          date,
          message: `Absolute change of ${changePercent}% exceeds the ${ruleSet.guardrails.maximum_automatic_change_percent}% automatic threshold.`,
          requiresApproval: true,
        });
      }
    }
  }

  const restrictions = getRestrictions(selection.active);
  const publicResult = {
    date,
    baseType: baseName,
    base: money(baseAmount, decimals),
    matchedRules: selection.matched.map((rule) => rule.id),
    selectedRules: selection.selected.map((rule) => rule.id),
    appliedRules: selection.active.map((rule) => rule.id),
    suppressedRules: selection.suppressed,
    rejectedRules: selection.rejected,
    suppressedGroups: selection.suppressedGroups,
    operations,
    beforeStayAdjustment: traceMoney(beforeStay),
    afterStayAdjustment: traceMoney(afterStay),
    unrounded: traceMoney(unrounded),
    guarded: traceMoney(guarded),
    final: money(finalAmount, decimals),
    restrictions,
    warnings,
  };

  return {
    publicResult,
    finalAmount,
    preStayFinalAmount,
  };
}

function metadata(ruleSet, calendar, hash, calendarHash) {
  return {
    engineVersion: ENGINE_VERSION,
    ruleSet: {
      id: ruleSet.rule_set.id,
      version: ruleSet.rule_set.version,
      hash: hash ?? null,
    },
    calendarSnapshot: calendar.id,
    calendarSnapshotHash: calendarHash ?? null,
    currency: ruleSet.listing_context.currency,
    timezone: ruleSet.listing_context.timezone,
  };
}

function assertEffective(ruleSet, dates) {
  const effective = ruleSet.rule_set.effective_from;
  if (dates.some((date) => date < effective)) {
    throw new PriceEngineError("RULE_SET_NOT_EFFECTIVE", `Rule set is effective for accommodation dates on or after ${effective}.`, { effectiveFrom: effective });
  }
}

function aggregateRestrictions(nights, stayNights = null) {
  const minimumStay = nights.reduce((current, night) => night.restrictions.minimumStay === null ? current : Math.max(current ?? 0, night.restrictions.minimumStay), null);
  const maximumStay = nights.reduce((current, night) => night.restrictions.maximumStay === null ? current : Math.min(current ?? Number.POSITIVE_INFINITY, night.restrictions.maximumStay), null);
  const violations = [];
  if (stayNights !== null && minimumStay !== null && stayNights < minimumStay) {
    violations.push({ code: "MINIMUM_STAY_NOT_MET", message: `This selection requires at least ${minimumStay} nights.`, required: minimumStay, actual: stayNights });
  }
  if (stayNights !== null && maximumStay !== null && stayNights > maximumStay) {
    violations.push({ code: "MAXIMUM_STAY_EXCEEDED", message: `This selection permits at most ${maximumStay} nights.`, required: maximumStay, actual: stayNights });
  }
  return { minimumStay, maximumStay, eligible: violations.length === 0, violations };
}

export function evaluateStay(ruleDocument, input, options = {}) {
  const ruleSet = compileRuleSet(ruleDocument);
  invariant(input && typeof input === "object" && !Array.isArray(input), "INVALID_INPUT", "Stay evaluation input must be an object.");
  parseLocalDate(input.checkIn, "checkIn");
  parseLocalDate(input.checkOut, "checkOut");
  const dates = enumerateDates(input.checkIn, input.checkOut);
  assertEffective(ruleSet, dates);
  const calendar = compileCalendarSnapshot(input.calendarSnapshot);
  assertCalendarCoverage(ruleSet, calendar, dates);
  const eventIndex = indexEvents(calendar);
  const comparisonPrices = input.comparisonPrices ?? {};
  invariant(comparisonPrices && typeof comparisonPrices === "object" && !Array.isArray(comparisonPrices), "INVALID_INPUT", "comparisonPrices must be an object keyed by local date.");

  const evaluated = dates.map((date) => evaluateNight(ruleSet, date, dates.length, calendar, eventIndex, comparisonPrices[date], true));
  const nights = evaluated.map((item) => item.publicResult);
  const total = evaluated.reduce((sum, item) => add(sum, item.finalAmount), ZERO);
  const nightlySubtotal = evaluated.reduce((sum, item) => add(sum, item.preStayFinalAmount), ZERO);
  const stayAdjustment = subtract(total, nightlySubtotal);
  const stayDiscount = evaluated.reduce((sum, item) => {
    const difference = subtract(item.finalAmount, item.preStayFinalAmount);
    return compare(difference, ZERO) < 0 ? add(sum, absolute(difference)) : sum;
  }, ZERO);
  const stayPremium = evaluated.reduce((sum, item) => {
    const difference = subtract(item.finalAmount, item.preStayFinalAmount);
    return compare(difference, ZERO) > 0 ? add(sum, difference) : sum;
  }, ZERO);
  const warnings = nights.flatMap((night) => night.warnings);
  const restrictions = aggregateRestrictions(nights, dates.length);
  const decimals = ruleSet.listing_context.currency_decimals;

  return deepFreeze({
    kind: "stay",
    ...metadata(ruleSet, calendar, options.ruleSetHash, options.calendarSnapshotHash),
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    stayNights: dates.length,
    nights,
    nightlySubtotal: money(nightlySubtotal, decimals),
    stayAdjustment: money(stayAdjustment, decimals),
    stayDiscount: money(stayDiscount, decimals),
    stayPremium: money(stayPremium, decimals),
    totalBeforeFeesAndTax: money(total, decimals),
    restrictions,
    requiresApproval: warnings.some((warning) => warning.requiresApproval === true),
    warnings,
  });
}

export function evaluateCalendar(ruleDocument, input, options = {}) {
  const ruleSet = compileRuleSet(ruleDocument);
  invariant(input && typeof input === "object" && !Array.isArray(input), "INVALID_INPUT", "Calendar evaluation input must be an object.");
  parseLocalDate(input.from, "from");
  parseLocalDate(input.through, "through");
  const untilExclusive = addDays(input.through, 1);
  const dates = enumerateDates(input.from, untilExclusive);
  assertEffective(ruleSet, dates);
  const assumedStayNights = input.assumedStayNights ?? null;
  if (assumedStayNights !== null) invariant(Number.isInteger(assumedStayNights) && assumedStayNights >= 1 && assumedStayNights <= 3660, "INVALID_INPUT", "assumedStayNights must be an integer from 1 through 3660.");
  const calendar = compileCalendarSnapshot(input.calendarSnapshot);
  assertCalendarCoverage(ruleSet, calendar, dates);
  const eventIndex = indexEvents(calendar);
  const comparisonPrices = input.comparisonPrices ?? {};
  invariant(comparisonPrices && typeof comparisonPrices === "object" && !Array.isArray(comparisonPrices), "INVALID_INPUT", "comparisonPrices must be an object keyed by local date.");

  const evaluated = dates.map((date) => evaluateNight(ruleSet, date, assumedStayNights, calendar, eventIndex, comparisonPrices[date], assumedStayNights !== null));
  const results = evaluated.map((item) => item.publicResult);
  const warnings = results.flatMap((day) => day.warnings);
  return deepFreeze({
    kind: "calendar",
    ...metadata(ruleSet, calendar, options.ruleSetHash, options.calendarSnapshotHash),
    from: input.from,
    through: input.through,
    previewOnly: assumedStayNights !== null,
    assumedStayNights,
    dates: results,
    warnings,
  });
}

export function createPriceEngine(ruleDocument, options = {}) {
  const ruleSet = compileRuleSet(ruleDocument);
  const ruleSetHash = options.ruleSetHash;
  const calendarSnapshotHash = options.calendarSnapshotHash;
  return Object.freeze({
    ruleSet,
    evaluateStay: (input) => evaluateStay(ruleSet, input, { ruleSetHash, calendarSnapshotHash }),
    evaluateCalendar: (input) => evaluateCalendar(ruleSet, input, { ruleSetHash, calendarSnapshotHash }),
  });
}
