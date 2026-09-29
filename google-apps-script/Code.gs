/**
 * Church_Project Winter Welfare Google Sheets backend.
 *
 * Name both the Google spreadsheet and Apps Script project Church_Project.
 * Bind this script to that spreadsheet, or set a SPREADSHEET_ID Script
 * Property. Set CHURCH_PROJECT_SHARED_SECRET in Project Settings > Script Properties.
 * Deploy as a web app that executes as the owner and is accessible to anyone.
 */
var PROJECT_NAME = "Church_Project";
var SERVICE_IDENTIFIER = PROJECT_NAME;
var SPREADSHEET_NAME = PROJECT_NAME;
var REGISTRATIONS_SHEET = "Registrations";
var INVENTORY_SHEET = "Inventory";
var REGISTRATION_HEADERS = [
  "registration_id",
  "submitted_at",
  "registration_type",
  "full_name",
  "phone",
  "email",
  "location",
  "age",
  "gender",
  "jacket_size",
  "preferred_contact_method",
  "status",
  "idempotency_key",
];
var INVENTORY_HEADERS = ["jacket_size", "capacity", "claimed", "remaining", "available"];
var DEFAULT_INVENTORY = {
  Small: 46,
  Medium: 40,
  Large: 2,
  XL: 1,
  "2XL": 10,
};
var DUPLICATE_MESSAGE = "You have already registered. Please do not register again.";
var SIZE_UNAVAILABLE_MESSAGE =
  "This size is no longer available. Please select another available size.";
var CLOSED_MESSAGE = "Registration is now closed.";
var VISITOR_SUCCESS_MESSAGE =
  "Thank you for registering. Your details have been saved. See you at the event.";
var MEMBER_SUCCESS_MESSAGE =
  "Thank you for registering. Please reach out to your local pastor for additional information.";

function doPost(e) {
  try {
    var request = getRequest_(e);
    if (!authenticateSharedSecret_(request.secret)) {
      return json_({
        ok: false,
        code: "UNAUTHORIZED",
        message: "Unauthorized.",
      });
    }

    if (request.action === "availability") return handleAvailability_(request);
    if (request.action === "registerVisitor") return handleRegisterVisitor_(request);
    if (request.action === "recordMember") return handleRecordMember_(request);

    return json_({ ok: false, code: "UNKNOWN_ACTION", message: "Unknown action." });
  } catch (error) {
    return json_({
      ok: false,
      code: "DATABASE_ERROR",
      message: "The registration database is temporarily unavailable.",
    });
  }
}

function handleAvailability_(request) {
  var sheets = ensureSheets_();
  return json_({
    ok: true,
    closed: isRegistrationClosed_(),
    sizes: availabilitySizes_(sheets.registrations, sheets.inventory),
  });
}

function handleRegisterVisitor_(request) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    lock.waitLock(30000);
    locked = true;

    if (isRegistrationClosed_()) return closedResponse_();

    var validation = validateVisitor_(request.data || {});
    if (!validation.ok) {
      return json_({
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Please correct the highlighted answer.",
        errors: validation.errors,
      });
    }

    var sheets = ensureSheets_();
    var rows = registrationRows_(sheets.registrations);
    var visitor = validation.value;
    if (hasDuplicateIdempotencyKey_(rows, visitor.idempotencyKey)) {
      return duplicateResponse_();
    }
    if (hasPreviousVisitor_(rows, visitor.phone, visitor.email)) {
      return duplicateResponse_();
    }

    var sizes = availabilitySizesFromRows_(rows, sheets.inventory);
    var selectedSize = sizes.filter(function (item) {
      return item.size === visitor.jacketSize;
    })[0];
    if (!selectedSize || !selectedSize.available) {
      return json_({
        ok: false,
        code: "SIZE_UNAVAILABLE",
        message: SIZE_UNAVAILABLE_MESSAGE,
        sizes: sizes,
      });
    }

    var registrationId = newRegistrationId_();
    appendRegistration_(sheets.registrations, {
      registration_id: registrationId,
      submitted_at: new Date(),
      registration_type: "Visitor",
      full_name: visitor.fullName,
      phone: visitor.phone,
      email: visitor.email,
      location: visitor.location,
      age: visitor.age,
      gender: visitor.gender,
      jacket_size: visitor.jacketSize,
      preferred_contact_method: visitor.preferredContactMethod,
      status: "confirmed",
      idempotency_key: visitor.idempotencyKey,
    });

    return json_({
      ok: true,
      registrationId: registrationId,
      message: VISITOR_SUCCESS_MESSAGE,
    });
  } finally {
    if (locked) lock.releaseLock();
  }
}

