/**
 * Forwards JSON POST body to Google Apps Script (application/json → doPost).
 *
 * URL resolution (first match wins):
 * 1) GOOGLE_SHEETS_WEB_APP_URL, VITE_GOOGLE_SHEETS_WEB_APP_URL, APPS_SCRIPT_WEB_APP_URL, WEB_APP_URL
 *    → In Netlify, enable these for "Functions" / runtime (not only "Builds"), then redeploy.
 * 2) Fetch this deploy's /sheets-webapp.json (same file as in public/) using Netlify's URL env.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function scriptUrlFromEnv() {
  const v =
    process.env.GOOGLE_SHEETS_WEB_APP_URL ||
    process.env.VITE_GOOGLE_SHEETS_WEB_APP_URL ||
    process.env.APPS_SCRIPT_WEB_APP_URL ||
    process.env.WEB_APP_URL ||
    "";
  return String(v).trim();
}

async function scriptUrlFromDeployedJson() {
  const bases = [
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.DEPLOY_URL,
  ]
    .filter(Boolean)
    .map((b) => String(b).replace(/\/$/, ""));

  for (const root of bases) {
    try {
      const r = await fetch(`${root}/sheets-webapp.json`, { redirect: "follow" });
      if (!r.ok) continue;
      const j = await r.json();
      const u = typeof j.webAppUrl === "string" ? j.webAppUrl.trim() : "";
      if (u) return u;
    } catch {
      /* try next base */
    }
  }
  return "";
}

async function resolveScriptUrl() {
  const fromEnv = scriptUrlFromEnv();
  if (fromEnv) return fromEnv;
  return scriptUrlFromDeployedJson();
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

  const scriptUrl = await resolveScriptUrl();
  if (!scriptUrl) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error:
          "Missing Apps Script URL. In Netlify → Environment variables, add GOOGLE_SHEETS_WEB_APP_URL (same /exec URL) and enable it for Functions (not Builds only), then redeploy. Or keep public/sheets-webapp.json with \"webAppUrl\" set.",
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
