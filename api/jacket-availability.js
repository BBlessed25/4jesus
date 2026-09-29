import {
  backendStatus,
  callAppsScript,
  getServerConfig,
  guardRequest,
  handleEndpointError,
  registrationClosed,
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
    const result = await callAppsScript("availability", undefined, config);
    if (result.ok !== false) result.closed = Boolean(result.closed || registrationClosed(config));
    return sendJson(response, result.ok === false ? backendStatus(result.code) : 200, result);
  } catch (error) {
    return handleEndpointError(response, error);
  }
}
