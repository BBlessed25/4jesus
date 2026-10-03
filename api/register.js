import { validateVisitorRegistration } from "../src/lib/registration.js";
import {
  backendStatus,
  callAppsScript,
  getRequestBody,
  getServerConfig,
  guardRequest,
  handleEndpointError,
  sanitizeAppsScriptResultForBrowser,
  sendJson,
} from "../server/vercelApi.js";

export default async function handler(request, response) {
  try {
    const config = getServerConfig();
    if (
      !guardRequest(request, response, {
        methods: ["POST"],
        routeName: "register",
        allowedOrigin: config.allowedOrigin,
        maximum: 10,
      })
    )
      return;
    const body = getRequestBody(request);
    const { errors, value } = validateVisitorRegistration(body);
    if (Object.keys(errors).length) {
      return sendJson(response, 400, {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Please correct the highlighted answer.",
        errors,
      });
    }

    const result = sanitizeAppsScriptResultForBrowser(
      await callAppsScript("registerVisitor", value, config)
    );
    return sendJson(response, result.ok === false ? backendStatus(result.code) : 200, result);
  } catch (error) {
    return handleEndpointError(response, error);
  }
}
