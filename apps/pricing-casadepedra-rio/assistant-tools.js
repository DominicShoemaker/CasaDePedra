const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const RULE_CHANGE_KEYS = Object.freeze(["name", "layer", "group", "priority", "stacking", "when", "apply", "suppresses"]);
const CALENDAR_EVENT_CHANGE_KEYS = Object.freeze(["date", "localStart", "localEndExclusive", "status"]);

function clone(value) {
  return structuredClone(value);
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

function assertOnlyKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new TypeError(`${label}.${key} is not an allowed assistant edit.`);
  }
}

function assertDecimal(value, label) {
  if (typeof value !== "string" || !DECIMAL_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a quoted decimal string.`);
  }
}

function compactJson(value) {
  return JSON.stringify(value);
}

function compactRule(rule) {
  return `${rule.id} | ${rule.name} | ${rule.layer}/${rule.group} ordering-priority ${rule.priority} ${rule.stacking} | when ${compactJson(rule.when)} | apply ${compactJson(rule.apply)} | suppresses ${compactJson(rule.suppresses ?? [])}`;
}

function shortStayFact(rules) {
  const oneNight = rules.find(rule => rule.when?.stay_nights?.exactly === 1)?.apply?.adjust_nightly_percent;
  const twoNights = rules.find(rule => rule.when?.stay_nights?.exactly === 2)?.apply?.adjust_nightly_percent;
  if (oneNight === undefined && twoNights === undefined) return null;
  return `Derived short-stay facts: one night is ${oneNight ?? "not configured"}% above the applicable nightly base; two nights are ${twoNights ?? "not configured"}% above it; three through six nights use the unadjusted applicable nightly base unless another rule applies.`;
}

function selectRelevantRules(rules, instruction) {
  const normalized = String(instruction ?? "").toLowerCase();
  const tokens = [...new Set(normalized.match(/[a-z0-9]+/g) ?? [])]
    .filter(token => token.length >= 3 && !["the", "and", "for", "current", "explain", "propose", "change", "price", "prices", "rule", "rules"].includes(token));
  const aliases = [];
  if (/one[- ]night|two[- ]night|short stay|premium/.test(normalized)) aliases.push("stay_nights");
  if (/week|month|long stay|discount/.test(normalized)) aliases.push("stay_discount_percent");
  if (/new year|nye/.test(normalized)) aliases.push("new-year");
  if (/carnival|carnaval/.test(normalized)) aliases.push("carnival");
  if (/base|weekday|weekend/.test(normalized)) aliases.push("base");
  const terms = [...tokens, ...aliases];
  const scored = rules.map(rule => {
    const text = compactRule(rule).toLowerCase();
    return { rule, score: terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0) };
  });
  const selected = scored.filter(item => item.score > 0).sort((left, right) => right.score - left.score).slice(0, 8).map(item => item.rule);
  return selected.length ? selected : rules.slice(0, 5);
}

export function createAssistantContext(ruleDocument, calendarDocument, instruction = "") {
  assertObject(ruleDocument, "Price rules");
  assertObject(calendarDocument, "Calendar description");
  const selectedRules = selectRelevantRules(ruleDocument.rules, instruction);
  const selectedRuleJson = compactJson(selectedRules);
  const referencedEventKeys = new Set((calendarDocument.coverage?.resolvedKeys ?? []).filter(key => selectedRuleJson.includes(key)));
  const events = (calendarDocument.events ?? []).filter(event => referencedEventKeys.has(event.key)).slice(0, 12).map(event => {
    const dates = event.date ?? `${event.localStart}..${event.localEndExclusive} (end exclusive)`;
    return `${event.key}: ${dates}, ${event.status}`;
  });

  const facts = shortStayFact(ruleDocument.rules);
  return [
    `Rule set: ${ruleDocument.rule_set.id}, version ${ruleDocument.rule_set.version}, effective ${ruleDocument.rule_set.effective_from}.`,
    `Listing: ${ruleDocument.listing_context.currency}, ${ruleDocument.listing_context.timezone}.`,
    `Base: weekday ${ruleDocument.base.weekday}; weekend ${ruleDocument.base.weekend} on ${ruleDocument.base.weekend_days.join(", ")}.`,
    `Guardrails: floor ${ruleDocument.guardrails.hard_floor}; ceiling ${ruleDocument.guardrails.hard_ceiling}; maximum automatic change ${ruleDocument.guardrails.maximum_automatic_change_percent}%; rounding ${ruleDocument.guardrails.rounding.method} ${ruleDocument.guardrails.rounding.increment}.`,
    "Semantics: ordering-priority only chooses rule precedence; it is never a price or percentage. adjust_nightly_percent is a percentage adjustment to the applicable nightly rate.",
    ...(facts ? [facts] : []),
    `Relevant rules (${selectedRules.length} of ${ruleDocument.rules.length}):`,
    ...selectedRules.map(compactRule),
    `All rule IDs: ${ruleDocument.rules.map(rule => rule.id).join(", ")}.`,
    `Calendar: ${calendarDocument.id}; ${calendarDocument.coverage?.from} through ${calendarDocument.coverage?.through}; expires ${calendarDocument.expiresAt}.`,
    events.length ? "Relevant calendar events:" : "No calendar event dates are needed for the selected rules.",
    ...events,
  ].join("\n");
}

export function isRuleChangeRequest(instruction) {
  return /\b(propose|draft|change|set|increase|decrease|adjust|update|add|remove|replace|raise|lower)\b/i.test(String(instruction ?? ""));
}

export function createDeterministicAnswer(ruleDocument, instruction) {
  const normalized = String(instruction ?? "").toLowerCase();
  const numberWords = Object.freeze({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 });
  const comparedNights = [...normalized.matchAll(/\b(\d+|one|two|three|four|five|six|seven)[- ]?(?:day|night)s?\b/g)]
    .map(match => numberWords[match[1]] ?? Number(match[1]))
    .filter((value, index, values) => Number.isInteger(value) && value > 0 && values.indexOf(value) === index);
  const eventDefinitions = [
    { label: "New Year", matches: /new year|new year's|nye/, ruleMatches: /new.year/ },
    { label: "Christmas", matches: /christmas|xmas/, ruleMatches: /christmas/ },
    { label: "Carnival", matches: /carnival|carnaval/, ruleMatches: /carnival/ },
    { label: "Rock in Rio", matches: /rock in rio/, ruleMatches: /rock.in.rio/ },
  ];
  const eventDefinition = eventDefinitions.find(definition => definition.matches.test(normalized));
  if (eventDefinition && comparedNights.length >= 2 && /difference|compare|versus|\bvs\b/.test(normalized)) {
    const eventRules = ruleDocument.rules.filter(rule => eventDefinition.ruleMatches.test(`${rule.id} ${rule.name}`.toLowerCase()));
    const minimumStay = Math.max(0, ...eventRules.map(rule => Number(rule.apply?.minimum_stay ?? 0)));
    const ineligible = comparedNights.filter(nights => nights < minimumStay).sort((left, right) => left - right);
    if (ineligible.length === comparedNights.length && minimumStay > 0) {
      const compared = [...comparedNights].sort((left, right) => left - right).map(nights => `${nights}-night`).join(" nor a ");
      return `There is no valid price difference: Casa de Pedra's ${eventDefinition.label} window requires at least ${minimumStay} nights, so neither a ${compared} reservation is eligible. Reservation length is measured in nights; select an eligible date range of ${minimumStay} nights or more to calculate its exact accommodation subtotal.`;
    }
    if (ineligible.length > 0) {
      return `The requested ${eventDefinition.label} stays are not directly comparable because ${ineligible.map(nights => `${nights} nights`).join(" and ")} is below the ${minimumStay}-night minimum. Provide an eligible stay length and the exact check-in date to calculate the accommodation subtotal.`;
    }
    return `An exact ${eventDefinition.label} price difference requires the year and check-in date because the included weekdays, weekends, and event nights can differ. Both requested stay lengths satisfy the ${minimumStay}-night minimum; select the exact date ranges in the calendar for deterministic subtotals.`;
  }
  if (/one[- ]night|two[- ]night|short[- ]stay|short stay/.test(normalized)) {
    const oneNight = ruleDocument.rules.find(rule => rule.when?.stay_nights?.exactly === 1)?.apply?.adjust_nightly_percent;
    const twoNights = ruleDocument.rules.find(rule => rule.when?.stay_nights?.exactly === 2)?.apply?.adjust_nightly_percent;
    if (oneNight !== undefined || twoNights !== undefined) {
      return `The one-night nightly rate is ${oneNight ?? "not configured"}% above the applicable base rate, and the two-night nightly rate is ${twoNights ?? "not configured"}% above it. Three-to-six-night stays use the applicable base nightly rate unless a seasonal, event, or other rule also applies.`;
    }
  }
  if (/base price|base rate|weekday base|weekend base/.test(normalized)) {
    return `The current base nightly rates are ${ruleDocument.listing_context.currency} ${ruleDocument.base.weekday} on ordinary weekdays and ${ruleDocument.listing_context.currency} ${ruleDocument.base.weekend} on ${ruleDocument.base.weekend_days.join(" and ")}. Seasonal, event, length-of-stay, and guardrail rules may change the final nightly price.`;
  }
  if (/floor|ceiling|guardrail/.test(normalized)) {
    return `The hard price floor is ${ruleDocument.listing_context.currency} ${ruleDocument.guardrails.hard_floor}, and the hard ceiling is ${ruleDocument.listing_context.currency} ${ruleDocument.guardrails.hard_ceiling}. These values are read directly from the loaded rule document.`;
  }
  return null;
}