function handleRecordMember_(request) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    lock.waitLock(30000);
    locked = true;

    if (isRegistrationClosed_()) return closedResponse_();

    var data = request.data || {};
    var errors = {};
    if (data.registrationType !== "Member") {
      errors.registrationType = "Only member responses can be submitted here.";
    }
    if (!/^[A-Za-z0-9_-]{12,100}$/.test(String(data.idempotencyKey || ""))) {
      errors.idempotencyKey = "The registration session is invalid. Please refresh and try again.";
    }
    if (Object.keys(errors).length) {
      return json_({
        ok: false,
        code: "VALIDATION_ERROR",
        message: "The member response is invalid.",
        errors: errors,
      });
    }

    var sheets = ensureSheets_();
    var rows = registrationRows_(sheets.registrations);
    if (hasDuplicateIdempotencyKey_(rows, data.idempotencyKey)) {
      return duplicateResponse_();
    }

    var registrationId = newRegistrationId_();
    appendRegistration_(sheets.registrations, {
      registration_id: registrationId,
      submitted_at: new Date(),
      registration_type: "Member",
      full_name: "",
      phone: "",
      email: "",
      location: "",
      age: "",
      gender: "",
      jacket_size: "",
      preferred_contact_method: "",
      status: "recorded",
      idempotency_key: String(data.idempotencyKey),
    });
    return json_({
      ok: true,
      registrationId: registrationId,
      message: MEMBER_SUCCESS_MESSAGE,
    });
  } finally {
    if (locked) lock.releaseLock();
  }
}

function ensureSheets_() {
  var spreadsheet = getSpreadsheet_();
  var registrations = spreadsheet.getSheetByName(REGISTRATIONS_SHEET);
  if (!registrations) registrations = spreadsheet.insertSheet(REGISTRATIONS_SHEET);
  ensureHeaders_(registrations, REGISTRATION_HEADERS);

  var inventory = spreadsheet.getSheetByName(INVENTORY_SHEET);
  if (!inventory) inventory = spreadsheet.insertSheet(INVENTORY_SHEET);
  ensureInventorySheet_(inventory);
  return { registrations: registrations, inventory: inventory };
}

function ensureInventorySheet_(inventory) {
  if (inventory.getLastRow() === 0) {
    inventory.getRange(1, 1, 1, INVENTORY_HEADERS.length).setValues([INVENTORY_HEADERS]);
    var inventoryRows = Object.keys(DEFAULT_INVENTORY).map(function (size) {
      return [size, DEFAULT_INVENTORY[size]];
    });
    inventory.getRange(2, 1, inventoryRows.length, 2).setValues(inventoryRows);
    inventory.setFrozenRows(1);
  } else {
    ensureHeaders_(inventory, INVENTORY_HEADERS.slice(0, 2));
    inventory.getRange(1, 1, 1, INVENTORY_HEADERS.length).setValues([INVENTORY_HEADERS]);
    if (inventory.getLastRow() === 1) {
      var missingInventoryRows = Object.keys(DEFAULT_INVENTORY).map(function (size) {
        return [size, DEFAULT_INVENTORY[size]];
      });
      inventory.getRange(2, 1, missingInventoryRows.length, 2).setValues(missingInventoryRows);
    }
  }
  inventory.getRange(1, 1, 1, INVENTORY_HEADERS.length).setFontWeight("bold");

  var formulaRows = [];
  for (var row = 2; row <= inventory.getLastRow(); row += 1) {
    formulaRows.push([
      '=COUNTIFS(Registrations!$C:$C,"Visitor",Registrations!$J:$J,A' +
        row +
        ',Registrations!$L:$L,"confirmed")',
      "=MAX(0,B" + row + "-C" + row + ")",
      "=D" + row + ">0",
    ]);
  }
  if (formulaRows.length) {
    inventory.getRange(2, 3, formulaRows.length, 3).setFormulas(formulaRows);
  }
}

