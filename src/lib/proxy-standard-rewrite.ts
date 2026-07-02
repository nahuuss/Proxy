import http from "http";
import type { Connector } from "./connectors";
import { type ProxyHeartbeatState, completeHeartbeatJob } from "./proxy-heartbeat";
import { handleHeartbeatBinaryDownload } from "./proxy-standard-download";
import { logProxyOutcome, type BuildProxyOutcomeTraffic } from "./proxy-standard-observability";
import { prepareStandardProxyBuffer } from "./proxy-standard-response";
import { writeStandardProxyResponse } from "./proxy-standard-delivery";

export interface FinalizeStandardRewriteInput {
  connector: Connector;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  heartbeatState: ProxyHeartbeatState;
  startTime: number;
  ttfbMs: number;
  path: string;
  incomingHost: string;
  targetUrl: URL;
  urlPart: string;
  proto: string;
  contentEncoding: string;
  contentType: string;
  isFileDownload: boolean;
  statusCode: number;
  responseHeaders: Record<string, string | string[] | undefined>;
  originalHeaders: http.IncomingHttpHeaders;
  requestBody: Buffer | null;
  rawBody: Buffer;
  username: string;
  buildTrafficEntry: BuildProxyOutcomeTraffic;
  clearHeartbeatTimers: () => void;
  logHB: (message: string) => void;
  logDebugEntry: (tag: string, extra: string, status?: number | string, elapsedMs?: number) => void;
}

export function finalizeStandardRewrite(input: FinalizeStandardRewriteInput) {
  input.clearHeartbeatTimers();

  const preparedBuffer = prepareStandardProxyBuffer({
    connector: input.connector,
    body: input.rawBody,
    contentEncoding: input.contentEncoding,
    contentType: input.contentType,
    incomingHost: input.incomingHost,
    targetUrl: input.targetUrl,
    urlPart: input.urlPart,
    proto: input.proto,
    allowShortPk: true,
    onDecode: (encoding) => {
      input.logHB(`[HB-DECODE] ${input.req.method} ${input.path} | ${encoding} decompressed`);
    },
    onDecodeError: (error) => {
      input.logHB(`[HB-WARN] Failed to decompress: ${error.message}`);
    },
  });

  const buffer = preparedBuffer.body;
  const binaryDetection = preparedBuffer.binaryDetection;
  const elapsedMs = Date.now() - input.startTime;

  if (input.heartbeatState.isHeartbeatActive && (binaryDetection || input.isFileDownload)) {
    const finalBuffer = handleHeartbeatBinaryDownload({
      connector: input.connector,
      req: input.req,
      res: input.res,
      buffer,
      binaryDetection,
      incomingHost: input.incomingHost,
      originalHeaders: input.originalHeaders,
      isHtmlCommentOpen: input.heartbeatState.isHtmlCommentOpen,
      logHB: input.logHB,
    });

    logProxyOutcome({
      connector: input.connector,
      req: input.req,
      startTime: input.startTime,
      requestBody: input.requestBody,
      responseStatusCode: input.statusCode,
      responseHeaders: input.responseHeaders,
      responseBody: finalBuffer,
      username: input.username,
      buildTrafficEntry: input.buildTrafficEntry,
      elapsedMs,
      ttfbMs: input.ttfbMs,
    });
    return;
  }

  writeStandardProxyResponse({
    res: input.res,
    heartbeatState: input.heartbeatState,
    body: buffer,
    headers: input.responseHeaders,
    statusCode: input.statusCode,
    path: input.path,
    connectorId: input.connector.id,
    logHB: input.logHB,
    logDebugEntry: input.logDebugEntry,
    elapsedMs,
  });

  completeHeartbeatJob(input.heartbeatState, {
    statusCode: input.statusCode,
    responseHeaders: input.responseHeaders,
    responseBody: buffer,
  });

  logProxyOutcome({
    connector: input.connector,
    req: input.req,
    startTime: input.startTime,
    requestBody: input.requestBody,
    responseStatusCode: input.statusCode,
    responseHeaders: input.responseHeaders,
    responseBody: buffer,
    username: input.username,
    buildTrafficEntry: input.buildTrafficEntry,
    elapsedMs,
    ttfbMs: input.ttfbMs,
  });
}
