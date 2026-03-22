/**
 * Option A (recommended): Open your target Google Sheet → Extensions → Apps Script,
 * paste this file, save, then deploy as a Web app.
 *
 * Option B: Standalone project — replace getActiveSpreadsheet() with:
 *   SpreadsheetApp.openById('YOUR_SPREADSHEET_ID_FROM_URL');
 *
 * Deploy → New deployment → Type: Web app
 *   Execute as: Me
 *   Who has access: Anyone
 * Copy the Web app URL into .env as VITE_GOOGLE_SHEETS_WEB_APP_URL=...
 *
 * After changing the script, use Deploy → Manage deployments → Edit (pencil) → Version: New version.
 */
function doPost(e) {
  try {
    var raw = (e.parameter && e.parameter.payload) || "";
    if (!raw && e.postData && e.postData.contents) {
      raw = e.postData.contents;
      var type = (e.postData.type || "").toLowerCase();
      if (type.indexOf("application/x-www-form-urlencoded") !== -1) {
        var m = raw.match(/(?:^|&)payload=([^&]*)/);
        if (m) {
          raw = decodeURIComponent(m[1].replace(/\+/g, " "));
        }
      }
    }
    if (!raw) {
      return jsonOut({ ok: false, error: "missing payload" });
    }
    var d = JSON.parse(raw);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Registrations");
    if (!sheet) {
      sheet = ss.insertSheet("Registrations");
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Submitted (UTC)",
        "Full name",
        "Phone",
        "Gender",
        "Area",
        "Other area",
        "Available days",
        "Availability notes",
        "Support amount",
        "Remittance date",
      ]);
    }
    var days = Array.isArray(d.availableDayLabels) ? d.availableDayLabels.join(", ") : "";
    sheet.appendRow([
      d.submittedAt || new Date().toISOString(),
      d.fullName || "",
      d.phone || "",
      d.gender || "",
      d.areaLabel || d.areaOfVolunteering || "",
      d.otherVolunteerArea || "",
      days,
      d.availabilityNotes || "",
      d.supportAmount || "",
      d.remittanceDate || "",
    ]);
    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
