const OFFICIAL_GUIDES = Object.freeze({
  airbnb: "https://www.airbnb.com/help/article/2061",
  vrbo: "https://help.vrbo.com/articles/How-do-I-manage-my-rates",
  booking: "https://developers.booking.com/connectivity/docs/csv-los_pricing",
});

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

function compressSchedule(model, valueForDate, profileForDate) {
  const rows = [];
  for (const date of model.dates) {
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
  const schedule = compressSchedule(
    model,
    date => model.getPriceForDate(date, 1),
    date => model.getPriceForDate(date, 1) === model.getPriceForDate(date, 3) ? "Event — no LOS discount" : "Standard inverted LOS",
  );
  return Object.freeze({
    id: "airbnb",
    label: "Airbnb",
    status: "Native rule-set translation with verification required",
    summary: "Airbnb has length-of-stay discounts but no positive short-stay premium. Use the calculated one-night amount as the calendar anchor, then invert the premiums into discounts for longer stays.",
    guideUrl: OFFICIAL_GUIDES.airbnb,
    metadata: commonMetadata(ruleDocument, calendarDocument, model),
    steps: Object.freeze([
      "On desktop, enable Professional hosting tools and open the listing Multi-calendar.",
      "Turn Smart Pricing off. Remove early-bird, last-minute, weekly, monthly, custom, and other promotions not represented in the applied rule document.",
      `Create a rule-set named “PMC Standard LOS v${ruleDocument.rule_set.version}”. Enter these trip-length discounts: 2 nights ${percent(discounts.twoNight)}; 3, 4, 5, and 6 nights ${percent(discounts.threeToSix)} each; 1 week ${percent(discounts.weekly)}; 2 and 3 weeks ${percent(discounts.twoWeek)} each; 4 through 12 weeks ${percent(discounts.monthly)} each.`,
      "For each Standard inverted LOS row below, set the listed nightly price and apply the PMC Standard LOS rule-set.",
      "For each Event — no LOS discount row, set the listed nightly price and apply a separate rule-set with no trip-length discounts.",
      "Set the listed minimum stay on every calendar batch. Do not add a short-stay cleaning fee to imitate the premium because the parity target excludes fees.",
      "Test at least one 1-, 2-, 3-, 7-, 14-, and 28-night stay before publishing. If Airbnb accepts only whole-number discounts, exact parity is impossible; use the closest accepted percentage and record the variance.",
    ]),
    warnings: Object.freeze([
      "A stay crossing Standard and Event profiles may not exactly reproduce the engine because Airbnb applies its own rule-set combination logic.",
      "Guest totals will differ after Airbnb service fees, cleaning fees, taxes, currency conversion, or marketplace promotions.",
    ]),
    schedule,
  });
}

function vrboPlan(ruleDocument, calendarDocument, model) {
  const weekly = actionPercent(ruleDocument, "weekly-stay", "stay_discount_percent");
  const monthly = actionPercent(ruleDocument, "monthly-stay", "stay_discount_percent");
  const schedule = compressSchedule(model, date => model.getPriceForDate(date, 3), () => "3–6-night base");
  return Object.freeze({
    id: "vrbo",
    label: "Vrbo",
    status: "Manual fallback — short-stay parity is unavailable",
    summary: "Vrbo’s Owner Dashboard supports absolute date prices and weekly/monthly discounts, but not one-night, two-night, or 14–27-night pricing rules. The instructions therefore preserve the canonical three-to-six-night rate.",
    guideUrl: OFFICIAL_GUIDES.vrbo,
    metadata: commonMetadata(ruleDocument, calendarDocument, model),
    steps: Object.freeze([
      "Open Owner Dashboard → the listing → Calendar → Settings → Pricing.",
      "Turn Rate automation off. Remove promotions and discounts not represented in the applied rule document.",
      `Set Extended stay discounts to Weekly ${percent(weekly)} and Monthly ${percent(monthly)}.`,
      "Select each calendar batch below, open Rates and discounts, and enter the listed Amount per night. Enter 0 for date-specific discounts so the configured base weekly/monthly discounts remain predictable.",
      "Open Manage dates → Minimum night stay and enter the listed minimum stay for each batch.",
      "Verify representative 3-, 7-, and 28-night searches. One- and two-night premiums and the 14–27-night discount cannot be reproduced in the standard Vrbo dashboard.",
    ]),
    warnings: Object.freeze([
      "Vrbo will undercharge one- and two-night stays compared with the engine if those stays remain bookable.",
      "Vrbo will apply the weekly discount to stays where the engine uses its separate 14–27-night discount, so those totals will differ.",
      "Guest totals will differ after Vrbo fees, cleaning fees, taxes, conversion, or promotions.",
    ]),
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
    guideUrl: OFFICIAL_GUIDES.booking,
    metadata: commonMetadata(ruleDocument, calendarDocument, model),
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
