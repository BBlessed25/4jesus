/**
 * POSTs registration JSON to a Google Apps Script web app via a hidden form + iframe.
 *
 * fetch(..., { mode: "no-cors" }) always appears to "succeed" (opaque response); you cannot
 * tell if doPost ran or failed. A real form POST is what Google’s examples use for web apps.
 *
 * Shape matches Apps Script: timestamp, availableDays (string), areaOfVolunteering (label text).
 */
export function sheetRowPayloadFromForm(formPayload) {
  const days = Array.isArray(formPayload.availableDayLabels)
    ? formPayload.availableDayLabels.join(", ")
    : "";
  return {
    timestamp: formPayload.submittedAt || new Date().toISOString(),
    fullName: formPayload.fullName,
    phone: formPayload.phone,
    gender: formPayload.gender,
    areaOfVolunteering: formPayload.areaLabel || formPayload.areaOfVolunteering || "",
    otherVolunteerArea: formPayload.otherVolunteerArea || "",
    availableDays: days,
    availabilityNotes: formPayload.availabilityNotes || "",
    supportAmount: formPayload.supportAmount || "",
    remittanceDate: formPayload.remittanceDate || "",
  };
}

export function submitRegistrationToGoogleSheet(formPayload) {
  const url = import.meta.env.VITE_GOOGLE_SHEETS_WEB_APP_URL?.trim();
  if (!url) {
    const err = new Error("MISSING_WEB_APP_URL");
    err.code = "MISSING_WEB_APP_URL";
    return Promise.reject(err);
  }

  const payload = sheetRowPayloadFromForm(formPayload);

  return new Promise((resolve, reject) => {
    const iframeName = `gsheet_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const iframe = document.createElement("iframe");
    iframe.setAttribute("name", iframeName);
    iframe.setAttribute("title", "Registration submit");
    iframe.style.cssText = "position:absolute;width:0;height:0;border:0;clip:rect(0,0,0,0)";

    const form = document.createElement("form");
    form.setAttribute("method", "post");
    form.setAttribute("action", url);
    form.setAttribute("target", iframeName);
    form.setAttribute("accept-charset", "UTF-8");

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify(payload);
    form.appendChild(input);

    let submitted = false;
    let timeoutId;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      iframe.onload = null;
      form.remove();
      iframe.remove();
    };

    iframe.onload = () => {
      // Only count loads after submit(); avoids about:blank before the form posts.
      if (!submitted) return;
      cleanup();
      resolve();
    };

    document.body.appendChild(iframe);
    document.body.appendChild(form);

    timeoutId = window.setTimeout(() => {
      if (!submitted) return;
      cleanup();
      reject(new Error("TIMEOUT"));
    }, 45000);

    submitted = true;
    form.submit();
  });
}
