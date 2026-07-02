import { getPreferredSessionUsername } from './auth-ntlm';
import { finalizeDirectStreamSuccess } from './proxy-standard-stream';
import type { HandleStandardProxyResponseInput } from './proxy-standard-response-types';

export function streamDirectProxyResponse(input: HandleStandardProxyResponseInput): void {
  delete input.responseHeaders['content-encoding'];
  if (!input.res.headersSent) {
    input.res.writeHead(input.proxyRes.statusCode || 200, input.responseHeaders);
  }

  let responseBodyBytes = 0;
  input.proxyRes.on('data', (chunk) => {
    input.onMetric(chunk.length);
    if (!input.res.destroyed) {
      input.res.write(chunk);
    }
    responseBodyBytes += chunk.length;
  });

  input.proxyRes.on('end', () => {
    finalizeDirectStreamSuccess({
      connector: input.connector,
      req: input.req,
      res: input.res,
      heartbeatState: input.heartbeatState,
      startTime: input.startTime,
      ttfbMs: input.ttfbMs,
      statusCode: input.proxyRes.statusCode || 200,
      responseHeaders: input.responseHeaders,
      requestBody: input.requestBody,
      responseBodyBytes,
      username: getPreferredSessionUsername(
        (input.req as { session?: Record<string, unknown> | null }).session,
      ),
      clearHeartbeatTimers: input.clearHeartbeatTimers,
      buildTrafficEntry: input.buildTrafficEntry,
    });
  });
}
