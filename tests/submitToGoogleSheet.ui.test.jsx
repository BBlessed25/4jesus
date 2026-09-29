import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJacketAvailability, submitVisitorRegistration } from "../src/lib/submitToGoogleSheet";

function jsonResponse(body, { ok = true } = {}) {
  return {
    ok,
    async text() {
      return JSON.stringify(body);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("same-origin Vercel API client", () => {
  it("maps the Apps Script sizes response to the existing inventory model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        closed: false,
        sizes: [
          { size: "Small", capacity: 46, claimed: 1, remaining: 45, available: true },
          { size: "Medium", capacity: 40, claimed: 0, remaining: 40, available: true },
          { size: "Large", capacity: 2, claimed: 0, remaining: 2, available: true },
          { size: "XL", capacity: 1, claimed: 0, remaining: 1, available: true },
          { size: "2XL", capacity: 10, claimed: 0, remaining: 10, available: true },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchJacketAvailability();

    expect(result.inventory).toEqual({ Small: 45, Medium: 40, Large: 2, XL: 1, "2XL": 10 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/jacket-availability",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("submits registration data only to the relative Vercel route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        registrationId: "generated-id",
        message: "Thank you for registering. Your details have been saved. See you at the event.",
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const registration = {
      registrationType: "Visitor",
      fullName: "Jordan Smith",
      idempotencyKey: "browser_test_key_001",
    };

    await submitVisitorRegistration(registration);

    const [path, options] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/register");
    expect(JSON.parse(options.body)).toEqual(registration);
    expect(options.body).not.toContain("CHURCH_PROJECT_SHARED_SECRET");
    expect(options.body).not.toContain("test-shared-secret");
  });

  it("preserves SIZE_UNAVAILABLE handling with sizes responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            ok: false,
            code: "SIZE_UNAVAILABLE",
            message: "This size is no longer available. Please select another available size.",
            sizes: [{ size: "Small", capacity: 46, claimed: 46, remaining: 0, available: false }],
          },
          { ok: false }
        )
      )
    );

    await expect(submitVisitorRegistration({ jacketSize: "Small" })).rejects.toMatchObject({
      code: "SIZE_UNAVAILABLE",
      inventory: { Small: 0 },
    });
  });

  it("rejects non-JSON API responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        async text() {
          return "<!doctype html>";
        },
      })
    );

    await expect(fetchJacketAvailability()).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });
});
