import http from "http";
import type { Connector } from "./connectors";
import { logHarEntry } from "./logger-har";
import { trafficLogger } from "./logger-traffic";

export interface BuildProxyOutcomeTrafficInput {
  elapsed: number;
  ttfb?: number;
  status: number;
  reqSize: number;
  resSize: number;
  err?: string;
  resHeaders?: Record<string, string | string[] | undefined>;
}

export type BuildProxyOutcomeTraffic = (input: BuildProxyOutcomeTrafficInput) => unknown;

export interface LogProxyOutcomeInput {
  connector: Connector;
  req: http.IncomingMessage;
  startTime: number;
  requestBody: Buffer | null;
  responseStatusCode: number;
  responseHeaders: Record<string, string | string[] | undefined>;
  responseBody?: Buffer | string | null;
  overrideResponseBodySize?: number;
  username: string;
  buildTrafficEntry: BuildProxyOutcomeTraffic;
  elapsedMs: number;
  ttfbMs?: number;
}

export function logProxyOutcome(input: LogProxyOutcomeInput) {
  logHarEntry(input.connector.id, input.connector.harLog, {
    startTime: input.startTime,
    elapsedMs: input.elapsedMs,
    req: input.req,
    reqBody: input.requestBody,
    resStatusCode: input.responseStatusCode,
    resHeaders: input.responseHeaders,
    resBody: input.responseBody,
    overrideResBodySize: input.overrideResponseBodySize,
    username: input.username,
  });

  if (!input.connector.trafficLog) return;

  const trafficEntry = input.buildTrafficEntry({
    elapsed: input.elapsedMs,
    ttfb: input.ttfbMs,
    status: input.responseStatusCode,
    reqSize: input.requestBody?.length || 0,
    resSize: input.overrideResponseBodySize ?? resolveResponseBodySize(input.responseBody),
    resHeaders: input.responseHeaders,
  });
  if (trafficEntry) trafficLogger.log(trafficEntry as never);
}

function resolveResponseBodySize(body?: Buffer | string | null): number {
  if (!body) return 0;
  return Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body);
}