export function createDeterministicProposal(ruleDocument, instruction) {
  const source = String(instruction ?? "");
  const weekday = source.match(/weekday\s+(?:base\s+)?(?:price\s+)?(?:to|at|=)\s*\$?([0-9]+(?:\.[0-9]{1,2})?)/i)?.[1];
  const weekend = source.match(/weekend\s+(?:base\s+)?(?:price\s+)?(?:to|at|=)\s*\$?([0-9]+(?:\.[0-9]{1,2})?)/i)?.[1];
  if (!weekday && !weekend) return null;
  const operation = { type: "set_base" };
  if (weekday) operation.weekday = Number(weekday).toFixed(2);
  if (weekend) operation.weekend = Number(weekend).toFixed(2);
  const values = [weekday ? `weekday ${ruleDocument.listing_context.currency} ${operation.weekday}` : null, weekend ? `weekend ${ruleDocument.listing_context.currency} ${operation.weekend}` : null].filter(Boolean).join(" and ");
  return Object.freeze({
    answer: `I prepared a local draft setting the ${values}. Deterministic two-year validation and your approval are still required.`,
    proposal: Object.freeze({
      summary: `Set the ${values}.`,
      ruleOperations: Object.freeze([Object.freeze(operation)]),
      calendarOperations: Object.freeze([]),
    }),
  });
}

