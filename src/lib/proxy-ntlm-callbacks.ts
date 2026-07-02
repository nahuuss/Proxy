import http from "http";
import type { CoreNtlmSessionCredentials, CrmNtlmSessionCredentials } from "./auth-ntlm";
import type { Connector } from "./connectors";
import type { ProxyHeartbeatState } from "./proxy-heartbeat";
import {
  resolvePreparedNtlmSuccess,
  writeNtlmCallbackError,
} from "./proxy-ntlm-callbacks-shared";
import { writeCoreNtlmResponse, writeCrmNtlmResponse } from "./proxy-ntlm-delivery";
import { logNtlmErrorOutcome, logNtlmSuccessOutcome } from "./proxy-ntlm-observability";

export interface NtlmCallbackResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body?: Buffer | string;
}

export interface BuildNtlmTrafficEntryInput {
  elapsed: number;
  status: number;
  reqSize: number;
  resSize: number;
  err?: string;
  resHeaders?: Record<string, string | string[] | undefined>;
}

export type BuildNtlmTrafficEntry = (input: BuildNtlmTrafficEntryInput) => unknown;

export interface NtlmCallbackBaseInput {
  connector: Connector;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  reqBody: Buffer;
  startTime: number;
  targetUrl: URL;
  incomingHost: string;
  urlPart: string;
  proto: string;
  buildTrafficEntry: BuildNtlmTrafficEntry;
}

export function handleCoreNtlmError(input: NtlmCallbackBaseInput & {
  error: Error;
}) {
  writeNtlmCallbackError(input.res, input.error);
}

export function handleCoreNtlmSuccess(input: NtlmCallbackBaseInput & {
  response: NtlmCallbackResponse;
  credentials: CoreNtlmSessionCredentials;
  onMetric: (connectorId: string, bytes: number, latency?: number) => void;
}) {
  const elapsedMs = Date.now() - input.startTime;
  input.onMetric(input.connector.id, input.response.body?.length || 0, elapsedMs);

  if (input.res.headersSent) return;

  const preparedResponse = resolvePreparedNtlmSuccess(input);
  const fwdHeaders = preparedResponse.responseHeaders;
  const responseBody = preparedResponse.responseBody;

  writeCoreNtlmResponse({
    res: input.res,
    statusCode: input.response.statusCode,
    responseHeaders: fwdHeaders,
    responseBody,
  });

  logNtlmSuccessOutcome({
    connector: input.connector,
    req: input.req,
    startTime: input.startTime,
    elapsedMs,
    requestBody: input.reqBody,
    responseStatusCode: input.response.statusCode,
    responseHeaders: fwdHeaders,
    responseBody,
    username: input.credentials.username,
    buildTrafficEntry: input.buildTrafficEntry,
  });
}

export function handleCrmNtlmError(input: NtlmCallbackBaseInput & {
  error: Error;
  credentials: CrmNtlmSessionCredentials;
}) {
  const elapsedMs = Date.now() - input.startTime;

  writeNtlmCallbackError(input.res, input.error);

  logNtlmErrorOutcome({
    connector: input.connector,
    req: input.req,
    startTime: input.startTime,
    elapsedMs,
    requestBody: input.reqBody,
    errorMessage: input.error.message,
    username: input.credentials.username,
    buildTrafficEntry: input.buildTrafficEntry,
  });
}

export function handleCrmNtlmSuccess(input: NtlmCallbackBaseInput & {
  response: NtlmCallbackResponse;
  credentials: CrmNtlmSessionCredentials;
  heartbeatState: ProxyHeartbeatState;
  onMetric: (connectorId: string, bytes: number, latency?: number) => void;
  onDecode?: (encoding: string) => void;
  onDecodeError?: (error: Error) => void;
  onAuthResult?: (statusCode: number) => void;
}) {
  const elapsedMs = Date.now() - input.startTime;
  input.onMetric(input.connector.id, input.response.body?.length || 0, elapsedMs);

  if (input.res.headersSent) return;

  const preparedResponse = resolvePreparedNtlmSuccess({
    ...input,
    onDecode: input.onDecode,
    onDecodeError: input.onDecodeError,
  });
  const fwdHeaders = preparedResponse.responseHeaders;
  const responseBody = preparedResponse.responseBody;

  writeCrmNtlmResponse({
    connector: input.connector,
    req: input.req,
    res: input.res,
    heartbeatState: input.heartbeatState,
    statusCode: input.response.statusCode,
    incomingHost: input.incomingHost,
    responseHeaders: fwdHeaders,
    responseBody,
    isFileDownload: preparedResponse.isFileDownload,
  });

  logNtlmSuccessOutcome({
    connector: input.connector,
    req: input.req,
    startTime: input.startTime,
    elapsedMs,
    requestBody: input.reqBody,
    responseStatusCode: input.response.statusCode,
    responseHeaders: fwdHeaders,
    responseBody,
    username: input.credentials.username,
    buildTrafficEntry: input.buildTrafficEntry,
  });

  input.onAuthResult?.(input.response.statusCode);
}
