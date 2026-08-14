import {
  STAY_LENGTHS,
  createCalendarYearHorizon,
  createCalendarPricingModel,
  describeSelectedStay,
  formatCalendarMoney,
  formatMoney,
} from "./pricing-model.js";
import {
  createMarketplaceInstructions,
  formatScheduleNightly,
  formatScheduleRange,
} from "./provider-instructions.js";

const SERIES = Object.freeze([
  { nights: 1, label: "1-night rate", color: "#c75b43" },
  { nights: 2, label: "2-night rate", color: "#b98722" },
  { nights: 3, label: "3-night rate", color: "#0b7285" },
]);

const picker = document.querySelector("#price-calendar");
const rulesInput = document.querySelector("#rules-input");
const calendarInput = document.querySelector("#calendar-input");
const inputStatus = document.querySelector("#input-status");
const applyButton = document.querySelector("#apply-inputs");
const chartCanvas = document.querySelector("#price-chart");
const chartStage = document.querySelector("#chart-stage");
const chartViewport = document.querySelector("#chart-viewport");
const chartTooltip = document.querySelector("#chart-tooltip");
const providerTabs = [...document.querySelectorAll("[role='tab'][data-provider]")];
const providerPanels = [...document.querySelectorAll("[data-provider-panel]")];

let pricingModel = null;
let displayStayNights = 3;
let selectedRange = { startDate: null, endDate: null };
let chartGeometry = null;
let keyboardChartIndex = 0;

