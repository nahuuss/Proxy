import type { CoreNtlmSessionCredentials } from "./auth-ntlm";
import {
  buildCoreNtlmValidationUrlForConnector,
  getConnectorCoreNtlmDefaultDomain,
} from "./product-profiles";
import {
  createCoreNtlmRequestOptions,
} from "./proxy-ntlm";
import {
  collectNtlmRequestBody,
  resolveRequestNtlmMethod,
  startNtlmHeartbeatShieldIfNeeded,
} from "./proxy-ntlm-handshake-common";
import {
  handleCoreNtlmError,
  handleCoreNtlmSuccess,
  type NtlmCallbackResponse,
} from "./proxy-ntlm-callbacks";
import { buildCrmNtlmHeaders } from "./proxy-crm-ntlm";
import { resolveProfileLabel } from "./proxy-server-request-context";
import type { HandleProxyNtlmHandshakeInput } from "./proxy-server-ntlm";

export function runCoreNtlmHandshake(
  input: HandleProxyNtlmHandshakeInput,
  credentials: CoreNtlmSessionCredentials,
): void {
  collectNtlmRequestBody(input.req, (body) => {
    const ntlmFn = resolveRequestNtlmMethod({
      registry: input.httpntlmRegistry,
      resolveMethod: input.resolveNtlmMethodFn,
      method: input.req.method,
    });
    const queryIdx = (input.req.url || "").indexOf("?");
    const queryString = queryIdx !== -1 ? (input.req.url || "").substring(queryIdx) : "";
    const validationBaseUrl = buildCoreNtlmValidationUrlForConnector(input.connector);
    const coreDefaultDomain = getConnectorCoreNtlmDefaultDomain(input.connector);

    if (!validationBaseUrl) {
      input.logHB(
        `[CORE-NTLM-ERR] ${input.req.method} ${input.req.url} -> el perfil ${resolveProfileLabel(input.connector)} no definio URL Core NTLM`,
      );
      return;
    }

    startNtlmHeartbeatShieldIfNeeded(input.hbEligible, input.startHeartbeatShield);

    const ntlmHeaders = buildCrmNtlmHeaders(input.req.headers, body.length);
    ntlmFn(
      createCoreNtlmRequestOptions({
        username: credentials.username,
        password: credentials.password,
        domain: credentials.domain || coreDefaultDomain || "",
        validationUrl: validationBaseUrl + queryString,
        body,
        headers: ntlmHeaders,
        agent: input.agent,
      }),
      (error: Error | null, ntlmRes: NtlmCallbackResponse) => {
        input.clearHeartbeatTimers();

        if (error) {
          input.logHB(`[CORE-NTLM-ERR] ${input.req.method} ${input.req.url} -> ${error.message}`);
          handleCoreNtlmError({
            connector: input.connector,
            req: input.req,
            res: input.res,
            reqBody: body,
            startTime: input.startTime,
            targetUrl: input.targetUrl,
            incomingHost: input.incomingHost,
            urlPart: input.urlPart,
            proto: input.proto,
            error,
            buildTrafficEntry: input.buildTrafficEntry,
          });
          return;
        }

        input.logHB(`[CORE-NTLM-OK] ${input.req.method} ${input.req.url} -> ${ntlmRes.statusCode}`);
        handleCoreNtlmSuccess({
          connector: input.connector,
          req: input.req,
          res: input.res,
          reqBody: body,
          startTime: input.startTime,
          targetUrl: input.targetUrl,
          incomingHost: input.incomingHost,
          urlPart: input.urlPart,
          proto: input.proto,
          response: ntlmRes,
          credentials,
          onMetric: input.onMetric,
          buildTrafficEntry: input.buildTrafficEntry,
        });
      },
    );
  });
}
