import { createPriceEngine, ENGINE_VERSION, getRequiredEventKeys, PriceEngineError } from "@pmc/price-engine";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

function writeJson(response, status, body, extraHeaders = {}) {
  const data = body === undefined ? "" : JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": JSON_CONTENT_TYPE,
    "Content-Length": Buffer.byteLength(data),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
    ...extraHeaders,
  });
  response.end(data);
}

async function readJson(request, maximumBytes) {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new PriceEngineError("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) throw new PriceEngineError("REQUEST_TOO_LARGE", `Request body cannot exceed ${maximumBytes} bytes.`);
    chunks.push(chunk);
  }
  if (chunks.length === 0) throw new PriceEngineError("INVALID_REQUEST", "A JSON request body is required.");
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("body must be a JSON object");
    return value;
  } catch (error) {
    throw new PriceEngineError("INVALID_REQUEST", `Request JSON is invalid: ${error.message}`);
  }
}

function assertAllowedFields(body, allowed) {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new PriceEngineError("INVALID_REQUEST", `Unsupported request fields: ${unknown.join(", ")}. Prices and totals must never be supplied by the client.`, { unknownFields: unknown });
  }
}

function errorStatus(error) {
  if (!error.code) return 500;
  switch (error.code) {
    case "SERVICE_NOT_READY": return 503;
    case "UNSUPPORTED_MEDIA_TYPE": return 415;
    case "REQUEST_TOO_LARGE": return 413;
    case "NOT_FOUND": return 404;
    case "METHOD_NOT_ALLOWED": return 405;
    case "ORIGIN_NOT_ALLOWED": return 403;
    case "INTERNAL_ERROR": return 500;
    default: return 400;
  }
}

function errorBody(error) {
  return {
    error: {
      code: error.code ?? "INTERNAL_ERROR",
      message: error.code ? error.message : "The pricing service encountered an unexpected error.",
      ...(error.code && error.details !== undefined ? { details: error.details } : {}),
    },
  };
}

