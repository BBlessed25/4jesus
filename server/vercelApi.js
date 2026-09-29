import { isRegistrationClosed } from "../src/lib/registration.js";

/** @typedef {Error & { code?: string }} CodedError */

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const rateLimitBuckets = new Map();

function headerValue(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function requestIp(request) {
  const forwarded = headerValue(request, "x-forwarded-for");
  return String(forwarded || request.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function requestOriginIsAllowed(request, allowedOrigin) {
  const fetchSite = String(headerValue(request, "sec-fetch-site") || "").toLowerCase();
  if (fetchSite === "cross-site") return false;

  const origin = headerValue(request, "origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === allowedOrigin;
  } catch {
    return false;
  }
}

function withinRateLimit(request, routeName, maximum) {
  const now = Date.now();
  if (rateLimitBuckets.size > 1_000) {
    for (const [bucketKey, bucket] of rateLimitBuckets) {
      if (bucket.resetAt <= now) rateLimitBuckets.delete(bucketKey);
    }
  }
  const key = `${routeName}:${requestIp(request)}`;
  const current = rateLimitBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  current.count += 1;
  return current.count <= maximum;
}

export function resetRateLimitsForTests() {
  rateLimitBuckets.clear();
}

export function sendJson(response, statusCode, payload, origin = "") {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Vary", "Origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  return response.status(statusCode).json(payload);
}

export function guardRequest(
  request,
  response,
  { methods, routeName, allowedOrigin, maximum = 10 }
) {
  const origin = headerValue(request, "origin") || "";
  if (request.method === "OPTIONS") {
    if (!requestOriginIsAllowed(request, allowedOrigin)) {
      sendJson(response, 403, {
        ok: false,
        code: "ORIGIN_NOT_ALLOWED",
        message: "Request origin is not allowed.",
      });
      return false;
    }
    response.setHeader("Access-Control-Allow-Methods", [...methods, "OPTIONS"].join(", "));
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
    response.status(204).end();
    return false;
  }

  if (!methods.includes(request.method)) {
    response.setHeader("Allow", methods.join(", "));
    sendJson(response, 405, {
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed.",
    });
    return false;
  }
  if (!requestOriginIsAllowed(request, allowedOrigin)) {
    sendJson(response, 403, {
      ok: false,
      code: "ORIGIN_NOT_ALLOWED",
      message: "Request origin is not allowed.",
    });
    return false;
  }
  if (!withinRateLimit(request, routeName, maximum)) {
    response.setHeader("Retry-After", String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)));
    sendJson(
      response,
      429,
      { ok: false, code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
      origin
    );
    return false;
  }
  return true;
}

export function getRequestBody(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) {
    if (JSON.stringify(request.body).length > 16_384) {
      const error = /** @type {CodedError} */ (new Error("The request is too large."));
      error.code = "REQUEST_TOO_LARGE";
      throw error;
    }
    return request.body;
  }
  if (typeof request.body === "string") {
    if (request.body.length > 16_384) {
      const error = /** @type {CodedError} */ (new Error("The request is too large."));
      error.code = "REQUEST_TOO_LARGE";
      throw error;
    }
    try {
      return JSON.parse(request.body || "{}");
    } catch {
      const error = /** @type {CodedError} */ (new Error("The request body is invalid."));
      error.code = "INVALID_JSON";
      throw error;
    }
  }
  return {};
}

export function getServerConfig() {
  const config = {
    appsScriptUrl: String(process.env.GOOGLE_APPS_SCRIPT_URL || "").trim(),
    sharedSecret: String(process.env.CHURCH_PROJECT_SHARED_SECRET || "").trim(),
    closesAt: String(process.env.REGISTRATION_CLOSES_AT || "").trim(),
    timezone: String(process.env.APP_TIMEZONE || "").trim(),
    allowedOrigin: String(process.env.ALLOWED_ORIGIN || "").trim(),
  };
  if (
    !config.appsScriptUrl ||
    !config.sharedSecret ||
    !config.closesAt ||
    !config.timezone ||
    !config.allowedOrigin
  ) {
    const error = /** @type {CodedError} */ (
      new Error("Registration service configuration is incomplete.")
    );
    error.code = "CONFIGURATION_ERROR";
    throw error;
  }
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(config.appsScriptUrl)) {
    const error = /** @type {CodedError} */ (new Error("Registration backend URL is invalid."));
    error.code = "CONFIGURATION_ERROR";
    throw error;
  }
  if (!Number.isFinite(new Date(config.closesAt).getTime())) {
    const error = /** @type {CodedError} */ (new Error("Registration closing time is invalid."));
    error.code = "CONFIGURATION_ERROR";
    throw error;
  }
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone }).format(new Date());
  } catch {
    const error = /** @type {CodedError} */ (new Error("Application timezone is invalid."));
    error.code = "CONFIGURATION_ERROR";
    throw error;
  }
  try {
    const allowedOrigin = new URL(config.allowedOrigin);
    const isLocalHttp =
      allowedOrigin.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(allowedOrigin.hostname);
    if (
      allowedOrigin.origin !== config.allowedOrigin ||
      (!isLocalHttp && allowedOrigin.protocol !== "https:")
    ) {
      throw new Error("invalid origin");
    }
  } catch {
    const error = /** @type {CodedError} */ (new Error("Allowed origin is invalid."));
    error.code = "CONFIGURATION_ERROR";
    throw error;
  }
  return config;
}