export function createAssistantSystemPrompt(ruleDocument, calendarDocument, instruction = "", proposalMode = false) {
  const context = createAssistantContext(ruleDocument, calendarDocument, instruction);
  const outputContract = proposalMode
    ? `The user explicitly requested an edit. Call the propose_pricing_changes function exactly once with a short answer, summary, rule_operations, and calendar_operations. Use an empty array for the document that is unchanged.

Allowed rule_operations:
1. {"type":"set_base","weekday":"380.00","weekend":"420.00"}; weekday or weekend may be omitted.
2. {"type":"update_rule","rule_id":"existing-id","changes":{"name":"optional","priority":100,"when":{...},"apply":{...},"suppresses":[...]}}. Only include changed fields. In apply, a null value removes that action.
3. {"type":"add_rule","rule":{complete pmc.price-rules/v1 rule}}.
4. {"type":"remove_rule","rule_id":"existing-id"} only when explicitly requested.

Allowed calendar_operations:
1. {"type":"update_event","selector":{"key":"event-key","date":"YYYY-MM-DD"},"changes":{"date":"YYYY-MM-DD","status":"confirmed"}}. For ranged events use localStart in the selector and localStart/localEndExclusive in changes.
2. {"type":"add_event","event":{complete calendar event}}.
3. {"type":"remove_event","selector":{"key":"event-key","date":"YYYY-MM-DD"}}.
4. {"type":"set_calendar_metadata","changes":{"notice":"...","expiresAt":"ISO timestamp","coverage":{...}}}.

Money and percentages must remain strings. Never propose currency, timezone, jurisdiction, guardrail, rule-set ID, or effective-date changes. If the user gives one price for a named event, update every matching event rule unless the user narrows it to prime, shoulder, or another specific sub-rule, and list affected rule IDs in the summary. A proposal is only a local draft: say that deterministic validation and human approval are still required. If the request is ambiguous, return empty operation arrays and explain what is missing.`
    : "Answer the question in at most four short sentences of plain text. Do not return JSON and do not propose an edit.";
  return `You are the private, in-browser Casa de Pedra pricing assistant. Answer in concise English using only the supplied pricing context. Never invent a price, event date, marketplace capability, or production status. Explain that checkout excludes its date and that USD accommodation subtotal excludes fees and taxes when relevant.

${outputContract}

CURRENT SANITIZED CONTEXT
${context}`;
}

