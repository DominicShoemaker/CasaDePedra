import { app } from "@azure/functions";
import { createRequestHandler } from "../app.js";
import { CalendarFileStore, StaticCalendarStore } from "../calendar-store.js";
import { CalendarBlobStore, RuleBlobStore } from "../blob-stores.js";
import { loadConfig } from "../config.js";
import { RuleFileStore } from "../rule-file-store.js";

let handlerPromise;

async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const config = loadConfig(process.env, []);
      const blobOptions = { clientId: config.managedIdentityClientId, autoReload: config.autoReload };
      const ruleStore = config.storageAccountUrl
        ? new RuleBlobStore(config.storageAccountUrl, config.storageContainer, config.rulesBlob, blobOptions)
        : new RuleFileStore(config.rulesFile, { autoReload: config.autoReload });
      const calendarStore = config.storageAccountUrl
        ? new CalendarBlobStore(config.storageAccountUrl, config.storageContainer, config.calendarBlob, blobOptions)
        : config.calendarFile
          ? new CalendarFileStore(config.calendarFile, { autoReload: config.autoReload })
          : new StaticCalendarStore();
      await Promise.all([ruleStore.initialize(), calendarStore.initialize()]);
      return createRequestHandler({
        ruleStore,
        calendarStore,
        allowedOrigins: config.allowedOrigins,
        maximumHorizonDays: 732,
      });
    })();
  }
  return handlerPromise;
}

function nodeRequest(request) {
  const originalUrl = new URL(request.url);
  const pathname = originalUrl.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  const body = request.method === "GET" || request.method === "HEAD" ? "" : request.text();
  return {
    method: request.method,
    url: `${pathname}${originalUrl.search}`,
    headers: Object.fromEntries(request.headers.entries()),
    async *[Symbol.asyncIterator]() {
      const text = await body;
      if (text) yield Buffer.from(text, "utf8");
    },
  };
}

function responseCollector(resolve) {
  let status = 200;
  let headers = {};
  return {
    writeHead(nextStatus, nextHeaders = {}) {
      status = nextStatus;
      headers = nextHeaders;
    },
    end(body = "") {
      resolve({ status, headers, body });
    },
  };
}

async function pricingApi(request, context) {
  try {
    const handler = await getHandler();
    return await new Promise(resolve => handler(nodeRequest(request), responseCollector(resolve)));
  } catch (error) {
    context.error("Pricing API initialization failed", error);
    return {
      status: 503,
      jsonBody: { error: { code: "SERVICE_NOT_READY", message: "The pricing service is not ready." } },
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    };
  }
}

app.http("pricingApi", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "{*path}",
  handler: pricingApi,
});
