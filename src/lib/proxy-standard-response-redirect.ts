import { getPreferredSessionUsername } from './auth-ntlm';
import { completeHeartbeatJob } from './proxy-heartbeat';
import { writeHeartbeatRedirectResponse } from './proxy-standard-delivery';
import { logProxyOutcome } from './proxy-standard-observability';
import type { HandleStandardProxyResponseInput } from './proxy-standard-response-types';

export function handleHeartbeatRedirectResponse(
  input: HandleStandardProxyResponseInput,
  location: string,
): void {
  input.logHB(
    `[HB-REDIRECT] Forzando redireccion cliente a ${location} tras HB activo (${input.path})`,
  );
  writeHeartbeatRedirectResponse({
    res: input.res,
    script: input.getRedirectScript(location, input.heartbeatState.isHtmlCommentOpen),
  });
  completeHeartbeatJob(input.heartbeatState, {
    statusCode: 200,
    responseHeaders: input.responseHeaders,
    responseBody: Buffer.alloc(0),
  });
  logProxyOutcome({
    connector: input.connector,
    req: input.req,
    startTime: input.startTime,
    requestBody: input.requestBody,
    responseStatusCode: input.proxyRes.statusCode || 302,
    responseHeaders: input.responseHeaders,
    responseBody: '',
    username: getPreferredSessionUsername(
      (input.req as { session?: Record<string, unknown> | null }).session,
    ),
    buildTrafficEntry: input.buildTrafficEntry,
    elapsedMs: Date.now() - input.startTime,
    ttfbMs: input.ttfbMs,
  });
}
