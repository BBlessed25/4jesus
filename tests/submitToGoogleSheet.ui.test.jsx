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
  it("maps public size availability without exposing inventory quantities", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        closed: false,
        sizes: [
          { size: "Small", available: true },
          { size: "Medium", available: true },
          { size: "Large", available: false },
          { size: "XL", available: true },
          { size: "2XL", available: true },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchJacketAvailability();

    expect(result.inventory).toEqual({
      Small: true,
      Medium: true,
      Large: false,
      XL: true,
      "2XL": true,
    });
    expect(JSON.stringify(result)).not.toMatch(/capacity|claimed|remaining/);
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
            sizes: [{ size: "Small", available: false }],
          },
          { ok: false }
        )
      )
    );

    await expect(submitVisitorRegistration({ jacketSize: "Small" })).rejects.toMatchObject({
      code: "SIZE_UNAVAILABLE",
      inventory: { Small: false },
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
