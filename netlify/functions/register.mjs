/**
 * Forwards JSON POST body to Google Apps Script (application/json → doPost).
 *
 * Netlify → Site settings → Environment variables (any one of):
 *   GOOGLE_SHEETS_WEB_APP_URL
 *   VITE_GOOGLE_SHEETS_WEB_APP_URL
 *   APPS_SCRIPT_WEB_APP_URL
 *   WEB_APP_URL
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function resolveScriptUrl() {
  const v =
    process.env.GOOGLE_SHEETS_WEB_APP_URL ||
    process.env.VITE_GOOGLE_SHEETS_WEB_APP_URL ||
    process.env.APPS_SCRIPT_WEB_APP_URL ||
    process.env.WEB_APP_URL ||
    "";
  return String(v).trim();
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  }

  const scriptUrl = resolveScriptUrl();
  if (!scriptUrl) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error:
          "Missing Apps Script URL on server. Set GOOGLE_SHEETS_WEB_APP_URL (or VITE_GOOGLE_SHEETS_WEB_APP_URL) in Netlify environment variables.",
      }),
    };
  }

  const body = event.body || "{}";

  const r = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const text = await r.text();

  let statusCode = 200;
  try {
    const j = JSON.parse(text);
    if (j.ok === false) statusCode = 400;
  } catch {
    if (!r.ok) statusCode = 502;
  }

  return {
    statusCode,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: text,
  };
};