export function parseAssistantResponse(rawResponse) {
  const raw = String(rawResponse ?? "").trim();
  const withoutFence = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed;
  try {
    parsed = JSON.parse(withoutFence);
  } catch {
    return Object.freeze({ answer: raw || "The AI model returned an empty response.", proposal: null });
  }
  assertObject(parsed, "Assistant response");
  if (typeof parsed.answer !== "string" || parsed.answer.trim() === "") {
    throw new TypeError("The assistant response must include an answer.");
  }
  if (parsed.proposal === null || parsed.proposal === undefined) {
    return Object.freeze({ answer: parsed.answer.trim(), proposal: null });
  }
  assertObject(parsed.proposal, "Assistant proposal");
  if (typeof parsed.proposal.summary !== "string" || parsed.proposal.summary.trim() === "") {
    throw new TypeError("The assistant proposal must include a summary.");
  }
  const ruleOperations = parsed.proposal.rule_operations ?? parsed.proposal.operations ?? [];
  const calendarOperations = parsed.proposal.calendar_operations ?? [];
  if (!Array.isArray(ruleOperations) || !Array.isArray(calendarOperations)) throw new TypeError("Assistant proposal operations must be arrays.");
  if (ruleOperations.length + calendarOperations.length === 0) return Object.freeze({ answer: parsed.answer.trim(), proposal: null });
  if (ruleOperations.length + calendarOperations.length > 20) throw new TypeError("The assistant proposal must contain no more than 20 operations.");
  return Object.freeze({
    answer: parsed.answer.trim(),
    proposal: Object.freeze({
      summary: parsed.proposal.summary.trim(),
      ruleOperations: Object.freeze(clone(ruleOperations)),
      calendarOperations: Object.freeze(clone(calendarOperations)),
    }),
  });
}

function applyBaseOperation(candidate, operation) {
  assertOnlyKeys(operation, ["type", "weekday", "weekend"], "set_base");
  if (!("weekday" in operation) && !("weekend" in operation)) {
    throw new TypeError("set_base must include weekday or weekend.");
  }
  for (const field of ["weekday", "weekend"]) {
    if (!(field in operation)) continue;
    assertDecimal(operation[field], `set_base.${field}`);
    candidate.base[field] = operation[field];
  }
}

function applyUpdateRuleOperation(candidate, operation) {
  assertOnlyKeys(operation, ["type", "rule_id", "changes"], "update_rule");
  if (typeof operation.rule_id !== "string" || operation.rule_id === "") throw new TypeError("update_rule.rule_id is required.");
  assertObject(operation.changes, "update_rule.changes");
  assertOnlyKeys(operation.changes, RULE_CHANGE_KEYS, "update_rule.changes");
  const rule = candidate.rules.find(item => item.id === operation.rule_id);
  if (!rule) throw new TypeError(`Rule ${operation.rule_id} does not exist.`);

  for (const [key, value] of Object.entries(operation.changes)) {
    if (key === "apply") {
      assertObject(value, `update_rule ${operation.rule_id} apply`);
      for (const [action, actionValue] of Object.entries(value)) {
        if (actionValue === null) delete rule.apply[action];
        else rule.apply[action] = clone(actionValue);
      }
    } else {
      rule[key] = clone(value);
    }
  }
}

function applyAddRuleOperation(candidate, operation) {
  assertOnlyKeys(operation, ["type", "rule"], "add_rule");
  assertObject(operation.rule, "add_rule.rule");
  if (typeof operation.rule.id !== "string" || operation.rule.id === "") throw new TypeError("add_rule.rule.id is required.");
  if (candidate.rules.some(rule => rule.id === operation.rule.id)) throw new TypeError(`Rule ${operation.rule.id} already exists.`);
  candidate.rules.push(clone(operation.rule));
}

function applyRemoveRuleOperation(candidate, operation) {
  assertOnlyKeys(operation, ["type", "rule_id"], "remove_rule");
  if (typeof operation.rule_id !== "string" || operation.rule_id === "") throw new TypeError("remove_rule.rule_id is required.");
  const index = candidate.rules.findIndex(rule => rule.id === operation.rule_id);
  if (index < 0) throw new TypeError(`Rule ${operation.rule_id} does not exist.`);
  candidate.rules.splice(index, 1);
}