function appendTextElement(parent, tagName, text, className = "") {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function renderProviderPlan(plan) {
  const panel = document.querySelector(`[data-provider-panel='${plan.id}']`);
  panel.replaceChildren();

  const header = document.createElement("div");
  header.className = "provider-plan-header";
  const titleGroup = document.createElement("div");
  appendTextElement(titleGroup, "h3", `${plan.label} setup instructions`);
  appendTextElement(titleGroup, "p", plan.status, "provider-status");
  const sources = document.createElement("div");
  sources.className = "provider-guides";
  for (const guide of plan.guides) {
    const source = document.createElement("a");
    source.href = guide.url;
    source.target = "_blank";
    source.rel = "noreferrer";
    source.textContent = guide.label;
    sources.append(source);
  }
  header.append(titleGroup, sources);
  panel.append(header);
  appendTextElement(panel, "p", plan.summary, "provider-summary");

  const metadata = document.createElement("dl");
  metadata.className = "provider-metadata";
  for (const [label, value] of [
    ["Rules", plan.metadata.ruleSet],
    ["Calendar", plan.metadata.calendar],
    ["Coverage", `${plan.metadata.from} through ${plan.metadata.through}`],
    ["Currency", plan.metadata.currency],
  ]) {
    const item = document.createElement("div");
    appendTextElement(item, "dt", label);
    appendTextElement(item, "dd", value);
    metadata.append(item);
  }
  panel.append(metadata);

  appendTextElement(panel, "h4", "Set once");
  const defaults = document.createElement("div");
  defaults.className = "provider-defaults";
  for (const setting of plan.defaults) {
    const item = document.createElement("div");
    appendTextElement(item, "span", setting.label);
    appendTextElement(item, "strong", setting.value);
    appendTextElement(item, "small", setting.detail);
    defaults.append(item);
  }
  panel.append(defaults);

  appendTextElement(panel, "h4", "Configuration steps");
  const steps = document.createElement("ol");
  steps.className = "provider-steps";
  for (const step of plan.steps) appendTextElement(steps, "li", step);
  panel.append(steps);

  const warning = document.createElement("aside");
  warning.className = "provider-warning";
  appendTextElement(warning, "strong", "Parity limitations");
  const warnings = document.createElement("ul");
  for (const message of plan.warnings) appendTextElement(warnings, "li", message);
  warning.append(warnings);
  panel.append(warning);

  const details = document.createElement("details");
  details.className = "schedule-details";
  const summary = document.createElement("summary");
  summary.textContent = `${plan.scheduleTitle} (${plan.schedule.length} batches)`;
  details.append(summary);
  appendTextElement(details, "p", `${plan.scheduleNote} Reapply these instructions whenever the price rules, calendar description, or two-year horizon changes.`, "schedule-note");
  const viewport = document.createElement("div");
  viewport.className = "schedule-table-viewport";
  const table = document.createElement("table");
  table.className = "schedule-table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of ["Date or inclusive range", "Nightly price", "Minimum stay", "Rule profile"]) appendTextElement(headRow, "th", label);
  head.append(headRow);
  const body = document.createElement("tbody");
  for (const row of plan.schedule) {
    const tableRow = document.createElement("tr");
    appendTextElement(tableRow, "td", formatScheduleRange(row));
    appendTextElement(tableRow, "td", formatScheduleNightly(row, plan.metadata.currency));
    appendTextElement(tableRow, "td", `${row.minimumStay} ${row.minimumStay === 1 ? "night" : "nights"}`);
    appendTextElement(tableRow, "td", row.profile);
    body.append(tableRow);
  }
  table.append(head, body);
  viewport.append(table);
  details.append(viewport);
  panel.append(details);
}

function renderMarketplaceInstructions(ruleDocument, calendarDocument, model) {
  const plans = createMarketplaceInstructions(ruleDocument, calendarDocument, model);
  for (const plan of plans) renderProviderPlan(plan);
}

function selectProvider(provider) {
  for (const tab of providerTabs) {
    const active = tab.dataset.provider === provider;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  for (const panel of providerPanels) panel.hidden = panel.dataset.providerPanel !== provider;
}

function dateLabel(localDate, options = { month: "short", day: "numeric", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(`${localDate}T00:00:00Z`));
}

function localISO(date) {
  if (!(date instanceof Date)) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ruleLabel(ruleId) {
  return ruleId.split("-").map(part => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" ");
}

function setStatus(message, type = "success") {
  inputStatus.textContent = message;
  inputStatus.className = `input-status ${type}`;
}

function renderLegend() {
  const legend = document.querySelector("#chart-legend");
  legend.replaceChildren();
  for (const series of SERIES) {
    const item = document.createElement("span");
    item.className = `legend-item${series.nights === displayStayNights ? " active" : ""}`;
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = series.color;
    const label = document.createElement("span");
    label.textContent = series.label;
    item.append(swatch, label);
    legend.append(item);
  }
}

function clearQuote(message = "The exact stay subtotal and adjustment will appear here.") {
  const panel = document.querySelector("#quote-panel");
  panel.className = "quote-panel empty";
  document.querySelector("#quote-dates").textContent = selectedRange.startDate ? `Check-in ${dateLabel(localISO(selectedRange.startDate))}` : "No dates selected";
  document.querySelector("#quote-title").textContent = selectedRange.startDate ? "Now choose checkout" : "Choose check-in and checkout";
  document.querySelector("#quote-comment").textContent = message;
  document.querySelector("#quote-total").textContent = "—";
  document.querySelector("#quote-average").textContent = "—";
  document.querySelector("#quote-breakdown").hidden = true;
  document.querySelector("#quote-restriction").hidden = true;
  document.querySelector("#quote-rules").hidden = true;
}

function renderSelectedStay() {
  if (!pricingModel || !selectedRange.startDate || !selectedRange.endDate) {
    clearQuote();
    return;
  }
  const checkIn = localISO(selectedRange.startDate);
  const checkOut = localISO(selectedRange.endDate);
  try {
    const description = describeSelectedStay(pricingModel, checkIn, checkOut);
    const { quote } = description;
    const panel = document.querySelector("#quote-panel");
    panel.className = `quote-panel${quote.restrictions.eligible ? "" : " ineligible"}`;
    document.querySelector("#quote-dates").textContent = `${dateLabel(checkIn)} – ${dateLabel(checkOut)}`;
    document.querySelector("#quote-title").textContent = `${quote.stayNights}-night stay`;
    document.querySelector("#quote-comment").textContent = description.comment;
    document.querySelector("#quote-total").textContent = formatMoney(description.total, quote.currency);
    document.querySelector("#quote-average").textContent = `${formatMoney(description.averageNightly, quote.currency)} average per night`;
    document.querySelector("#quote-baseline").textContent = formatMoney(description.baseline, quote.currency);
    document.querySelector("#adjustment-label").textContent = description.direction === "premium"
      ? "Short-stay adjustment"
      : description.direction === "discount" ? "Length-of-stay discount" : "Length-of-stay adjustment";
    const signedAdjustment = Number(description.adjustment) > 0
      ? `+${formatMoney(description.adjustment, quote.currency)}`
      : formatMoney(description.adjustment, quote.currency);
    document.querySelector("#quote-adjustment").textContent = signedAdjustment;
    document.querySelector("#quote-breakdown").hidden = false;

    const restriction = document.querySelector("#quote-restriction");
    const violations = quote.restrictions.violations ?? [];
    restriction.hidden = violations.length === 0;
    restriction.textContent = violations.map(violation => violation.message).join(" ");

    const ruleContainer = document.querySelector("#quote-rules");
    const ruleIds = [...new Set(quote.nights.flatMap(night => night.appliedRules))];
    ruleContainer.replaceChildren();
    for (const id of ruleIds) {
      const chip = document.createElement("span");
      chip.textContent = ruleLabel(id);
      ruleContainer.append(chip);
    }
    ruleContainer.hidden = ruleIds.length === 0;
  } catch (error) {
    clearQuote(error instanceof Error ? error.message : "The selected stay could not be calculated.");
  }
}

function yBounds() {
  const values = pricingModel.series.flatMap(series => series.values.map(point => Number(point.price)));
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const lower = Math.max(0, Math.floor((minimum - 50) / 100) * 100);
  const upper = Math.ceil((maximum + 50) / 100) * 100;
  return { lower, upper: upper === lower ? lower + 100 : upper };
}

function drawChart() {
  renderLegend();
  if (!pricingModel) return;
  const dates = pricingModel.dates;
  const width = Math.max(chartViewport.clientWidth - 2, dates.length * 18);
  const height = 380;
  const margins = { left: 72, right: 30, top: 28, bottom: 48 };
  const plotWidth = width - margins.left - margins.right;
  const plotHeight = height - margins.top - margins.bottom;
  const { lower, upper } = yBounds();
  const xFor = index => margins.left + (dates.length === 1 ? 0 : (index / (dates.length - 1)) * plotWidth);
  const yFor = value => margins.top + ((upper - value) / (upper - lower)) * plotHeight;

  chartStage.style.width = `${width}px`;
  chartCanvas.width = width;
  chartCanvas.height = height;
  chartCanvas.style.width = `${width}px`;
  chartCanvas.style.height = `${height}px`;
  const context = chartCanvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#fffdf9";
  context.fillRect(0, 0, width, height);

  const threeNightSeries = pricingModel.series.find(series => series.nights === 3);
  const dayWidth = plotWidth / Math.max(1, dates.length - 1);
  context.fillStyle = "rgba(216, 149, 25, 0.11)";
  threeNightSeries.values.forEach((point, index) => {
    if ((point.minimumStay ?? 0) > 1) context.fillRect(xFor(index) - dayWidth / 2, margins.top, Math.max(1, dayWidth), plotHeight);
  });

  context.font = "12px system-ui, sans-serif";
  context.textBaseline = "middle";
  context.strokeStyle = "#e1ddd4";
  context.fillStyle = "#68777d";
  for (let tick = 0; tick <= 5; tick += 1) {
    const value = lower + ((upper - lower) * tick) / 5;
    const y = yFor(value);
    context.beginPath();
    context.moveTo(margins.left, y);
    context.lineTo(width - margins.right, y);
    context.stroke();
    context.textAlign = "right";
    context.fillText(formatCalendarMoney(value, pricingModel.currency), margins.left - 10, y);
  }

  context.textAlign = "center";
  dates.forEach((date, index) => {
    if (!date.endsWith("-01") && index !== 0) return;
    const x = xFor(index);
    context.strokeStyle = "#ece8e0";
    context.beginPath();
    context.moveTo(x, margins.top);
    context.lineTo(x, margins.top + plotHeight);
    context.stroke();
    context.fillStyle = "#68777d";
    context.fillText(dateLabel(date, { month: "short", year: "2-digit" }), x, height - 21);
  });

  const ordered = [...SERIES].sort((left, right) => Number(left.nights === displayStayNights) - Number(right.nights === displayStayNights));
  for (const descriptor of ordered) {
    const series = pricingModel.series.find(item => item.nights === descriptor.nights);
    context.strokeStyle = descriptor.color;
    context.lineWidth = descriptor.nights === displayStayNights ? 3.5 : 2;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.beginPath();
    series.values.forEach((point, index) => {
      const x = xFor(index);
      const y = yFor(Number(point.price));
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  }

  chartGeometry = { dates, xFor, yFor, margins, plotWidth };
  const allPrices = pricingModel.series.flatMap(series => series.values.map(point => Number(point.price)));
  document.querySelector("#chart-summary").textContent = `${dateLabel(dates[0])} to ${dateLabel(dates.at(-1))} · ${formatCalendarMoney(Math.min(...allPrices), pricingModel.currency)}–${formatCalendarMoney(Math.max(...allPrices), pricingModel.currency)}`;
}

function showChartPoint(index) {
  if (!pricingModel || !chartGeometry) return;
  const bounded = Math.max(0, Math.min(pricingModel.dates.length - 1, index));
  keyboardChartIndex = bounded;
  const date = pricingModel.dates[bounded];
  const values = SERIES.map(descriptor => {
    const price = pricingModel.series.find(series => series.nights === descriptor.nights).values[bounded].price;
    return `${descriptor.label}: ${formatCalendarMoney(price, pricingModel.currency)}`;
  });
  const minimumStay = pricingModel.getMinimumStayForDate(date);
  chartTooltip.textContent = `${dateLabel(date)}\n${values.join("\n")}${minimumStay ? `\nMinimum stay: ${minimumStay} nights` : ""}`;
  chartTooltip.style.left = `${Math.max(8, chartGeometry.xFor(bounded) - 78)}px`;
  chartTooltip.style.top = "12px";
  chartTooltip.hidden = false;
  chartCanvas.setAttribute("aria-label", `${dateLabel(date)}. ${values.join(". ")}.${minimumStay ? ` Minimum stay ${minimumStay} nights.` : ""}`);
}

chartCanvas.addEventListener("pointermove", event => {
  if (!chartGeometry) return;
  const raw = ((event.offsetX - chartGeometry.margins.left) / chartGeometry.plotWidth) * (chartGeometry.dates.length - 1);
  showChartPoint(Math.round(raw));
});
chartCanvas.addEventListener("pointerleave", () => { chartTooltip.hidden = true; });
chartCanvas.addEventListener("keydown", event => {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  showChartPoint(keyboardChartIndex + (event.key === "ArrowRight" ? 1 : -1));
  const x = chartGeometry.xFor(keyboardChartIndex);
  chartViewport.scrollLeft = Math.max(0, x - chartViewport.clientWidth / 2);
});

function applyInputs() {
  applyButton.disabled = true;
  try {
    const ruleDocument = JSON.parse(rulesInput.value);
    const calendarDocument = JSON.parse(calendarInput.value);
    const horizon = createCalendarYearHorizon(ruleDocument.listing_context?.timezone, 2);
    const candidate = createCalendarPricingModel(ruleDocument, calendarDocument, horizon);
    pricingModel = candidate;
    picker.setSelectableBounds(candidate.coverage.from, candidate.coverage.through);
    picker.setPricingProvider({
      getPriceForDate: (date, nights) => candidate.getPriceForDate(date, nights),
      getMinimumStayForDate: date => candidate.getMinimumStayForDate(date),
      formatPrice: value => formatCalendarMoney(value, candidate.currency),
    });
    drawChart();
    renderSelectedStay();
    renderMarketplaceInstructions(ruleDocument, calendarDocument, candidate);
    const expires = calendarDocument.expiresAt ? ` Calendar snapshot expires ${new Date(calendarDocument.expiresAt).toLocaleString("en-US", { dateStyle: "medium", timeZone: "UTC" })}.` : "";
    setStatus(`Applied a ${horizon.years}-calendar-year horizon: ${dateLabel(horizon.from)} through ${dateLabel(horizon.through)} (${candidate.dates.length} nights), with three price series calculated locally.${expires}`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "The inputs could not be applied.", "error");
  } finally {
    applyButton.disabled = false;
  }
}

picker.addEventListener("price-display-mode-changed", event => {
  displayStayNights = event.detail.nights;
  document.querySelector("#calendar-mode-copy").textContent = `Calendar showing the ${displayStayNights}-night rate.`;
  drawChart();
});

picker.addEventListener("selection-changed", event => {
  selectedRange = { startDate: event.detail.startDate, endDate: event.detail.endDate };
  renderSelectedStay();
});

applyButton.addEventListener("click", applyInputs);
for (const tab of providerTabs) {
  tab.addEventListener("click", () => selectProvider(tab.dataset.provider));
  tab.addEventListener("keydown", event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = providerTabs.indexOf(tab);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? providerTabs.length - 1
        : (current + (event.key === 'ArrowRight' ? 1 : -1) + providerTabs.length) % providerTabs.length;
    selectProvider(providerTabs[next].dataset.provider);
    providerTabs[next].focus();
  });
}
window.addEventListener("resize", () => drawChart());

async function start() {
  await customElements.whenDefined("str-date-range-picker");
  const apiBase = String(globalThis.PMC_CONFIG?.pricingApiBaseUrl ?? "").replace(/\/$/, "");
  let ruleDocument;
  let calendarDocument;
  if (apiBase) {
    try {
      const [rulesResponse, calendarResponse] = await Promise.all([
        fetch(`${apiBase}/api/v1/rule-set`, { cache: "no-store" }),
        fetch(`${apiBase}/api/v1/calendar-snapshot`, { cache: "no-store" }),
      ]);
      if (!rulesResponse.ok || !calendarResponse.ok) {
        throw new Error(`Pricing API defaults are not ready (rules ${rulesResponse.status}, calendar ${calendarResponse.status}).`);
      }
      ruleDocument = (await rulesResponse.json()).ruleSet;
      calendarDocument = (await calendarResponse.json()).calendarSnapshot;
    } catch (error) {
      console.warn("Using bundled pricing defaults because the API defaults could not be loaded.", error);
    }
  }
  if (!ruleDocument || !calendarDocument) {
    const [rulesResponse, calendarResponse] = await Promise.all([
      fetch(new URL("./casa-de-pedra.rules.json", import.meta.url)),
      fetch(new URL("./rio-2027.calendar.json", import.meta.url)),
    ]);
    if (!rulesResponse.ok || !calendarResponse.ok) throw new Error("Pricing defaults could not be loaded.");
    ruleDocument = await rulesResponse.json();
    calendarDocument = await calendarResponse.json();
  }
  rulesInput.value = JSON.stringify(ruleDocument, null, 2);
  calendarInput.value = JSON.stringify(calendarDocument, null, 2);
  applyInputs();
}

start().catch(error => setStatus(error.message, "error"));
