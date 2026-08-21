import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compileRuleText } from "../../../services/pricing-api/src/rule-file-store.js";

const rulesPath = fileURLToPath(new URL("../../../config/pricing/casa-de-pedra.yaml", import.meta.url));
const calendarPath = fileURLToPath(new URL("../../../services/pricing-api/examples/rio-2027.calendar.json", import.meta.url));

export async function loadPricingFixtures() {
  const [rulesText, calendar] = await Promise.all([
    readFile(rulesPath, "utf8"),
    readFile(calendarPath, "utf8").then(JSON.parse),
  ]);
  return {
    rules: compileRuleText(rulesText, rulesPath).ruleSet,
    calendar,
  };
}
