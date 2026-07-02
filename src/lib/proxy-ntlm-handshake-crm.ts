import type { CrmNtlmSessionCredentials } from "./auth-ntlm";
import {
  buildCrmNtlmRequestHeaders,
  createCrmNtlmAgent,
  createCrmNtlmRequestOptions,
} from "./proxy-ntlm";
import {
  collectNtlmRequestBody,
  resolveRequestNtlmMethod,
  startNtlmHeartbeatShieldIfNeeded,
} from "./proxy-ntlm-handshake-common";
import {
  handleCrmNtlmError,
  handleCrmNtlmSuccess,
  type NtlmCallbackResponse,
} from "./proxy-ntlm-callbacks";
import {
  getCrmNtlmBlockState,
  isCrmNtlmNoisePath,
  recordCrmNtlmFailure,
  resetCrmNtlmFailureState,
} from "./proxy-crm-ntlm";
import type { HandleProxyNtlmHandshakeInput } from "./proxy-server-ntlm";

export function runCrmNtlmHandshake(
  input: HandleProxyNtlmHandshakeInput,
  credentials: CrmNtlmSessionCredentials,
  onBreakerOpen: (requestPath: string, blockedUntil: number) => void,
): void {
  collectNtlmRequestBody(input.req, (body) => {
    const ntlmFn = resolveRequestNtlmMethod({
      registry: input.httpntlmRegistry,
      resolveMethod: input.resolveNtlmMethodFn,
      method: input.req.method,
    });
    const requestPath = input.effectiveReqUrl.split("?")[0] || "/";
    const getBlockState = input.getCrmBlockState || getCrmNtlmBlockState;
    const recordFailure = input.recordCrmFailure || recordCrmNtlmFailure;
    const resetFailureState = input.resetCrmFailureState || resetCrmNtlmFailureState;
    const breakerState = getBlockState(input.connector, credentials.username);

    if (breakerState && !isCrmNtlmNoisePath(requestPath)) {
      onBreakerOpen(requestPath, breakerState.blockedUntil);
      return;
    }

    startNtlmHeartbeatShieldIfNeeded(input.hbEligible, input.startHeartbeatShield);

    const ntlmHeaders = buildCrmNtlmRequestHeaders(input.req.headers, body.length);
    const buildAgent = input.createCrmAgent || createCrmNtlmAgent;
    const ntlmAgent = buildAgent(input.connector, input.targetUrl.protocol);

    ntlmFn(
      createCrmNtlmRequestOptions({
        username: credentials.username,
        password: credentials.password,
        domain: credentials.domain || input.connector.ntlmDomain || "",
        targetUrl: `${input.targetUrl.protocol}//${input.targetUrl.host}${input.effectiveReqUrl}`,
        body,
        headers: ntlmHeaders,
        agent: ntlmAgent,
      }),
      (error: Error | null, ntlmRes: NtlmCallbackResponse) => {
        input.clearHeartbeatTimers();
        ntlmAgent.destroy();

        if (error) {
          input.logHB(`[NTLM-ERR] ${input.req.method} ${input.req.url} -> ${error.message}`);
          handleCrmNtlmError({
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
            credentials,
            buildTrafficEntry: input.buildTrafficEntry,
          });
          return;
        }

        input.logHB(`[NTLM-OK] ${input.req.method} ${input.req.url} -> ${ntlmRes.statusCode}`);
        handleCrmNtlmSuccess({
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
          heartbeatState: input.heartbeatState,
          onMetric: input.onMetric,
          onDecode: (encoding) => {
            input.logHB(`[NTLM-DECODE] ${input.req.method} ${input.req.url} | ${encoding} decompressed`);
          },
          onDecodeError: (decodeError) => {
            input.logHB(`[NTLM-WARN] Failed to decompress: ${decodeError.message}`);
          },
          onAuthResult: (statusCode) => {
            if (statusCode === 401) {
              recordFailure(input.connector, credentials.username, requestPath, statusCode);
            } else if (statusCode < 400) {
              resetFailureState(input.connector, credentials.username);
            }
          },
          buildTrafficEntry: input.buildTrafficEntry,
        });
      },
    );
  });
}