function getSpreadsheet_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  var spreadsheet = active;
  if (!spreadsheet) {
    var spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    if (!spreadsheetId)
      throw new Error("No bound " + SERVICE_IDENTIFIER + " spreadsheet or SPREADSHEET_ID.");
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  }
  if (spreadsheet.getName() !== SPREADSHEET_NAME) {
    throw new Error("The Google spreadsheet must be named " + SPREADSHEET_NAME + ".");
  }
  return spreadsheet;
}

function ensureHeaders_(sheet, expectedHeaders) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight("bold");
    return;
  }
  var actual = sheet.getRange(1, 1, 1, expectedHeaders.length).getDisplayValues()[0];
  for (var index = 0; index < expectedHeaders.length; index += 1) {
    if (actual[index] !== expectedHeaders[index]) {
      throw new Error("Unexpected columns in " + sheet.getName() + ".");
    }
  }
}

function registrationRows_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  var values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, REGISTRATION_HEADERS.length)
    .getDisplayValues();
  return values.map(function (row) {
    var item = {};
    REGISTRATION_HEADERS.forEach(function (header, index) {
      item[header] = cleanStoredValue_(row[index]);
    });
    return item;
  });
}

function inventoryCapacities_(sheet) {
  if (sheet.getLastRow() < 2) throw new Error("Inventory worksheet is empty.");
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues();
  var capacities = {};
  values.forEach(function (row) {
    var size = cleanStoredValue_(row[0]);
    var capacity = Number(row[1]);
    if (
      Object.prototype.hasOwnProperty.call(DEFAULT_INVENTORY, size) &&
      Number.isFinite(capacity)
    ) {
      capacities[size] = capacity;
    }
  });
  Object.keys(DEFAULT_INVENTORY).forEach(function (size) {
    if (!Object.prototype.hasOwnProperty.call(capacities, size)) {
      throw new Error("Missing Inventory capacity for " + size + ".");
    }
  });
  return capacities;
}

function calculateAvailability_(registrationsSheet, inventorySheet) {
  return calculateAvailabilityFromRows_(registrationRows_(registrationsSheet), inventorySheet);
}

function availabilitySizes_(registrationsSheet, inventorySheet) {
  return availabilitySizesFromRows_(registrationRows_(registrationsSheet), inventorySheet);
}

function availabilitySizesFromRows_(rows, inventorySheet) {
  var capacities = inventoryCapacities_(inventorySheet);
  var remaining = calculateAvailabilityFromRows_(rows, inventorySheet);
  return Object.keys(DEFAULT_INVENTORY).map(function (size) {
    return {
      size: size,
      capacity: capacities[size],
      claimed: capacities[size] - remaining[size],
      remaining: remaining[size],
      available: remaining[size] > 0,
    };
  });
}

function calculateAvailabilityFromRows_(rows, inventorySheet) {
  var remaining = inventoryCapacities_(inventorySheet);
  rows.forEach(function (row) {
    if (row.registration_type !== "Visitor" || row.status.toLowerCase() !== "confirmed") return;
    if (Object.prototype.hasOwnProperty.call(remaining, row.jacket_size)) {
      remaining[row.jacket_size] = Math.max(0, remaining[row.jacket_size] - 1);
    }
  });
  return remaining;
}

function hasDuplicateIdempotencyKey_(rows, idempotencyKey) {
  return rows.some(function (row) {
    return row.idempotency_key === idempotencyKey;
  });
}

function hasPreviousVisitor_(rows, phone, email) {
  return rows.some(function (row) {
    return (
      row.registration_type === "Visitor" &&
      row.status.toLowerCase() === "confirmed" &&
      (row.phone === phone || row.email.toLowerCase() === email)
    );
  });
}

