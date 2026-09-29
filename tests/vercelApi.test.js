import test from "node:test";
import assert from "node:assert/strict";
import availabilityHandler from "../api/jacket-availability.js";
import registerHandler from "../api/register.js";
import { resetRateLimitsForTests } from "../server/vercelApi.js";

function validBody(overrides = {}) {
  return {
    registrationType: "Visitor",
    fullName: "Jordan Smith",
    phone: "416-555-1234",
    email: "jordan@example.com",
    location: "North York",
    age: "27",
    gender: "Female",
    jacketSize: "Small",
    preferredContactMethod: "Email",
    idempotencyKey: "server_test_key_001",
    ...overrides,
  };
}

function mockResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    end() {
      return this;
    },
  };
}

function mockRequest(body, { method = "POST", origin = "", headers = {} } = {}) {
  return {
    method,
    body,
    headers: {
      host: "winter.example.com",
      "x-forwarded-for": "203.0.113.10",
      ...(origin ? { origin } : {}),
      ...headers,
    },
    socket: {},
  };
}

function setEnvironment() {
  process.env.GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/test/exec";
  process.env.CHURCH_PROJECT_SHARED_SECRET = "test-shared-secret";
  process.env.REGISTRATION_CLOSES_AT = "2099-10-02T23:59:59-04:00";
  process.env.APP_TIMEZONE = "America/Toronto";
  process.env.ALLOWED_ORIGIN = "https://winter.example.com";
}

test("Vercel register endpoint independently rejects invalid data", async () => {
  setEnvironment();
  resetRateLimitsForTests();
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("should not be called");
  };
  try {
    const response = mockResponse();
    await registerHandler(mockRequest(validBody({ email: "not-an-email" })), response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "VALIDATION_ERROR");
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Google backend unavailability maps to HTTP 503 without exposing secrets", async () => {
  setEnvironment();
  resetRateLimitsForTests();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("temporary failure containing internal details");
  };
  try {
    const response = mockResponse();
    await registerHandler(mockRequest(validBody()), response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.code, "GOOGLE_BACKEND_UNAVAILABLE");
    assert.equal(
      response.body.message,
      "Registration service is temporarily unavailable. Please try again."
    );
    assert.equal(JSON.stringify(response.body).includes("test-shared-secret"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Vercel register endpoint forwards one authenticated visitor action", async () => {
  setEnvironment();
  resetRateLimitsForTests();
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          ok: true,
          registrationId: "WWS-2026-TEST",
          message: "Thank you for registering. Your details have been saved. See you at the event.",
        });
      },
    };
  };
  try {
    const response = mockResponse();
    await registerHandler(
      mockRequest(validBody(), { origin: "https://winter.example.com" }),
      response
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.registrationId, "WWS-2026-TEST");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://script.google.com/macros/s/test/exec");
    const forwarded = JSON.parse(calls[0].options.body);
    assert.deepEqual(Object.keys(forwarded).sort(), ["action", "data", "secret"]);
    assert.equal(forwarded.action, "registerVisitor");
    assert.equal(forwarded.secret, "test-shared-secret");
    assert.equal(forwarded.data.idempotencyKey, "server_test_key_001");
    assert.equal(JSON.stringify(response.body).includes("test-shared-secret"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("jacket availability endpoint returns JSON instead of SPA HTML", async () => {
  setEnvironment();
  resetRateLimitsForTests();
  const originalFetch = globalThis.fetch;
  let forwarded;
  globalThis.fetch = async (_url, options) => {
    forwarded = JSON.parse(options.body);
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          ok: true,
          closed: false,
          inventory: { Small: 46, Medium: 40, Large: 2, XL: 1, "2XL": 10 },
          internalDebug: "must not reach the browser",
          sizes: [
            { size: "Small", capacity: 46, claimed: 0, remaining: 46, available: true },
            { size: "Medium", capacity: 40, claimed: 0, remaining: 40, available: true },
            { size: "Large", capacity: 2, claimed: 0, remaining: 2, available: true },
            { size: "XL", capacity: 1, claimed: 0, remaining: 1, available: true },
            { size: "2XL", capacity: 10, claimed: 0, remaining: 10, available: true },
          ],
        });
      },
    };
  };
  try {
    const response = mockResponse();
    await availabilityHandler(
      mockRequest(undefined, { method: "GET", origin: "https://winter.example.com" }),
      response
    );

    assert.equal(response.statusCode, 200);
    assert.match(response.headers["Content-Type"], /^application\/json/);
    assert.equal(response.body.ok, true);
    assert.deepEqual(response.body, {
      ok: true,
      closed: false,
      sizes: [
        { size: "Small", available: true },
        { size: "Medium", available: true },
        { size: "Large", available: true },
        { size: "XL", available: true },
        { size: "2XL", available: true },
      ],
    });
    assert.equal(/capacity|claimed|remaining/.test(JSON.stringify(response.body)), false);
    assert.deepEqual(Object.keys(forwarded).sort(), ["action", "secret"]);
    assert.equal(forwarded.action, "availability");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sold-out registration responses do not expose inventory quantities", async () => {
  setEnvironment();
  resetRateLimitsForTests();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async text() {
      return JSON.stringify({
        ok: false,
        code: "SIZE_UNAVAILABLE",
        message: "This size is no longer available. Please select another available size.",
        inventory: { Small: 0 },
        sizes: [{ size: "Small", capacity: 46, claimed: 46, remaining: 0, available: false }],
      });
    },
  });
  try {
    const response = mockResponse();
    await registerHandler(mockRequest(validBody()), response);

    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.body.sizes, [{ size: "Small", available: false }]);
    assert.equal(Object.hasOwn(response.body, "inventory"), false);
    assert.equal(/capacity|claimed|remaining/.test(JSON.stringify(response.body)), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cross-origin browser requests are rejected before Apps Script is called", async () => {
  setEnvironment();
  resetRateLimitsForTests();
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("should not be called");
  };
  try {
    const response = mockResponse();
    await registerHandler(
      mockRequest(validBody(), {
        origin: "https://untrusted.example",
        headers: { "sec-fetch-site": "cross-site" },
      }),
      response
    );
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, "ORIGIN_NOT_ALLOWED");
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing Apps Script URL and shared secret return configuration details", async () => {
  setEnvironment();
  delete process.env.GOOGLE_APPS_SCRIPT_URL;
  delete process.env.CHURCH_PROJECT_SHARED_SECRET;
  resetRateLimitsForTests();
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("should not be called");
  };
  try {
    const response = mockResponse();
    await registerHandler(mockRequest(validBody()), response);
    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, {
      ok: false,
      code: "SERVER_CONFIGURATION_ERROR",
      message: "Registration service is not configured.",
      missing: {
        appsScriptUrl: true,
        sharedSecret: true,
      },
    });
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    setEnvironment();
  }
});