function corsHeaders(request, allowedOrigins) {
  const origin = request.headers.origin;
  if (!origin) return {};
  let isSameOrigin = false;
  try {
    isSameOrigin = new URL(origin).host === request.headers.host;
  } catch {
    isSameOrigin = false;
  }
  if (!isSameOrigin && !allowedOrigins.has(origin)) throw new PriceEngineError("ORIGIN_NOT_ALLOWED", "Request origin is not allowed.");
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

function assessCalendarReadiness(ruleSet, calendarStatus, calendarSnapshot, nowMilliseconds) {
  const requiredKeys = getRequiredEventKeys(ruleSet);
  if (requiredKeys.length === 0) return { ready: calendarStatus.ready, requiredKeys, missingKeys: [], staleKeys: [], reasons: [] };
  const reasons = [];
  if (!calendarStatus.ready || calendarStatus.id === "none") reasons.push("missing_snapshot");
  if (!calendarStatus.coverage) reasons.push("missing_coverage");
  const resolvedKeys = calendarStatus.coverage?.resolvedKeys ?? [];
  const missingKeys = requiredKeys.filter((key) => !resolvedKeys.includes(key));
  if (missingKeys.length > 0) reasons.push("unresolved_event_keys");
  const staleKeys = [...new Set((calendarSnapshot?.events ?? [])
    .filter((event) => requiredKeys.includes(event.key) && event.status === "stale")
    .map((event) => event.key))].sort();
  if (staleKeys.length > 0) reasons.push("stale_event_facts");
  if (!calendarStatus.expiresAt) reasons.push("missing_expiration");
  else if (Date.parse(calendarStatus.expiresAt) <= nowMilliseconds) reasons.push("expired_snapshot");
  return { ready: reasons.length === 0, requiredKeys, missingKeys, staleKeys, reasons };
}

function serviceDateSpan(from, untilExclusive) {
  if (typeof from !== "string" || typeof untilExclusive !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(untilExclusive)) return null;
  return (Date.parse(`${untilExclusive}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}

function assertServiceHorizon(from, untilExclusive, maximumNights) {
  const span = serviceDateSpan(from, untilExclusive);
  if (Number.isFinite(span) && span > maximumNights) {
    throw new PriceEngineError("DATE_RANGE_TOO_LARGE", `Public pricing requests cannot exceed ${maximumNights} accommodation dates.`);
  }
}

export function createRequestHandler({
  ruleStore,
  calendarStore,
  allowedOrigins = [],
  maximumBodyBytes = 32_768,
  maximumHorizonDays = 732,
  clock = () => Date.now(),
}) {
  const origins = new Set(allowedOrigins);

  return async function pricingRequestHandler(request, response) {
    let cors = {};
    try {
      cors = corsHeaders(request, origins);
      const url = new URL(request.url, "http://pricing-service.local");

      if (request.method === "OPTIONS") {
        response.writeHead(204, { ...cors, "Content-Length": "0" });
        response.end();
        return;
      }

      if (request.method === "GET" && url.pathname === "/health/live") {
        writeJson(response, 200, { status: "live", engineVersion: ENGINE_VERSION }, cors);
        return;
      }
      if (request.method === "GET" && ["/", "/api"].includes(url.pathname)) {
        writeJson(response, 200, {
          service: "Property Management Codex Pricing Service",
          engineVersion: ENGINE_VERSION,
          endpoints: [
            "GET /health/live",
            "GET /health/ready",
            "GET /v1/rule-set",
            "GET /v1/calendar-snapshot",
            "POST /v1/pricing/evaluate-calendar",
            "POST /v1/pricing/evaluate-stay"
          ],
        }, cors);
        return;
      }
      if (request.method === "GET" && url.pathname === "/health/ready") {
        const calendarStatus = calendarStore.status();
        const calendarAssessment = ruleStore.ready
          ? assessCalendarReadiness(ruleStore.snapshot.ruleSet, calendarStatus, calendarStore.snapshot, clock())
          : { ready: false, requiredKeys: [], missingKeys: [], staleKeys: [], reasons: ["rules_not_ready"] };
        const ready = ruleStore.ready && calendarAssessment.ready;
        writeJson(response, ready ? 200 : 503, {
          status: ready ? "ready" : "not_ready",
          rules: ruleStore.status(),
          calendar: { ...calendarStatus, ...calendarAssessment },
        }, cors);
        return;
      }

      await Promise.all([ruleStore.refreshIfChanged(), calendarStore.refreshIfChanged()]);
      const snapshot = ruleStore.snapshot;
      const calendar = calendarStore.snapshot;
      const engine = createPriceEngine(snapshot.ruleSet, { ruleSetHash: snapshot.hash, calendarSnapshotHash: calendarStore.hash });
      const calendarAssessment = assessCalendarReadiness(snapshot.ruleSet, calendarStore.status(), calendar, clock());

      if (request.method === "GET" && url.pathname === "/v1/rule-set") {
        const responseEtag = `"${snapshot.hash}:${ENGINE_VERSION}"`;
        if (request.headers["if-none-match"] === responseEtag) {
          response.writeHead(304, { ...cors, ETag: responseEtag, "Cache-Control": "no-cache", "Content-Length": "0" });
          response.end();
          return;
        }
        writeJson(response, 200, {
          ruleSet: snapshot.ruleSet,
          metadata: {
            hash: snapshot.hash,
            engineVersion: ENGINE_VERSION,
          },
        }, { ...cors, ETag: responseEtag, "Cache-Control": "no-cache" });
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/calendar-snapshot") {
        if (!calendarAssessment.ready) {
          throw new PriceEngineError("SERVICE_NOT_READY", "The server-owned calendar snapshot is missing, incomplete, or expired for the active rules.", calendarAssessment);
        }
        const responseEtag = `"${calendarStore.hash}"`;
        if (request.headers["if-none-match"] === responseEtag) {
          response.writeHead(304, { ...cors, ETag: responseEtag, "Cache-Control": "no-cache", "Content-Length": "0" });
          response.end();
          return;
        }
        writeJson(response, 200, {
          calendarSnapshot: calendar,
          metadata: { hash: calendarStore.hash },
        }, { ...cors, ETag: responseEtag, "Cache-Control": "no-cache" });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/pricing/evaluate-stay") {
        if (!calendarAssessment.ready) {
          throw new PriceEngineError("SERVICE_NOT_READY", "The server-owned calendar snapshot is missing, incomplete, or expired for the active rules.", calendarAssessment);
        }
        const body = await readJson(request, maximumBodyBytes);
        assertAllowedFields(body, ["checkIn", "checkOut"]);
        assertServiceHorizon(body.checkIn, body.checkOut, maximumHorizonDays);
        writeJson(response, 200, engine.evaluateStay({
          checkIn: body.checkIn,
          checkOut: body.checkOut,
          calendarSnapshot: calendar,
        }), cors);
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/pricing/evaluate-calendar") {
        if (!calendarAssessment.ready) {
          throw new PriceEngineError("SERVICE_NOT_READY", "The server-owned calendar snapshot is missing, incomplete, or expired for the active rules.", calendarAssessment);
        }
        const body = await readJson(request, maximumBodyBytes);
        assertAllowedFields(body, ["from", "through", "assumedStayNights"]);
        const throughMilliseconds = typeof body.through === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.through)
          ? Date.parse(`${body.through}T00:00:00Z`)
          : Number.NaN;
        if (Number.isFinite(throughMilliseconds)) {
          const throughExclusive = new Date(throughMilliseconds + 86_400_000).toISOString().slice(0, 10);
          assertServiceHorizon(body.from, throughExclusive, maximumHorizonDays);
        }
        writeJson(response, 200, engine.evaluateCalendar({
          from: body.from,
          through: body.through,
          ...(body.assumedStayNights === undefined ? {} : { assumedStayNights: body.assumedStayNights }),
          calendarSnapshot: calendar,
        }), cors);
        return;
      }

      const knownPath = ["/", "/api", "/health/live", "/health/ready", "/v1/rule-set", "/v1/calendar-snapshot", "/v1/pricing/evaluate-stay", "/v1/pricing/evaluate-calendar"].includes(url.pathname);
      throw new PriceEngineError(knownPath ? "METHOD_NOT_ALLOWED" : "NOT_FOUND", knownPath ? "HTTP method is not allowed for this endpoint." : "Endpoint not found.");
    } catch (error) {
      writeJson(response, errorStatus(error), errorBody(error), cors);
    }
  };
}
