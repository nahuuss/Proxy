import http from "http";
import type { Connector } from "./connectors";
import { logHarEntry } from "./logger-har";
import { trafficLogger } from "./logger-traffic";
import type { BuildNtlmTrafficEntry } from "./proxy-ntlm-callbacks";

export function logNtlmSuccessOutcome(input: {
  connector: Connector;
  req: http.IncomingMessage;
  startTime: number;
  elapsedMs: number;
  requestBody: Buffer;
  responseStatusCode: number;
  responseHeaders: Record<string, string | string[] | undefined>;
  responseBody: Buffer;
  username: string;
  buildTrafficEntry: BuildNtlmTrafficEntry;
}) {
  logHarEntry(input.connector.id, input.connector.harLog, {
    startTime: input.startTime,
    elapsedMs: input.elapsedMs,
    req: input.req,
    reqBody: input.requestBody,
    resStatusCode: input.responseStatusCode,
    resHeaders: input.responseHeaders,
    resBody: input.responseBody,
    username: input.username,
  });

  if (input.connector.trafficLog) {
    const trafficEntry = input.buildTrafficEntry({
      elapsed: input.elapsedMs,
      status: input.responseStatusCode,
      reqSize: input.requestBody.length,
      resSize: input.responseBody.length,
      resHeaders: input.responseHeaders,
    });
    if (trafficEntry) {
      trafficLogger.log(trafficEntry as never);
    }
  }
}

export function logNtlmErrorOutcome(input: {
  connector: Connector;
  req: http.IncomingMessage;
  startTime: number;
  elapsedMs: number;
  requestBody: Buffer;
  errorMessage: string;
  username: string;
  buildTrafficEntry: BuildNtlmTrafficEntry;
}) {
  logHarEntry(input.connector.id, input.connector.harLog, {
    startTime: input.startTime,
    elapsedMs: input.elapsedMs,
    req: input.req,
    reqBody: input.requestBody,
    resStatusCode: 502,
    resHeaders: {},
    resBody: input.errorMessage,
    username: input.username,
  });

  if (input.connector.trafficLog) {
    const trafficEntry = input.buildTrafficEntry({
      elapsed: input.elapsedMs,
      status: 502,
      reqSize: input.requestBody.length,
      resSize: 0,
      err: input.errorMessage,
      resHeaders: {},
    });
    if (trafficEntry) {
      trafficLogger.log(trafficEntry as never);
    }
  }
}
