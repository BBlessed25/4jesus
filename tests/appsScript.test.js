import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("Apps Script rejects an invalid shared secret before accessing Sheets", () => {
  const source = readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (name) =>
          ({
            CHURCH_PROJECT_SHARED_SECRET: "correct-secret-value",
            REGISTRATION_CLOSES_AT: "2000-01-01T00:00:00-05:00",
          })[name] || null,
      }),
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({
        text,
        setMimeType() {
          return this;
        },
      }),
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  const response = context.doPost({
    postData: {
      contents: JSON.stringify({ action: "availability", secret: "wrong-secret-value" }),
    },
  });
  const body = JSON.parse(response.text);
  assert.equal(body.ok, false);
  assert.equal(body.code, "UNAUTHORIZED");
});

function createAppsScriptHarness({ closesAt = "2000-01-01T00:00:00-05:00" } = {}) {
  const source = readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");

  class FakeRange {
    constructor(sheet, row, column, rowCount, columnCount) {
      this.sheet = sheet;
      this.row = row - 1;
      this.column = column - 1;
      this.rowCount = rowCount;
      this.columnCount = columnCount;
    }

    setValues(values) {
      for (let rowIndex = 0; rowIndex < this.rowCount; rowIndex += 1) {
        const targetRow = this.row + rowIndex;
        if (!this.sheet.rows[targetRow]) this.sheet.rows[targetRow] = [];
        for (let columnIndex = 0; columnIndex < this.columnCount; columnIndex += 1) {
          this.sheet.rows[targetRow][this.column + columnIndex] = values[rowIndex][columnIndex];
        }
      }
      return this;
    }

    setFormulas(values) {
      return this.setValues(values);
    }

    getDisplayValues() {
      return Array.from({ length: this.rowCount }, (_, rowIndex) =>
        Array.from({ length: this.columnCount }, (_, columnIndex) =>
          String(this.sheet.rows[this.row + rowIndex]?.[this.column + columnIndex] ?? "")
        )
      );
    }

    setFontWeight() {
      return this;
    }
  }

  class FakeSheet {
    constructor(name) {
      this.name = name;
      this.rows = [];
    }

    getName() {
      return this.name;
    }

    getLastRow() {
      return this.rows.length;
    }

    getRange(row, column, rowCount, columnCount) {
      return new FakeRange(this, row, column, rowCount, columnCount);
    }

    setFrozenRows() {}

    appendRow(row) {
      assert.equal(lockHeld, true, "registration writes must hold the lock");
      this.rows.push([...row]);
    }
  }

  const sheets = new Map();
  const spreadsheet = {
    getName: () => "Church_Project",
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet(name) {
      const sheet = new FakeSheet(name);
      sheets.set(name, sheet);
      return sheet;
    },
  };
  let nextUuid = 1;
  let lockHeld = false;
  const context = {
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (name) =>
          ({
            CHURCH_PROJECT_SHARED_SECRET: "correct-secret-value",
            REGISTRATION_CLOSES_AT: closesAt,
          })[name] || null,
      }),
    },
    LockService: {
      getScriptLock: () => ({
        waitLock() {
          lockHeld = true;
        },
        releaseLock() {
          lockHeld = false;
        },
      }),
    },
    Utilities: {
      formatDate: () => "2026-09-29 12:00:00",
      getUuid: () => `0000000${nextUuid++}-0000-0000-0000-000000000000`,
    },
    Session: { getScriptTimeZone: () => "America/Toronto" },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({
        text,
        setMimeType() {
          return this;
        },
      }),
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  const post = (action, data) =>
    JSON.parse(
      context.doPost({
        postData: {
          contents: JSON.stringify({
            action,
            secret: "correct-secret-value",
            data,
          }),
        },
      }).text
    );

  return { post, sheets, lockHeld: () => lockHeld };
}

const visitor = {
  registrationType: "Visitor",
  fullName: "Jordan Smith",
  phone: "416-555-1234",
  email: "jordan@example.com",
  location: "North York",
  age: "27",
  gender: "Female",
  jacketSize: "Small",
  preferredContactMethod: "Email",
  idempotencyKey: "sheet_test_key_001",
};

