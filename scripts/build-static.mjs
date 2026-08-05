import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const casaSource = resolve(root, "apps/casadepedra-rio");
const pricingSource = resolve(root, "apps/pricing-casadepedra-rio");
const pickerSource = resolve(root, "packages/date-range-picker/date-picker.js");
const engineSource = resolve(root, "packages/price-engine/src");

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

const pricingApiBaseUrl = String(process.env.PRICING_API_BASE_URL ?? "").replace(/\/$/, "");
const runtimeConfig = `globalThis.PMC_CONFIG = Object.freeze(${JSON.stringify({ pricingApiBaseUrl }, null, 2)});\n`;
await writeFile(
  resolve(dist, "casadepedra-rio/config.js"),
  runtimeConfig,
  "utf8",
);
await writeFile(
  resolve(dist, "pricing-casadepedra-rio/config.js"),
  runtimeConfig,
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
