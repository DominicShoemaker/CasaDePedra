import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compileRuleText } from "../services/pricing-api/src/rule-file-store.js";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const casaSource = resolve(root, "apps/casadepedra-rio");
const pricingSource = resolve(root, "apps/pricing-casadepedra-rio");
const pickerSource = resolve(root, "packages/date-range-picker/date-picker.js");
const engineSource = resolve(root, "packages/price-engine/src");
const rulesSource = resolve(root, "config/pricing/casa-de-pedra.yaml");
const calendarSource = resolve(root, "services/pricing-api/examples/rio-2027.calendar.json");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await cp(casaSource, resolve(dist, "casadepedra-rio"), { recursive: true });
await mkdir(resolve(dist, "casadepedra-rio/date-range-picker"), { recursive: true });
await cp(pickerSource, resolve(dist, "casadepedra-rio/date-range-picker/date-picker.js"));

await cp(pricingSource, resolve(dist, "pricing-casadepedra-rio"), {
  recursive: true,
  filter: source => !/[\\/]test(?:[\\/]|$)/.test(source) && !/[\\/](?:package\.json|serve\.js|README\.md)$/.test(source),
});
await cp(pickerSource, resolve(dist, "pricing-casadepedra-rio/date-picker.js"));
await mkdir(resolve(dist, "pricing-casadepedra-rio/vendor/price-engine"), { recursive: true });
await cp(engineSource, resolve(dist, "pricing-casadepedra-rio/vendor/price-engine"), { recursive: true });

const rulesText = await readFile(rulesSource, "utf8");
const compiledRules = compileRuleText(rulesText, rulesSource).ruleSet;
await writeFile(
  resolve(dist, "pricing-casadepedra-rio/casa-de-pedra.rules.json"),
  `${JSON.stringify(compiledRules, null, 2)}\n`,
  "utf8",
);
await cp(calendarSource, resolve(dist, "pricing-casadepedra-rio/rio-2027.calendar.json"));

const pricingApiBaseUrl = String(process.env.PRICING_API_BASE_URL ?? "").replace(/\/$/, "");
const runtimeConfig = `globalThis.PMC_CONFIG = Object.freeze(${JSON.stringify({ pricingApiBaseUrl }, null, 2)});\n`;
const browserOnlyPricingConfig = "globalThis.PMC_CONFIG = Object.freeze({});\n";
await writeFile(
  resolve(dist, "casadepedra-rio/config.js"),
  runtimeConfig,
  "utf8",
);
await writeFile(
  resolve(dist, "pricing-casadepedra-rio/config.js"),
  browserOnlyPricingConfig,
  "utf8",
);

const pricingModelPath = resolve(dist, "pricing-casadepedra-rio/pricing-model.js");
const pricingModel = await readFile(pricingModelPath, "utf8");
await writeFile(
  pricingModelPath,
  pricingModel.replace('../../packages/price-engine/src/index.js', './vendor/price-engine/index.js'),
  "utf8",
);

console.log("Built dist/casadepedra-rio and dist/pricing-casadepedra-rio");