test("Apps Script accepts age 12 and rejects age 11 without reserving a jacket", () => {
  const { post, sheets } = createAppsScriptHarness();
  const underage = post("registerVisitor", { ...visitor, age: "11" });
  assert.equal(underage.code, "VALIDATION_ERROR");
  assert.equal(underage.errors.age, "You must be at least 12 years old to register.");

  const eligible = post("registerVisitor", { ...visitor, age: "12" });
  assert.equal(eligible.ok, true);
  assert.equal(sheets.get("Registrations").rows.length, 2);
  assert.equal(sheets.get("Registrations").rows[1][7], 12);
});

test("Apps Script accepts visitors after the date, rejects replay, and preserves inventory for members", () => {
  const { post, sheets, lockHeld } = createAppsScriptHarness();
  assert.equal(post("availability").closed, false);

  const visitorResult = post("registerVisitor", visitor);
  assert.equal(visitorResult.ok, true);
  assert.equal(lockHeld(), false);
  assert.match(visitorResult.registrationId, /^WWS-2026-/);
  assert.equal(
    visitorResult.message,
    "Thank you for registering. Your details have been saved. See you at the event."
  );
  assert.equal(sheets.get("Registrations").rows.length, 2);
  assert.match(sheets.get("Inventory").rows[1][2], /^=COUNTIFS/);
  assert.equal(sheets.get("Inventory").rows[1][3], "=MAX(0,B2-C2)");
  assert.equal(sheets.get("Inventory").rows[1][4], "=D2>0");

  const duplicate = post("registerVisitor", visitor);
  assert.equal(duplicate.code, "DUPLICATE_REGISTRATION");
  assert.equal(sheets.get("Registrations").rows.length, 2);
  const smallAfterVisitor = post("availability", {}).sizes.find((item) => item.size === "Small");
  assert.deepEqual(JSON.parse(JSON.stringify(smallAfterVisitor)), {
    size: "Small",
    capacity: 46,
    claimed: 1,
    remaining: 45,
    available: true,
  });

  const member = post("recordMember", {
    registrationType: "Member",
    idempotencyKey: "member_sheet_key_001",
  });
  assert.equal(member.ok, true);
  assert.equal(
    member.message,
    "Registration could not be completed. Please reach out to your Area coordinator or local pastor for more information."
  );
  assert.equal(sheets.get("Registrations").rows.length, 3);
  assert.equal(post("availability", {}).sizes.find((item) => item.size === "Small").remaining, 45);
});

test("Apps Script works without a closing date and closes only after the last jacket is reserved", () => {
  const { post, sheets, lockHeld } = createAppsScriptHarness({ closesAt: null });
  post("availability");
  for (const row of sheets.get("Inventory").rows.slice(1)) {
    row[1] = row[0] === "XL" ? 1 : 0;
  }
  assert.equal(post("availability").closed, false);
  const unavailable = post("registerVisitor", visitor);
  assert.equal(unavailable.code, "SIZE_UNAVAILABLE");
  assert.equal(lockHeld(), false);

  assert.equal(post("registerVisitor", { ...visitor, jacketSize: "XL" }).ok, true);
  const availability = post("availability");
  assert.equal(availability.closed, true);
  assert.equal(
    availability.sizes.every((size) => !size.available),
    true
  );

  const denied = post("registerVisitor", {
    ...visitor,
    jacketSize: "XL",
    phone: "647-555-1234",
    email: "second@example.com",
    idempotencyKey: "last_jacket_second_key",
  });
  assert.equal(denied.code, "REGISTRATION_CLOSED");
  assert.equal(lockHeld(), false);
  assert.equal(sheets.get("Registrations").rows.length, 2);
  assert.equal(
    post("recordMember", {
      registrationType: "Member",
      idempotencyKey: "member_after_full_key",
    }).code,
    "REGISTRATION_CLOSED"
  );
});
