/**
 * Netlify: build sets VITE_REGISTRATION_API=/api/register → POST JSON via serverless
 * function (reliable; matches Apps Script application/json).
 *
 * Local dev: no VITE_REGISTRATION_API → hidden form POST to Apps Script web app URL.
 */
let sheetsWebAppJsonFetch = null;

async function resolveSheetsWebAppUrl() {
  const envUrl = import.meta.env.VITE_GOOGLE_SHEETS_WEB_APP_URL?.trim();
  if (envUrl) return envUrl;

  if (!sheetsWebAppJsonFetch) {
    const base = import.meta.env.BASE_URL || "/";
    sheetsWebAppJsonFetch = fetch(`${base}sheets-webapp.json`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => (typeof j?.webAppUrl === "string" ? j.webAppUrl.trim() : ""))
      .catch(() => "");
  }
  const fromPublic = await sheetsWebAppJsonFetch;
  return fromPublic || "";
}

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
    volunteerHours: formPayload.volunteerHours || "",
  };
}

async function submitViaNetlifyFunction(payload) {
  const path = import.meta.env.VITE_REGISTRATION_API?.trim();
  if (!path) return false;

  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const err = new Error("Registration service returned an invalid response.");
    err.code = "BAD_RESPONSE";
    throw err;
  }

  if (!res.ok || data.ok === false) {
    const err = new Error(
      typeof data.error === "string" && data.error
        ? data.error
        : "Registration could not be saved. Try again or contact the team."
    );
    err.code = "REGISTRATION_FAILED";
    throw err;
  }

  return true;
}

function submitViaIframeForm(url, payload) {
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

export async function submitRegistrationToGoogleSheet(formPayload) {
  const payload = sheetRowPayloadFromForm(formPayload);

  const usedProxy = await submitViaNetlifyFunction(payload);
  if (usedProxy) return;

  const url = await resolveSheetsWebAppUrl();
  if (!url) {
    const err = new Error("MISSING_WEB_APP_URL");
    err.code = "MISSING_WEB_APP_URL";
    throw err;
  }

  await submitViaIframeForm(url, payload);
}
