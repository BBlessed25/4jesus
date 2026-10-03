import {
  DUPLICATE_REGISTRATION_MESSAGE,
  isInventoryFull,
  REGISTRATION_CLOSED_MESSAGE,
  validateMemberResponse,
  validateVisitorRegistration,
} from "../src/lib/registration.js";

export const JACKET_LIMITS = Object.freeze({
  Small: 46,
  Medium: 40,
  Large: 2,
  XL: 1,
  "2XL": 10,
});

export function inventoryFromRegistrations(registrations, limits = JACKET_LIMITS) {
  const remaining = { ...limits };
  for (const registration of registrations) {
    if (registration.registrationType !== "Visitor" || registration.status !== "confirmed")
      continue;
    if (Object.hasOwn(remaining, registration.jacketSize)) {
      remaining[registration.jacketSize] = Math.max(0, remaining[registration.jacketSize] - 1);
    }
  }
  return remaining;
}

export function sanitizeSpreadsheetValue(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function createInMemoryRegistrationStore({
  limits = JACKET_LIMITS,
  registrations = [],
  now = () => new Date(),
} = {}) {
  const saved = [...registrations];
  let queue = Promise.resolve();
  let nextId = saved.length + 1;

  const withLock = (operation) => {
    const result = queue.then(operation, operation);
    queue = result.catch(() => undefined);
    return result;
  };

  const closedResponse = () => ({
    ok: false,
    code: "REGISTRATION_CLOSED",
    message: REGISTRATION_CLOSED_MESSAGE,
  });

  const duplicateResponse = () => ({
    ok: false,
    code: "DUPLICATE_REGISTRATION",
    message: DUPLICATE_REGISTRATION_MESSAGE,
  });

  return {
    inventory() {
      return inventoryFromRegistrations(saved, limits);
    },
    availability() {
      return {
        ok: true,
        closed: isInventoryFull(inventoryFromRegistrations(saved, limits)),
        inventory: inventoryFromRegistrations(saved, limits),
      };
    },
    all() {
      return [...saved];
    },
    recordMember(form) {
      return withLock(async () => {
        if (isInventoryFull(inventoryFromRegistrations(saved, limits))) return closedResponse();
        const { errors, value } = validateMemberResponse(form);
        if (Object.keys(errors).length) return { ok: false, code: "VALIDATION_ERROR", errors };
        if (saved.some((item) => item.idempotencyKey === value.idempotencyKey)) {
          return duplicateResponse();
        }

        const registration = {
          ...value,
          status: "recorded",
          submittedAt: now().toISOString(),
          registrationId: `TEST-${String(nextId++).padStart(6, "0")}`,
        };
        saved.push(registration);
        return { ok: true, registrationId: registration.registrationId };
      });
    },
    submitVisitor(form) {
      return withLock(async () => {
        if (isInventoryFull(inventoryFromRegistrations(saved, limits))) return closedResponse();

        const { errors, value } = validateVisitorRegistration(form);
        if (Object.keys(errors).length) return { ok: false, code: "VALIDATION_ERROR", errors };

        const confirmedVisitors = saved.filter(
          (item) => item.registrationType === "Visitor" && item.status === "confirmed"
        );
        if (saved.some((item) => item.idempotencyKey === value.idempotencyKey)) {
          return duplicateResponse();
        }
        if (
          confirmedVisitors.some((item) => item.phone === value.phone || item.email === value.email)
        ) {
          return duplicateResponse();
        }

        const inventory = inventoryFromRegistrations(saved, limits);
        if (inventory[value.jacketSize] <= 0) {
          return {
            ok: false,
            code: "SIZE_UNAVAILABLE",
            message: "This size is no longer available. Please select another available size.",
            inventory,
          };
        }

        const registration = {
          ...value,
          status: "confirmed",
          submittedAt: now().toISOString(),
          registrationId: `TEST-${String(nextId++).padStart(6, "0")}`,
        };
        saved.push(registration);
        return {
          ok: true,
          registrationId: registration.registrationId,
          inventory: inventoryFromRegistrations(saved, limits),
        };
      });
    },
  };
}
