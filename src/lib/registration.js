export const JACKET_SIZES = Object.freeze(["Small", "Medium", "Large", "XL", "2XL"]);

export const VISITOR_FIELDS = Object.freeze([
  "registrationType",
  "fullName",
  "phone",
  "email",
  "location",
  "age",
  "gender",
  "jacketSize",
  "preferredContactMethod",
]);

export const MEMBER_CONFIRMATION =
  "Thank you for registering. Please reach out to your local pastor for additional information.";

export const VISITOR_CONFIRMATION =
  "Thank you for registering. Your details have been saved. See you at the event.";

export const DUPLICATE_REGISTRATION_MESSAGE =
  "You have already registered. Please do not register again.";

export const REGISTRATION_CLOSED_MESSAGE = "Registration is now closed.";

export const FIELD_ERRORS = Object.freeze({
  registrationType: "Please select Member or Visitor.",
  fullName: "Please enter your full name correctly.",
  phone: "Phone format not supported. Please enter a valid Canadian phone number.",
  email: "Please enter a valid email address.",
  location: "Please enter your city or area.",
  age: "You must be at least 12 years old to register.",
  gender: "Please select your gender.",
  jacketSize: "Please select an available jacket size.",
  preferredContactMethod: "Please select your preferred contact method.",
});

export function cleanSpaces(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function isValidFullName(value) {
  const name = cleanSpaces(value);
  return /^[\p{L}][\p{L}\p{M}'’.-]*(?:\s+[\p{L}][\p{L}\p{M}'’.-]*)+$/u.test(name);
}

export function normalizeCanadianPhone(value) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  return `+1 ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function normalizeEmail(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function isValidEmail(value) {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function validateField(field, value, context = {}) {
  switch (field) {
    case "registrationType":
      return value === "Member" || value === "Visitor" ? "" : FIELD_ERRORS.registrationType;
    case "fullName":
      return isValidFullName(value) ? "" : FIELD_ERRORS.fullName;
    case "phone":
      return normalizeCanadianPhone(value) ? "" : FIELD_ERRORS.phone;
    case "email":
      return isValidEmail(value) ? "" : FIELD_ERRORS.email;
    case "location":
      return cleanSpaces(value) ? "" : FIELD_ERRORS.location;
    case "age": {
      const ageText = String(value ?? "").trim();
      const age = Number(ageText);
      return /^\d+$/.test(ageText) && age >= 12 && age <= 120 ? "" : FIELD_ERRORS.age;
    }
    case "gender":
      return value === "Male" || value === "Female" ? "" : FIELD_ERRORS.gender;
    case "jacketSize": {
      if (!JACKET_SIZES.includes(value)) return FIELD_ERRORS.jacketSize;
      if (context.inventory && Number(context.inventory[value]) <= 0) {
        return "This size is no longer available. Please select another available size.";
      }
      return "";
    }
    case "preferredContactMethod":
      return value === "Phone" || value === "Email" ? "" : FIELD_ERRORS.preferredContactMethod;
    default:
      return "";
  }
}

export function normalizeVisitorRegistration(form) {
  return {
    registrationType: "Visitor",
    fullName: cleanSpaces(form.fullName),
    phone: normalizeCanadianPhone(form.phone) || cleanSpaces(form.phone),
    email: normalizeEmail(form.email),
    location: cleanSpaces(form.location),
    age: Number(String(form.age ?? "").trim()),
    gender: form.gender,
    jacketSize: form.jacketSize,
    preferredContactMethod: form.preferredContactMethod,
    idempotencyKey: cleanSpaces(form.idempotencyKey),
  };
}

export function validateVisitorRegistration(form, context = {}) {
  const errors = {};
  for (const field of VISITOR_FIELDS) {
    const error = validateField(field, form[field], context);
    if (error) errors[field] = error;
  }
  if (form.registrationType !== "Visitor") {
    errors.registrationType = "Only visitor registrations can be submitted.";
  }
  if (!/^[A-Za-z0-9_-]{12,100}$/.test(String(form.idempotencyKey ?? ""))) {
    errors.idempotencyKey = "The registration session is invalid. Please refresh and try again.";
  }
  return { errors, value: normalizeVisitorRegistration(form) };
}

export function validateMemberResponse(form) {
  const errors = {};
  if (form.registrationType !== "Member") {
    errors.registrationType = "Only member responses can be submitted here.";
  }
  if (!/^[A-Za-z0-9_-]{12,100}$/.test(String(form.idempotencyKey ?? ""))) {
    errors.idempotencyKey = "The registration session is invalid. Please refresh and try again.";
  }
  return {
    errors,
    value: {
      registrationType: "Member",
      idempotencyKey: cleanSpaces(form.idempotencyKey),
    },
  };
}

export function isRegistrationClosed(closesAt, now = new Date()) {
  const closingTime = new Date(closesAt).getTime();
  return Number.isFinite(closingTime) && now.getTime() > closingTime;
}

export function firstInvalidVisitorField(form, context = {}) {
  const { errors } = validateVisitorRegistration(form, context);
  return VISITOR_FIELDS.find((field) => errors[field]) || null;
}

export function destinationForRegistrationType(registrationType) {
  if (registrationType === "Member") return "memberConfirmation";
  if (registrationType === "Visitor") return "fullName";
  return "registrationType";
}