export function applyRuleOperations(ruleDocument, operations) {
  assertObject(ruleDocument, "Price rules");
  if (!Array.isArray(operations) || operations.length === 0 || operations.length > 20) {
    throw new TypeError("Rule operations must contain between 1 and 20 entries.");
  }
  const candidate = clone(ruleDocument);
  for (const [index, operation] of operations.entries()) {
    assertObject(operation, `Operation ${index + 1}`);
    if (operation.type === "set_base") applyBaseOperation(candidate, operation);
    else if (operation.type === "update_rule") applyUpdateRuleOperation(candidate, operation);
    else if (operation.type === "add_rule") applyAddRuleOperation(candidate, operation);
    else if (operation.type === "remove_rule") applyRemoveRuleOperation(candidate, operation);
    else throw new TypeError(`Operation ${index + 1} uses unsupported type ${operation.type}.`);
  }
  candidate.rule_set.version += 1;
  return candidate;
}

function calendarEventMatches(event, selector) {
  return Object.entries(selector).every(([key, value]) => event[key] === value);
}

export function applyCalendarOperations(calendarDocument, operations) {
  assertObject(calendarDocument, "Calendar description");
  if (!Array.isArray(operations) || operations.length === 0 || operations.length > 20) {
    throw new TypeError("Calendar operations must contain between 1 and 20 entries.");
  }
  const candidate = clone(calendarDocument);
  for (const [index, operation] of operations.entries()) {
    assertObject(operation, `Calendar operation ${index + 1}`);
    if (operation.type === "set_calendar_metadata") {
      assertOnlyKeys(operation, ["type", "changes"], "set_calendar_metadata");
      assertObject(operation.changes, "set_calendar_metadata.changes");
      assertOnlyKeys(operation.changes, ["notice", "expiresAt", "coverage"], "set_calendar_metadata.changes");
      Object.assign(candidate, clone(operation.changes));
      continue;
    }
    if (operation.type === "add_event") {
      assertOnlyKeys(operation, ["type", "event"], "add_event");
      assertObject(operation.event, "add_event.event");
      candidate.events.push(clone(operation.event));
      continue;
    }
    if (!["update_event", "remove_event"].includes(operation.type)) {
      throw new TypeError(`Calendar operation ${index + 1} uses unsupported type ${operation.type}.`);
    }
    assertOnlyKeys(operation, operation.type === "update_event" ? ["type", "selector", "changes"] : ["type", "selector"], operation.type);
    assertObject(operation.selector, `${operation.type}.selector`);
    assertOnlyKeys(operation.selector, ["key", "date", "localStart", "localEndExclusive"], `${operation.type}.selector`);
    if (Object.keys(operation.selector).length === 0) throw new TypeError(`${operation.type}.selector cannot be empty.`);
    const matches = candidate.events.map((event, eventIndex) => ({ event, eventIndex })).filter(item => calendarEventMatches(item.event, operation.selector));
    if (matches.length !== 1) throw new TypeError(`${operation.type}.selector must match exactly one event; matched ${matches.length}.`);
    const eventIndex = matches[0].eventIndex;
    if (operation.type === "remove_event") {
      candidate.events.splice(eventIndex, 1);
    } else {
      assertObject(operation.changes, "update_event.changes");
      assertOnlyKeys(operation.changes, CALENDAR_EVENT_CHANGE_KEYS, "update_event.changes");
      Object.assign(candidate.events[eventIndex], clone(operation.changes));
    }
  }
  return candidate;
}

export function comparePricingModels(currentModel, candidateModel) {
  const samples = [];
  const changedDates = new Set();
  let changedValues = 0;
  let largestIncrease = null;
  let largestDecrease = null;

  for (const candidateSeries of candidateModel.series) {
    const currentSeries = currentModel.series.find(series => series.nights === candidateSeries.nights);
    for (let index = 0; index < candidateSeries.values.length; index += 1) {
      const before = Number(currentSeries.values[index].price);
      const after = Number(candidateSeries.values[index].price);
      if (before === after) continue;
      const date = candidateSeries.values[index].date;
      const delta = after - before;
      const change = Object.freeze({ date, nights: candidateSeries.nights, before, after, delta });
      changedValues += 1;
      changedDates.add(date);
      if (delta > 0 && (!largestIncrease || delta > largestIncrease.delta)) largestIncrease = change;
      if (delta < 0 && (!largestDecrease || delta < largestDecrease.delta)) largestDecrease = change;
      if (samples.length < 8) samples.push(change);
    }
  }

  return Object.freeze({
    changedDates: changedDates.size,
    changedValues,
    largestIncrease,
    largestDecrease,
    samples: Object.freeze(samples),
  });
}
