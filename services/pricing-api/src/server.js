import { createServer } from "node:http";
import { createRequestHandler } from "./app.js";
import { CalendarFileStore, StaticCalendarStore } from "./calendar-store.js";
import { loadConfig } from "./config.js";
import { RuleFileStore } from "./rule-file-store.js";

async function main() {
  const config = loadConfig();
  const ruleStore = new RuleFileStore(config.rulesFile, { autoReload: config.autoReload });
  const calendarStore = config.calendarFile
    ? new CalendarFileStore(config.calendarFile, { autoReload: config.autoReload })
    : new StaticCalendarStore();

  await Promise.all([ruleStore.initialize(), calendarStore.initialize()]);
  const handler = createRequestHandler({ ruleStore, calendarStore, allowedOrigins: config.allowedOrigins });
  const server = createServer((request, response) => {
    handler(request, response).catch((error) => {
      if (!response.headersSent) response.writeHead(500, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: error.message } }));
    });
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxRequestsPerSocket = 100;

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, resolve);
  });
  const address = server.address();
  const location = typeof address === "object" && address ? `http://${config.host}:${address.port}` : String(address);
  console.log(`Pricing service listening on ${location}`);
  console.log(`Rules: ${ruleStore.snapshot.ruleSet.rule_set.id} v${ruleStore.snapshot.ruleSet.rule_set.version} (${ruleStore.snapshot.hash})`);
  console.log(`Calendar snapshot: ${calendarStore.snapshot.id}`);

  const close = () => server.close(() => process.exit(0));
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
