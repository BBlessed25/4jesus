import test from "node:test";
import assert from "node:assert/strict";
import {
  FIELD_ERRORS,
  normalizeCanadianPhone,
  validateField,
  validateVisitorRegistration,
} from "../src/lib/registration.js";
import {
  createInMemoryRegistrationStore,
  JACKET_LIMITS,
  sanitizeSpreadsheetValue,
} from "../server/registrationCore.js";

function validForm(overrides = {}) {
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
    idempotencyKey: "registration_key_001",
    ...overrides,
  };
}

function confirmedVisitor(overrides = {}) {
  return {
    ...validForm(),
    age: 27,
    phone: "+1 416-555-1234",
    status: "confirmed",
    registrationId: "EXISTING-1",
    ...overrides,
  };
}

test("invalid frontend and server-side visitor data is rejected", () => {
  assert.equal(validateField("fullName", "Jordan7"), FIELD_ERRORS.fullName);
  assert.equal(validateField("email", "person@example"), FIELD_ERRORS.email);
  assert.equal(validateField("age", "11"), FIELD_ERRORS.age);
  const { errors } = validateVisitorRegistration(validForm({ fullName: "", phone: "" }));
  assert.ok(errors.fullName);
  assert.ok(errors.phone);
});

test("common Canadian phone formats normalize consistently", () => {
  for (const phone of ["4165551234", "416-555-1234", "(416) 555-1234", "+1 416 555 1234"]) {
    assert.equal(normalizeCanadianPhone(phone), "+1 416-555-1234");
  }
});

test("member responses are recorded without reducing inventory", async () => {
  const store = createInMemoryRegistrationStore();
  const before = store.inventory();
  const result = await store.recordMember({
    registrationType: "Member",
    idempotencyKey: "member_response_key_001",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(store.inventory(), before);
  assert.equal(store.all()[0].status, "recorded");
});

test("a valid visitor registration succeeds and reserves one jacket", async () => {
  const store = createInMemoryRegistrationStore();
  const result = await store.submitVisitor(validForm());
  assert.equal(result.ok, true);
  assert.match(result.registrationId, /^TEST-/);
  assert.equal(store.inventory().Small, JACKET_LIMITS.Small - 1);
  assert.equal(store.all()[0].status, "confirmed");
});

test("visitors aged 12 can register, while visitors under 12 are rejected", async () => {
  const store = createInMemoryRegistrationStore();
  const underage = await store.submitVisitor(validForm({ age: "11" }));
  assert.equal(underage.code, "VALIDATION_ERROR");
  assert.equal(underage.errors.age, FIELD_ERRORS.age);
  assert.equal(store.all().length, 0);

  const eligible = await store.submitVisitor(validForm({ age: "12" }));
  assert.equal(eligible.ok, true);
  assert.equal(store.all()[0].age, 12);
});

for (const [size, limit] of Object.entries(JACKET_LIMITS)) {
  test(`${size} reaches its capacity of ${limit}`, async () => {
    const registrations = Array.from({ length: limit }, (_, index) =>
      confirmedVisitor({
        jacketSize: size,
        phone: `+1 416-555-${String(index).padStart(4, "0")}`,
        email: `${size.toLowerCase()}${index}@example.com`,
        idempotencyKey: `${size}_existing_key_${index}`,
        registrationId: `${size}-${index}`,
      })
    );
    const store = createInMemoryRegistrationStore({ registrations });
    const result = await store.submitVisitor(
      validForm({ jacketSize: size, idempotencyKey: `new_${size}_registration` })
    );
    assert.equal(store.inventory()[size], 0);
    assert.equal(result.code, "SIZE_UNAVAILABLE");
  });
}

test("two simultaneous attempts cannot both claim the final jacket", async () => {
  const store = createInMemoryRegistrationStore({ limits: { ...JACKET_LIMITS, XL: 1 } });
  const results = await Promise.all([
    store.submitVisitor(
      validForm({
        jacketSize: "XL",
        email: "one@example.com",
        idempotencyKey: "simultaneous_key_one",
      })
    ),
    store.submitVisitor(
      validForm({
        jacketSize: "XL",
        phone: "647-555-1234",
        email: "two@example.com",
        idempotencyKey: "simultaneous_key_two",
      })
    ),
  ]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => result.code === "SIZE_UNAVAILABLE").length, 1);
});

test("a duplicate normalized phone number is rejected", async () => {
  const store = createInMemoryRegistrationStore({ registrations: [confirmedVisitor()] });
  const result = await store.submitVisitor(
    validForm({ email: "different@example.com", idempotencyKey: "different_phone_key_001" })
  );
  assert.equal(result.code, "DUPLICATE_REGISTRATION");
});

test("a duplicate normalized email address is rejected", async () => {
  const store = createInMemoryRegistrationStore({ registrations: [confirmedVisitor()] });
  const result = await store.submitVisitor(
    validForm({ phone: "647-555-1234", idempotencyKey: "different_email_key_001" })
  );
  assert.equal(result.code, "DUPLICATE_REGISTRATION");
});

test("a duplicate idempotency key is rejected without a second row", async () => {
  const store = createInMemoryRegistrationStore();
  const form = validForm({ idempotencyKey: "duplicate_registration_key" });
  assert.equal((await store.submitVisitor(form)).ok, true);
  const duplicate = await store.submitVisitor(form);
  assert.equal(duplicate.code, "DUPLICATE_REGISTRATION");
  assert.equal(store.all().length, 1);
});

test("registration remains open after the displayed closing date while jackets remain", async () => {
  const store = createInMemoryRegistrationStore({
    now: () => new Date("2026-10-04T00:00:00-04:00"),
  });
  const result = await store.submitVisitor(validForm());
  assert.equal(result.ok, true);
  assert.equal(store.all().length, 1);
  assert.equal(store.availability().closed, false);
});

test("a size sold out between selection and submission returns SIZE_UNAVAILABLE", async () => {
  const store = createInMemoryRegistrationStore({ limits: { ...JACKET_LIMITS, XL: 1 } });
  assert.equal(store.availability().inventory.XL, 1);
  await store.submitVisitor(validForm({ jacketSize: "XL", idempotencyKey: "first_final_xl_key" }));
  const stale = await store.submitVisitor(
    validForm({
      jacketSize: "XL",
      phone: "647-555-1234",
      email: "stale@example.com",
      idempotencyKey: "stale_final_xl_key",
    })
  );
  assert.equal(stale.code, "SIZE_UNAVAILABLE");
});

test("spreadsheet formula prefixes are escaped", () => {
  for (const value of ["=IMPORTXML()", "+cmd", "-1+2", "@formula"]) {
    assert.equal(sanitizeSpreadsheetValue(value), `'${value}`);
  }
  assert.equal(sanitizeSpreadsheetValue("Toronto"), "Toronto");
});

test("registration closes when concurrent attempts claim the last jacket across all sizes", async () => {
  const store = createInMemoryRegistrationStore({
    limits: { Small: 0, Medium: 0, Large: 0, XL: 1, "2XL": 0 },
    now: () => new Date("2026-10-04T12:00:00-04:00"),
  });
  assert.equal(store.availability().closed, false);
  const results = await Promise.all([
    store.submitVisitor(validForm({ jacketSize: "XL" })),
    store.submitVisitor(
      validForm({
        jacketSize: "XL",
        phone: "647-555-1234",
        email: "second@example.com",
        idempotencyKey: "last_jacket_second_key",
      })
    ),
  ]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => result.code === "REGISTRATION_CLOSED").length, 1);
  assert.equal(store.availability().closed, true);
  assert.equal(store.all().length, 1);
});
