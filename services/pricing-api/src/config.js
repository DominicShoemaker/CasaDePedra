import { fileURLToPath } from "node:url";
import { isAbsolute, resolve } from "node:path";

const DEFAULT_RULES_FILE = fileURLToPath(new URL("../../../config/pricing/casa-de-pedra.yaml", import.meta.url));
const DEFAULT_CALENDAR_FILE = fileURLToPath(new URL("../examples/rio-2027.calendar.json", import.meta.url));

function boolean(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}

function splitOrigins(value) {
  return String(value ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
}

export function loadConfig(environment = process.env, argumentsList = process.argv.slice(2)) {
  const invocationDirectory = environment.INIT_CWD ?? process.cwd();
  const values = {
    rulesFile: environment.RULES_FILE ?? DEFAULT_RULES_FILE,
    calendarFile: environment.CALENDAR_FILE ?? DEFAULT_CALENDAR_FILE,
    host: environment.HOST ?? "127.0.0.1",
    port: Number(environment.PORT ?? 7072),
    autoReload: boolean(environment.AUTO_RELOAD_RULES),
    allowedOrigins: splitOrigins(environment.ALLOWED_ORIGINS),
    storageAccountUrl: environment.PRICING_STORAGE_ACCOUNT_URL || null,
    storageContainer: environment.PRICING_CONFIG_CONTAINER ?? "pricing-config",
    rulesBlob: environment.PRICING_RULES_BLOB ?? "casa-de-pedra.yaml",
    calendarBlob: environment.PRICING_CALENDAR_BLOB ?? "rio-calendar.json",
    managedIdentityClientId: environment.AZURE_CLIENT_ID || null,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const next = () => {
      index += 1;
      if (index >= argumentsList.length) throw new Error(`${argument} requires a value.`);
      return argumentsList[index];
    };
    if (argument === "--rules") values.rulesFile = next();
    else if (argument === "--calendar") values.calendarFile = next();
    else if (argument === "--host") values.host = next();
    else if (argument === "--port") values.port = Number(next());
    else if (argument === "--allow-origin") values.allowedOrigins.push(next());
    else if (argument === "--auto-reload") values.autoReload = true;
    else throw new Error(`Unknown command-line argument: ${argument}`);
  }

  if (!Number.isInteger(values.port) || values.port < 0 || values.port > 65535) throw new Error("PORT must be an integer from 0 through 65535.");
  if (!isAbsolute(values.rulesFile)) values.rulesFile = resolve(invocationDirectory, values.rulesFile);
  if (values.calendarFile && !isAbsolute(values.calendarFile)) values.calendarFile = resolve(invocationDirectory, values.calendarFile);
  return Object.freeze({ ...values, allowedOrigins: Object.freeze([...new Set(values.allowedOrigins)]) });
}