export async function callAppsScript(action, data, config = getServerConfig()) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(config.appsScriptUrl, {
      method: "POST",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        Accept: "application/json",
      },
      body: JSON.stringify({
        action,
        secret: config.sharedSecret,
        ...(data === undefined ? {} : { data }),
      }),
    });

    const text = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(text);
    } catch {
      const error = /** @type {CodedError} */ (
        new Error("Registration database returned an invalid response.")
      );
      error.code = "GOOGLE_BACKEND_UNAVAILABLE";
      throw error;
    }
    if (!response.ok && responseData.ok !== false) {
      const error = /** @type {CodedError} */ (
        new Error("Registration database is temporarily unavailable.")
      );
      error.code = "GOOGLE_BACKEND_UNAVAILABLE";
      throw error;
    }
    return responseData;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = /** @type {CodedError} */ (
        new Error("Registration database timed out.")
      );
      timeoutError.code = "GOOGLE_BACKEND_UNAVAILABLE";
      throw timeoutError;
    }
    const codedError = /** @type {CodedError} */ (error);
    if (!codedError.code) codedError.code = "GOOGLE_BACKEND_UNAVAILABLE";
    throw codedError;
  } finally {
    clearTimeout(timeout);
  }
}

export function backendStatus(code) {
  return (
    {
      VALIDATION_ERROR: 400,
      UNAUTHORIZED: 502,
      AUTHENTICATION_FAILED: 502,
      DUPLICATE_REGISTRATION: 409,
      SIZE_UNAVAILABLE: 409,
      REGISTRATION_CLOSED: 410,
      INVALID_JSON: 400,
      CONFIGURATION_ERROR: 500,
      GOOGLE_BACKEND_UNAVAILABLE: 503,
    }[code] || 502
  );
}

export function registrationClosed(config = getServerConfig(), now = new Date()) {
  return isRegistrationClosed(config.closesAt, now);
}

export function handleEndpointError(response, error) {
  const code = error?.code || "GOOGLE_BACKEND_UNAVAILABLE";
  const message =
    code === "CONFIGURATION_ERROR"
      ? "Registration service is not configured."
      : code === "REQUEST_TOO_LARGE"
        ? "The request is too large."
        : code === "INVALID_JSON"
          ? "The request body is invalid."
          : "Registration service is temporarily unavailable. Please try again.";
  return sendJson(response, code === "REQUEST_TOO_LARGE" ? 413 : backendStatus(code), {
    ok: false,
    code,
    message,
  });
}
