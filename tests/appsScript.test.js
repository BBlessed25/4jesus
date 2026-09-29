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

test("Apps Script enforces the closing date while holding its lock", () => {
  const source = readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
  let lockHeld = false;
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
      formatDate: () => "2000-01-01 00:00:00",
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

  const response = context.doPost({
    postData: {
      contents: JSON.stringify({
        action: "registerVisitor",
        secret: "correct-secret-value",
        data: {},
      }),
    },
  });
  const body = JSON.parse(response.text);
  assert.equal(body.code, "REGISTRATION_CLOSED");
  assert.equal(lockHeld, false);
});

test("Apps Script appends one visitor row, rejects its replay, and preserves inventory for members", () => {
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
  const context = {
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (name) =>
          ({
            CHURCH_PROJECT_SHARED_SECRET: "correct-secret-value",
            REGISTRATION_CLOSES_AT: "2099-10-02T23:59:59-04:00",
          })[name] || null,
      }),
    },
    LockService: {
      getScriptLock: () => ({ waitLock() {}, releaseLock() {} }),
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

  const visitorResult = post("registerVisitor", visitor);
  assert.equal(visitorResult.ok, true);
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
