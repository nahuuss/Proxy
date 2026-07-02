import http from 'http';
import https from 'https';

import { getPreferredSessionUsername } from './auth-ntlm';
import type { Connector } from './connectors';
import { rewriteHeaders } from './proxy-header-rewrite';
import { clearProxyHeartbeatTimers, type ProxyHeartbeatState } from './proxy-heartbeat';
import type { ProxyServerRequestContext } from './proxy-server-request-context';
import { handleStandardProxyResponse } from './proxy-standard-response-orchestrator';
import { forwardProxyRequestBody } from './proxy-standard-request-body';
import { finalizeProxyRequestError } from './proxy-standard-stream';

export function runProxyServerStandardFlow(input: {
  connector: Connector;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  requestContext: ProxyServerRequestContext;
  heartbeatState: ProxyHeartbeatState;
  targetUrl: URL;
  isHttps: boolean;
  startTime: number;
  onMetric: (id: string, bytes: number, latency?: number) => void;
  buildTrafficEntry: (input: {
    elapsed: number;
    ttfb?: number;
    status: number;
    reqSize: number;
    resSize: number;
    err?: string;
    resHeaders?: Record<string, string | string[] | undefined>;
  }) => unknown;
  logHB: (message: string) => void;
  logDebugEntry: (
    tag: string,
    extra?: string,
    status?: number | string,
    elapsedMs?: number,
  ) => void;
  getRedirectScript: (location: string, isHtmlCommentOpen: boolean) => string;
  maxBodyBytes: number;
}): void {
  const reqBodyChunks: Buffer[] = [];

  const proxyReq = (input.isHttps ? https : http).request(input.requestContext.options, (proxyRes) => {
    const ttfbMs = Date.now() - input.startTime;
    input.onMetric(input.connector.id, 0, Date.now() - input.startTime);

    const finalHeaders = rewriteHeaders(
      proxyRes.headers,
      input.targetUrl,
      input.requestContext.incomingHost,
    );

    handleStandardProxyResponse({
      connector: input.connector,
      req: input.req,
      res: input.res,
      proxyRes,
      heartbeatState: input.heartbeatState,
      startTime: input.startTime,
      ttfbMs,
      path: input.requestContext.path,
      incomingHost: input.requestContext.incomingHost,
      targetUrl: input.targetUrl,
      urlPart: input.requestContext.urlPart,
      proto: input.requestContext.proto,
      responseHeaders: finalHeaders,
      requestBody: reqBodyChunks.length > 0 ? Buffer.concat(reqBodyChunks) : null,
      clearHeartbeatTimers: () => {
        clearProxyHeartbeatTimers(input.heartbeatState);
      },
      onMetric: (bytes) => {
        input.onMetric(input.connector.id, bytes);
      },
      buildTrafficEntry: input.buildTrafficEntry,
      logHB: input.logHB,
      logDebugEntry: input.logDebugEntry,
      getRedirectScript: input.getRedirectScript,
    });
  });

  proxyReq.on('error', (error) => {
    const username = getPreferredSessionUsername(
      (input.req as http.IncomingMessage & { session?: Record<string, unknown> | null }).session,
    );
    finalizeProxyRequestError({
      connector: input.connector,
      req: input.req,
      res: input.res,
      heartbeatState: input.heartbeatState,
      startTime: input.startTime,
      requestBody: reqBodyChunks.length > 0 ? Buffer.concat(reqBodyChunks) : null,
      error,
      username,
      clearHeartbeatTimers: () => {
        clearProxyHeartbeatTimers(input.heartbeatState);
      },
      buildTrafficEntry: input.buildTrafficEntry,
    });
  });

  forwardProxyRequestBody({
    req: input.req,
    res: input.res,
    proxyReq,
    maxBodyBytes: input.maxBodyBytes,
    captureChunks: input.connector.harLog ? reqBodyChunks : undefined,
    onMetric: (bytes) => {
      input.onMetric(input.connector.id, bytes);
    },
    clearHeartbeatTimers: () => {
      clearProxyHeartbeatTimers(input.heartbeatState);
    },
  });
}
