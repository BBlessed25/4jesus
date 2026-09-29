import {
  backendStatus,
  callAppsScript,
  getServerConfig,
  guardRequest,
  handleEndpointError,
  registrationClosed,
  sanitizeAppsScriptResultForBrowser,
  sendJson,
} from "../server/vercelApi.js";

export default async function handler(request, response) {
  try {
    const config = getServerConfig();
    if (
      !guardRequest(request, response, {
        methods: ["GET"],
        routeName: "availability",
        allowedOrigin: config.allowedOrigin,
        maximum: 30,
      })
    )
      return;
    const internalResult = await callAppsScript("availability", undefined, config);
    const sanitizedResult = sanitizeAppsScriptResultForBrowser(internalResult);
    const result =
      sanitizedResult.ok === false
        ? sanitizedResult
        : {
            ok: true,
            closed: Boolean(sanitizedResult.closed || registrationClosed(config)),
            sizes: Array.isArray(sanitizedResult.sizes) ? sanitizedResult.sizes : [],
          };
    return sendJson(response, result.ok === false ? backendStatus(result.code) : 200, result);
  } catch (error) {
    return handleEndpointError(response, error);
  }
}
