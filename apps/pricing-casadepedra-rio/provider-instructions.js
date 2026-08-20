const OFFICIAL_GUIDES = Object.freeze({
  airbnb: Object.freeze([
    Object.freeze({ label: "Base and custom prices", url: "https://www.airbnb.com/help/article/474" }),
    Object.freeze({ label: "Weekend pricing", url: "https://www.airbnb.com/help/article/512" }),
    Object.freeze({ label: "Rule-sets", url: "https://www.airbnb.com/help/article/2061" }),
  ]),
  vrbo: Object.freeze([
    Object.freeze({ label: "Rates and discounts", url: "https://help.vrbo.com/articles/How-do-I-manage-my-rates" }),
  ]),
  booking: Object.freeze([
    Object.freeze({ label: "Length-of-stay pricing", url: "https://developers.booking.com/connectivity/docs/csv-los_pricing" }),
  ]),
});

const WEEKDAYS = Object.freeze(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);

function decimal(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function percent(value) {
  return `${Number(value.toFixed(4)).toString()}%`;
}

function money(value, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function weekday(localDate) {
  return WEEKDAYS[new Date(`${localDate}T00:00:00Z`).getUTCDay()];
}

function roundedPrice(ruleDocument, value) {
  const floor = decimal(ruleDocument.guardrails?.hard_floor, Number.NEGATIVE_INFINITY);
  const ceiling = decimal(ruleDocument.guardrails?.hard_ceiling, Number.POSITIVE_INFINITY);
  const increment = decimal(ruleDocument.guardrails?.rounding?.increment, 0.01);
  const clamped = Math.min(ceiling, Math.max(floor, value));
  return (Math.round((clamped + Number.EPSILON) / increment) * increment).toFixed(2);
}

function defaultPrice(ruleDocument, priceType, multiplier = 1) {
  return roundedPrice(ruleDocument, decimal(ruleDocument.base[priceType]) * multiplier);
}

function defaultNightly(ruleDocument, date, multiplier = 1) {
  const weekendDays = new Set(ruleDocument.base.weekend_days ?? []);
  return defaultPrice(ruleDocument, weekendDays.has(weekday(date)) ? "weekend" : "weekday", multiplier);
}

function addDay(localDate) {
  const date = new Date(`${localDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function rule(ruleDocument, id) {
  return ruleDocument.rules.find(candidate => candidate.id === id) ?? null;
}

function actionPercent(ruleDocument, id, action) {
  return decimal(rule(ruleDocument, id)?.apply?.[action]);
}

function compressSchedule(model, valueForDate, profileForDate, includeDate = () => true) {
  const rows = [];
  for (const date of model.dates) {
    if (!includeDate(date)) continue;
    const candidate = {
      from: date,
      through: date,
      nightly: valueForDate(date),
      minimumStay: model.getMinimumStayForDate(date) ?? 1,
      profile: profileForDate(date),
    };
    const previous = rows.at(-1);
    if (previous
      && addDay(previous.through) === date
      && previous.nightly === candidate.nightly
      && previous.minimumStay === candidate.minimumStay
      && previous.profile === candidate.profile) {
      previous.through = date;
    } else {
      rows.push(candidate);
    }
  }
  return Object.freeze(rows.map(row => Object.freeze(row)));
}

function airbnbDiscounts(ruleDocument) {
  const oneNightPremium = actionPercent(ruleDocument, "one-night-premium", "adjust_nightly_percent");
  const twoNightPremium = actionPercent(ruleDocument, "two-night-premium", "adjust_nightly_percent");
  const weeklyDiscount = actionPercent(ruleDocument, "weekly-stay", "stay_discount_percent");
  const twoWeekDiscount = actionPercent(ruleDocument, "two-week-stay", "stay_discount_percent");
  const monthlyDiscount = actionPercent(ruleDocument, "monthly-stay", "stay_discount_percent");
  const anchor = 1 + oneNightPremium / 100;
  const inverted = targetMultiplier => 100 * (1 - targetMultiplier / anchor);
  return Object.freeze({
    oneNightPremium,
    twoNight: inverted(1 + twoNightPremium / 100),
    threeToSix: inverted(1),
    weekly: inverted(1 - weeklyDiscount / 100),
    twoWeek: inverted(1 - twoWeekDiscount / 100),
    monthly: inverted(1 - monthlyDiscount / 100),
  });
}

function commonMetadata(ruleDocument, calendarDocument, model) {
  return Object.freeze({
    ruleSet: `${ruleDocument.rule_set.id} v${ruleDocument.rule_set.version}`,
    calendar: calendarDocument.id,
    currency: model.currency,
    from: model.coverage.from,
    through: model.coverage.through,
  });
}

function airbnbPlan(ruleDocument, calendarDocument, model) {
  const discounts = airbnbDiscounts(ruleDocument);
  const anchor = 1 + discounts.oneNightPremium / 100;
  const weekdayAnchor = defaultPrice(ruleDocument, "weekday", anchor);
  const weekendAnchor = defaultPrice(ruleDocument, "weekend", anchor);
  const fallbackForDate = date => defaultNightly(ruleDocument, date, anchor);
  const isDefaultDate = date => model.getPriceForDate(date, 1) === fallbackForDate(date)
    && model.getPriceForDate(date, 1) !== model.getPriceForDate(date, 3)
    && (model.getMinimumStayForDate(date) ?? 1) === 1;
  const schedule = compressSchedule(
    model,
    date => model.getPriceForDate(date, 1),
    date => model.getPriceForDate(date, 1) === model.getPriceForDate(date, 3) ? "Event — no LOS discount" : "Standard inverted LOS",
    date => !isDefaultDate(date),
  );
  const defaultDates = model.dates.filter(isDefaultDate).length;
  return Object.freeze({
    id: "airbnb",
    label: "Airbnb",
    status: "Set defaults once, then enter exceptions only",
    summary: `Airbnb has length-of-stay discounts but no positive short-stay premium. The one-night anchor is configured once as Base and Custom weekend prices; ${defaultDates} ordinary dates then need no price entry.`,
    guides: OFFICIAL_GUIDES.airbnb,
    metadata: commonMetadata(ruleDocument, calendarDocument, model),
    defaults: Object.freeze([
      Object.freeze({ label: "Base price", value: money(weekdayAnchor, model.currency), detail: "Sunday–Thursday one-night anchor" }),
      Object.freeze({ label: "Custom weekend price", value: money(weekendAnchor, model.currency), detail: "Friday and Saturday; set before custom dates" }),
      Object.freeze({ label: "Default minimum stay", value: "1 night", detail: "Exceptions are listed below" }),
      Object.freeze({ label: "Calendar dates needing no price entry", value: defaultDates.toLocaleString("en-US"), detail: "Covered by Base or weekend price" }),
    ]),
    steps: Object.freeze([
      "On desktop, enable Professional hosting tools and open the listing Multi-calendar.",
      "Turn Smart Pricing off. Remove early-bird, last-minute, weekly, monthly, custom, and other promotions not represented in the applied rule document.",
      `Before editing calendar dates, set Base price to ${money(weekdayAnchor, model.currency)} and Custom weekend price to ${money(weekendAnchor, model.currency)}. Airbnb treats Friday and Saturday as weekend nights; setting the weekend price later can overwrite custom Friday/Saturday prices.`,
      `Create a rule-set named “PMC Standard LOS v${ruleDocument.rule_set.version}”. Enter these trip-length discounts: 2 nights ${percent(discounts.twoNight)}; 3, 4, 5, and 6 nights ${percent(discounts.threeToSix)} each; 1 week ${percent(discounts.weekly)}; 2 and 3 weeks ${percent(discounts.twoWeek)} each; 4 through 12 weeks ${percent(discounts.monthly)} each.`,
      `Select the full ${model.coverage.from} through ${model.coverage.through} horizon once and apply the PMC Standard LOS rule-set. Do not enter prices for ordinary dates covered by Base and Custom weekend prices.`,
      "For each Standard inverted LOS exception below, set the listed custom nightly price while keeping the PMC Standard LOS rule-set.",
      "For each Event — no LOS discount row, set the listed nightly price and apply a separate rule-set with no trip-length discounts.",
      "Change minimum stay only where the exception schedule lists more than 1 night. Do not add a short-stay cleaning fee to imitate the premium because the parity target excludes fees.",
      "Test at least one 1-, 2-, 3-, 7-, 14-, and 28-night stay before publishing. If Airbnb accepts only whole-number discounts, exact parity is impossible; use the closest accepted percentage and record the variance.",
    ]),
    warnings: Object.freeze([
      "A stay crossing Standard and Event profiles may not exactly reproduce the engine because Airbnb applies its own rule-set combination logic.",
      "Guest totals will differ after Airbnb service fees, cleaning fees, taxes, currency conversion, or marketplace promotions.",
    ]),
    scheduleTitle: "Exception-only calendar schedule",
    scheduleNote: `${defaultDates} ordinary dates are intentionally omitted because Base and Custom weekend prices cover them. Enter only the rows below, in order; the end date is inclusive.`,
    omittedDates: defaultDates,
    schedule,
  });
}

function vrboPlan(ruleDocument, calendarDocument, model) {
  const weekly = actionPercent(ruleDocument, "weekly-stay", "stay_discount_percent");
  const monthly = actionPercent(ruleDocument, "monthly-stay", "stay_discount_percent");
  const weekdayBase = defaultPrice(ruleDocument, "weekday");
  const weekendBase = defaultPrice(ruleDocument, "weekend");
  const fallbackForDate = date => defaultNightly(ruleDocument, date);
  const isDefaultDate = date => model.getPriceForDate(date, 3) === fallbackForDate(date)
    && (model.getMinimumStayForDate(date) ?? 1) === 1;
  const schedule = compressSchedule(
    model,
    date => model.getPriceForDate(date, 3),
    () => "3–6-night exception",
    date => !isDefaultDate(date),
  );
  const defaultDates = model.dates.filter(isDefaultDate).length;
  return Object.freeze({
    id: "vrbo",
    label: "Vrbo",
    status: "Set day-of-week defaults once, then enter exceptions only",
    summary: `Vrbo’s day-of-week Base rate covers ${defaultDates} ordinary dates without individual entries. The exception schedule preserves the canonical three-to-six-night price where seasons, events, or minimum stays differ.`,
    guides: OFFICIAL_GUIDES.vrbo,
    metadata: commonMetadata(ruleDocument, calendarDocument, model),
    defaults: Object.freeze([
      Object.freeze({ label: "Sunday–Thursday Base rate", value: money(weekdayBase, model.currency), detail: "Customize Base rate by day of week" }),
      Object.freeze({ label: "Friday–Saturday Base rate", value: money(weekendBase, model.currency), detail: "Customize Base rate by day of week" }),
      Object.freeze({ label: "Extended-stay discounts", value: `${percent(weekly)} weekly · ${percent(monthly)} monthly`, detail: "Set once in Pricing settings" }),
      Object.freeze({ label: "Calendar dates needing no price entry", value: defaultDates.toLocaleString("en-US"), detail: "Covered by the day-of-week Base rate" }),
    ]),
    steps: Object.freeze([
      "Open Owner Dashboard → the listing → Calendar → Settings → Pricing.",
      "Turn Rate automation off. Remove promotions and discounts not represented in the applied rule document.",
      `Open Base rate, enable Customize by day of week, set Sunday–Thursday to ${money(weekdayBase, model.currency)}, and set Friday–Saturday to ${money(weekendBase, model.currency)}. Save once.`,
      `Set Extended stay discounts to Weekly ${percent(weekly)} and Monthly ${percent(monthly)}.`,
      "Do not edit ordinary dates covered by the day-of-week Base rate. For each exception batch below, open Rates and discounts and enter the listed Amount per night. Enter 0 for date-specific discounts so the configured base weekly/monthly discounts remain predictable.",
      "Open Manage dates → Minimum night stay only for rows listing more than 1 night.",
      "Verify representative 3-, 7-, and 28-night searches. One- and two-night premiums and the 14–27-night discount cannot be reproduced in the standard Vrbo dashboard.",
    ]),
    warnings: Object.freeze([
      "Vrbo will undercharge one- and two-night stays compared with the engine if those stays remain bookable.",
      "Vrbo will apply the weekly discount to stays where the engine uses its separate 14–27-night discount, so those totals will differ.",
      "Guest totals will differ after Vrbo fees, cleaning fees, taxes, conversion, or promotions.",
    ]),
    scheduleTitle: "Exception-only calendar schedule",
    scheduleNote: `${defaultDates} ordinary dates are intentionally omitted because the customized day-of-week Base rate covers them. Enter only the rows below; the end date is inclusive.`,
    omittedDates: defaultDates,
    schedule,
  });
}

function bookingPlan(ruleDocument, calendarDocument, model) {
  const schedule = compressSchedule(model, date => model.getPriceForDate(date, 3), () => "Standard rate plan");
  return Object.freeze({
    id: "booking",
    label: "Booking.com",
    status: "Standard Extranet fallback — exact LOS requires certification",
    summary: "A normal Booking.com Standard rate plan stores one nightly price per date. Exact one-, two-, and longer-stay totals require Booking.com’s certified Length of Stay connectivity model, so this manual fallback preserves the three-to-six-night rate.",
    guides: OFFICIAL_GUIDES.booking,
    metadata: commonMetadata(ruleDocument, calendarDocument, model),
    defaults: Object.freeze([
      Object.freeze({ label: "Rate plan", value: "Standard", detail: "One active plan for this property" }),
      Object.freeze({ label: "Currency", value: model.currency, detail: "Must match the rule document" }),
      Object.freeze({ label: "Calendar batches", value: schedule.length.toLocaleString("en-US"), detail: "Consecutive identical dates are already combined" }),
    ]),
    steps: Object.freeze([
      "In the Extranet, use one active Standard rate plan for this property. Confirm the property currency matches the rule document before entering prices.",
      "Disable Genius, mobile, country, last-minute, early-booker, campaign, and other promotions not represented in the applied rule document.",
      "Open Rates & Availability → Calendar. For each batch below, enter the listed price for the Standard rate plan.",
      "Set the minimum length of stay shown for each batch. Keep availability changes separate; this document contains event facts, not room inventory.",
      "Verify representative 3-night searches. The standard manual Extranet cannot reproduce the one-night premium, two-night premium, 7–13-night discount, 14–27-night discount, or 28-night discount exactly.",
      "If Booking.com later certifies the property for LOS connectivity, replace this fallback with explicit totals by check-in date and stay length; do not mix Standard and LOS prices without a controlled migration.",
    ]),
    warnings: Object.freeze([
      "One-, two-, and discounted longer-stay accommodation subtotals will differ from the engine under a Standard rate plan.",
      "Guest totals will differ after Booking.com commission-facing settings, taxes, fees, currency conversion, Genius, or other promotions.",
    ]),
    scheduleTitle: "Required compressed calendar schedule",
    scheduleNote: "A verified global weekday/weekend fallback is not available in the ordinary Standard Extranet workflow. Consecutive dates with the same price and restriction are already combined; enter every row in order. The end date is inclusive.",
    omittedDates: 0,
    schedule,
  });
}

export function createMarketplaceInstructions(ruleDocument, calendarDocument, model) {
  if (!ruleDocument?.rule_set || !calendarDocument?.id || !model?.dates?.length) {
    throw new TypeError("Applied price rules, calendar description, and pricing model are required.");
  }
  return Object.freeze([
    airbnbPlan(ruleDocument, calendarDocument, model),
    vrboPlan(ruleDocument, calendarDocument, model),
    bookingPlan(ruleDocument, calendarDocument, model),
  ]);
}

export function formatScheduleRange(row) {
  return row.from === row.through ? row.from : `${row.from} through ${row.through}`;
}

export function formatScheduleNightly(row, currency) {
  return money(row.nightly, currency);
}
