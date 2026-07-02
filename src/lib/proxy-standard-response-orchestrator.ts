import { getPreferredSessionUsername } from "./auth-ntlm";
import { isFileDownloadResponse, isTextResponse } from "./proxy-response";
import { finalizeStandardRewrite } from "./proxy-standard-rewrite";
import { handleHeartbeatRedirectResponse } from "./proxy-standard-response-redirect";
import { streamDirectProxyResponse } from "./proxy-standard-response-stream";
import type { HandleStandardProxyResponseInput } from "./proxy-standard-response-types";

export function handleStandardProxyResponse(input: HandleStandardProxyResponseInput) {
  const contentType = (input.proxyRes.headers["content-type"] || "").toLowerCase();
  const contentDisp = (input.proxyRes.headers["content-disposition"] || "").toLowerCase();
  const contentEncoding = (input.proxyRes.headers["content-encoding"] || "").toLowerCase();

  const isFileDownload = isFileDownloadResponse(contentType, contentDisp);
  if (isFileDownload && input.heartbeatState.hbTimer) {
    clearTimeout(input.heartbeatState.hbTimer);
    input.heartbeatState.hbTimer = null;
  }

  const isText = isTextResponse(contentType, input.urlPart);
  const needsRewrite = input.heartbeatState.isHeartbeatActive || (!isFileDownload && isText);

  if (
    input.heartbeatState.isHeartbeatActive &&
    [301, 302, 303, 307, 308].includes(input.proxyRes.statusCode || 0)
  ) {
    const location = input.responseHeaders.location as string;
    if (location) {
      handleHeartbeatRedirectResponse(input, location);
      return;
    }
  }

  if (needsRewrite) {
    delete input.responseHeaders["content-length"];
    delete input.responseHeaders["content-encoding"];

    const chunks: Buffer[] = [];
    input.proxyRes.on("data", (chunk) => {
      chunks.push(chunk);
      input.onMetric(chunk.length);
    });
    input.proxyRes.on("end", () => {
      finalizeStandardRewrite({
        connector: input.connector,
        req: input.req,
        res: input.res,
        heartbeatState: input.heartbeatState,
        startTime: input.startTime,
        ttfbMs: input.ttfbMs,
        path: input.path,
        incomingHost: input.incomingHost,
        targetUrl: input.targetUrl,
        urlPart: input.urlPart,
        proto: input.proto,
        contentEncoding,
        contentType,
        isFileDownload,
        statusCode: input.proxyRes.statusCode || 200,
        responseHeaders: input.responseHeaders,
        originalHeaders: input.proxyRes.headers,
        requestBody: input.requestBody,
        rawBody: Buffer.concat(chunks),
        username: getPreferredSessionUsername(
          (input.req as { session?: Record<string, unknown> | null }).session,
        ),
        buildTrafficEntry: input.buildTrafficEntry,
        clearHeartbeatTimers: input.clearHeartbeatTimers,
        logHB: input.logHB,
        logDebugEntry: input.logDebugEntry,
      });
    });
    return;
  }

  streamDirectProxyResponse(input);
}
