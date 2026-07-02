import http from "http";
import type { Connector } from "./connectors";
import { logHarEntry } from "./logger-har";
import { trafficLogger } from "./logger-traffic";
import {
  completeHeartbeatJob,
  failHeartbeatJob,
  type ProxyHeartbeatState,
} from "./proxy-heartbeat";

export interface BuildStandardTrafficEntryInput {
  elapsed: number;
  ttfb?: number;
  status: number;
  reqSize: number;
  resSize: number;
  err?: string;
  resHeaders?: Record<string, string | string[] | undefined>;
}

export type BuildStandardTrafficEntry = (input: BuildStandardTrafficEntryInput) => unknown;

export interface FinalizeDirectStreamSuccessInput {
  connector: Connector;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  heartbeatState: ProxyHeartbeatState;
  startTime: number;
  ttfbMs: number;
  statusCode: number;
  responseHeaders: Record<string, string | string[] | undefined>;
  requestBody: Buffer | null;
  responseBodyBytes: number;
  username: string;
  clearHeartbeatTimers: () => void;
  buildTrafficEntry: BuildStandardTrafficEntry;
}

export interface FinalizeProxyRequestErrorInput {
  connector: Connector;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  heartbeatState: ProxyHeartbeatState;
  startTime: number;
  requestBody: Buffer | null;
  error: Error;
  username: string;
  clearHeartbeatTimers: () => void;
  buildTrafficEntry: BuildStandardTrafficEntry;
}

export function finalizeDirectStreamSuccess(input: FinalizeDirectStreamSuccessInput) {
  input.clearHeartbeatTimers();
  input.res.end();

  completeHeartbeatJob(input.heartbeatState, {
    statusCode: input.statusCode,
    responseHeaders: input.responseHeaders,
    responseBody: Buffer.alloc(0),
  });

  logHarEntry(input.connector.id, input.connector.harLog, {
    startTime: input.startTime,
    elapsedMs: Date.now() - input.startTime,
    req: input.req,
    reqBody: input.requestBody,
    resStatusCode: input.statusCode,
    resHeaders: input.responseHeaders,
    overrideResBodySize: input.responseBodyBytes,
    username: input.username,
  });

  if (input.connector.trafficLog) {
    const reqSize = input.requestBody?.length || 0;
    const trafficEntry = input.buildTrafficEntry({
      elapsed: Date.now() - input.startTime,
      ttfb: input.ttfbMs,
      status: input.statusCode,
      reqSize,
      resSize: input.responseBodyBytes,
      resHeaders: input.responseHeaders,
    });
    if (trafficEntry) trafficLogger.log(trafficEntry as never);
  }
}

export function finalizeProxyRequestError(input: FinalizeProxyRequestErrorInput) {
  console.error(`[Proxy] Error para ${input.connector.name}:`, input.error);
  input.clearHeartbeatTimers();
  if (!input.res.headersSent) {
    input.res.writeHead(502);
    input.res.end("Bad Gateway");
  }

  logHarEntry(input.connector.id, input.connector.harLog, {
    startTime: input.startTime,
    elapsedMs: Date.now() - input.startTime,
    req: input.req,
    reqBody: input.requestBody,
    resStatusCode: 502,
    resHeaders: {},
    resBody: input.error.message,
    username: input.username,
  });

  failHeartbeatJob(input.heartbeatState, input.error.message);

  if (input.connector.trafficLog) {
    const reqSize = input.requestBody?.length || 0;
    const trafficEntry = input.buildTrafficEntry({
      elapsed: Date.now() - input.startTime,
      status: 502,
      reqSize,
      resSize: 0,
      err: input.error.message,
      resHeaders: {},
    });
    if (trafficEntry) trafficLogger.log(trafficEntry as never);
  }
}