function appendRegistration_(sheet, registration) {
  var row = REGISTRATION_HEADERS.map(function (header) {
    var value = registration[header];
    return value instanceof Date || typeof value === "number" ? value : sanitizeForSheet_(value);
  });
  sheet.appendRow(row);
}

function validateVisitor_(body) {
  var errors = {};
  var fullName = cleanSpaces_(body.fullName);
  var phone = normalizePhone_(body.phone);
  var email = String(body.email || "")
    .trim()
    .toLowerCase();
  var location = cleanSpaces_(body.location);
  var ageText = String(body.age == null ? "" : body.age).trim();
  var age = Number(ageText);
  var namePattern =
    /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]*(\s+[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]*)+$/;

  if (body.registrationType !== "Visitor")
    errors.registrationType = "Only visitor registrations can be submitted.";
  if (!namePattern.test(fullName)) errors.fullName = "Please enter your full name correctly.";
  if (!phone)
    errors.phone = "Phone format not supported. Please enter a valid Canadian phone number.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    errors.email = "Please enter a valid email address.";
  if (!location) errors.location = "Please enter your city or area.";
  if (!/^\d+$/.test(ageText) || age < 12 || age > 120)
    errors.age = "You must be at least 12 years old to register.";
  if (body.gender !== "Male" && body.gender !== "Female")
    errors.gender = "Please select your gender.";
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_INVENTORY, body.jacketSize))
    errors.jacketSize = "Please select an available jacket size.";
  if (body.preferredContactMethod !== "Phone" && body.preferredContactMethod !== "Email") {
    errors.preferredContactMethod = "Please select your preferred contact method.";
  }
  if (!/^[A-Za-z0-9_-]{12,100}$/.test(String(body.idempotencyKey || ""))) {
    errors.idempotencyKey = "The registration session is invalid. Please refresh and try again.";
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors: errors,
    value: {
      fullName: fullName,
      phone: phone,
      email: email,
      location: location,
      age: age,
      gender: body.gender,
      jacketSize: body.jacketSize,
      preferredContactMethod: body.preferredContactMethod,
      idempotencyKey: String(body.idempotencyKey || ""),
    },
  };
}

function authenticateSharedSecret_(providedSecret) {
  var expectedSecret = PropertiesService.getScriptProperties().getProperty(
    "CHURCH_PROJECT_SHARED_SECRET"
  );
  if (!expectedSecret || !providedSecret) return false;
  var provided = String(providedSecret);
  if (provided.length !== expectedSecret.length) return false;
  var difference = 0;
  for (var index = 0; index < expectedSecret.length; index += 1) {
    difference |= expectedSecret.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  return difference === 0;
}

function isRegistrationClosed_() {
  var propertyValue = PropertiesService.getScriptProperties().getProperty("REGISTRATION_CLOSES_AT");
  var closesAt = propertyValue;
  var timezone = Session.getScriptTimeZone();
  if (!closesAt) throw new Error("Missing REGISTRATION_CLOSES_AT Script Property.");
  Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd HH:mm:ss");
  var timestamp = new Date(closesAt).getTime();
  if (!Number.isFinite(timestamp)) throw new Error("Invalid registration closing time.");
  return new Date().getTime() > timestamp;
}

function sanitizeForSheet_(value) {
  var text = String(value == null ? "" : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function cleanStoredValue_(value) {
  var text = String(value == null ? "" : value);
  return text.charAt(0) === "'" ? text.slice(1) : text;
}

function cleanSpaces_(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizePhone_(value) {
  var digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.charAt(0) === "1") digits = digits.slice(1);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return "";
  return "+1 " + digits.slice(0, 3) + "-" + digits.slice(3, 6) + "-" + digits.slice(6);
}

function newRegistrationId_() {
  return "WWS-2026-" + Utilities.getUuid().split("-")[0].toUpperCase();
}

function duplicateResponse_() {
  return json_({ ok: false, code: "DUPLICATE_REGISTRATION", message: DUPLICATE_MESSAGE });
}

function closedResponse_() {
  return json_({ ok: false, code: "REGISTRATION_CLOSED", message: CLOSED_MESSAGE });
}

function getRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error("Missing post body.");
  return JSON.parse(e.postData.contents);
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON
  );
}
