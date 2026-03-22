/**
 * Deploy as Web app: Execute as Me, Who has access: Anyone.
 * After edits: Manage deployments → Edit → New version → Deploy.
 *
 * Browser form posts urlencoded field "payload" (JSON string).
 * Server / Netlify can POST application/json with the same object shape.
 */
var SPREADSHEET_ID = "11AVAaPvCdvIB_yj5ol0a4BxTHNS7IHoUBS-RDBR4Dz8";
var SHEET_NAME = "church_project";
var MAX_REGISTRATIONS = 500;

function doGet() {
  return ContentService.createTextOutput(
    "Volunteer registration web app is running. Submissions use POST from your site."
  ).setMimeType(ContentService.MimeType.TEXT);
}

/**
 * @param {GoogleAppsScript.Events.DoPost} e
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  try {
    var body = getBody_(e);

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }

    // Assume row 1 is a header; cap data rows at MAX_REGISTRATIONS
    if (sheet.getLastRow() >= MAX_REGISTRATIONS + 1) {
      return ContentService.createTextOutput(
        JSON.stringify({
          ok: false,
          error:
            "Registration is full. We have reached the maximum of " +
            MAX_REGISTRATIONS +
            " registrations.",
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    sheet.appendRow([
      body.timestamp || new Date(),
      body.fullName || "",
      body.phone || "",
      body.gender || "",
      body.areaOfVolunteering || "",
      body.otherVolunteerArea || "",
      body.availableDays || "",
      body.availabilityNotes || "",
      body.supportAmount || "",
      body.remittanceDate || "",
    ]);

    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(
      ContentService.MimeType.JSON
    );
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * @param {GoogleAppsScript.Events.DoPost} e
 * @returns {Object}
 */
function getBody_(e) {
  if (e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }
  if (!e.postData || !e.postData.contents) {
    throw new Error("missing post body");
  }
  var type = (e.postData.type || "").toLowerCase();
  if (type.indexOf("application/json") !== -1) {
    return JSON.parse(e.postData.contents);
  }
  if (type.indexOf("application/x-www-form-urlencoded") !== -1) {
    var raw = e.postData.contents;
    var m = raw.match(/(?:^|&)payload=([^&]*)/);
    if (!m) {
      throw new Error("expected form field payload=");
    }
    var decoded = decodeURIComponent(m[1].replace(/\+/g, " "));
    return JSON.parse(decoded);
  }
  return JSON.parse(e.postData.contents);
}
