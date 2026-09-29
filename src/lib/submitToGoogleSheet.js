/** @typedef {Error & { code?: string, errors?: Record<string, string>, inventory?: Record<string, number> | null }} RegistrationError */

function inventoryFromSizes(sizes) {
  if (!Array.isArray(sizes)) return null;
  const inventory = {};
  for (const item of sizes) {
    if (!item || typeof item.size !== "string" || !Number.isFinite(Number(item.remaining))) {
      return null;
    }
    inventory[item.size] = Number(item.remaining);
  }
  return inventory;
}

async function requestJson(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const error = /** @type {RegistrationError} */ (new Error("Please try again."));
      error.code = "BAD_RESPONSE";
      throw error;
    }

    if (!response.ok || data.ok === false) {
      const error = /** @type {RegistrationError} */ (
        new Error(data.message || "Registration could not be saved. Please try again.")
      );
      error.code = data.code || "REGISTRATION_FAILED";
      error.errors = data.errors || {};
      error.inventory = inventoryFromSizes(data.sizes) || data.inventory || null;
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = /** @type {RegistrationError} */ (
        new Error("The registration service timed out. Please try again.")
      );
      timeoutError.code = "SERVICE_UNAVAILABLE";
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function fetchJacketAvailability() {
  return requestJson("/api/jacket-availability", { method: "GET", cache: "no-store" }).then(
    (result) => {
      const inventory = inventoryFromSizes(result.sizes);
      if (!inventory) {
        const error = /** @type {RegistrationError} */ (new Error("Please try again."));
        error.code = "BAD_RESPONSE";
        throw error;
      }
      return { ...result, inventory };
    }
  );
}

export function submitVisitorRegistration(payload) {
  return requestJson("/api/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function recordMemberResponse(payload) {
  return requestJson("/api/member-response", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
