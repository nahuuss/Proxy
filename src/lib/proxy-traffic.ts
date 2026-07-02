import { extractCookieNames, type DebugEntry, type TrafficEntry } from "./logger-traffic";

export interface BuildProxyDebugEntryInput {
  connectorId: string;
  username: string;
  method?: string;
  requestUrl?: string;
  tag: string;
  status?: number | string;
  elapsedMs?: number;
  extra?: string;
}

export interface BuildProxyTrafficEntryInput {
  startTime: number;
  connectorId: string;
  username: string;
  method?: string;
  requestUrl?: string;
  requestHeaders: Record<string, string | string[] | undefined>;
  isAjax: boolean;
  elapsed: number;
  ttfb?: number;
  status: number;
  reqSize: number;
  resSize: number;
  err?: string;
  resHeaders?: Record<string, string | string[] | undefined>;
}

export function buildProxyDebugEntry(input: BuildProxyDebugEntryInput): DebugEntry {
  return {
    type: "debug",
    ts: new Date().toISOString(),
    user: input.username,
    conn: input.connectorId,
    tag: input.tag,
    method: input.method,
    path: (input.requestUrl || "").split("?")[0],
    status: input.status,
    elapsedMs: input.elapsedMs,
    extra: input.extra,
  };
}

export function buildProxyTrafficEntry(input: BuildProxyTrafficEntryInput): TrafficEntry {
  return {
    ts: new Date(input.startTime).toISOString(),
    elapsed: input.elapsed,
    ...(input.ttfb !== undefined ? { ttfb: input.ttfb } : {}),
    user: input.username,
    conn: input.connectorId,
    method: input.method || "GET",
    url: input.requestUrl || "/",
    status: input.status,
    reqSize: input.reqSize,
    resSize: input.resSize,
    ct: (input.resHeaders?.["content-type"] || "unknown") as string,
    xhr: input.isAjax,
    err: input.err || null,
    cookies: extractCookieNames(input.requestHeaders.cookie),
    reqHdrs: input.requestHeaders,
    resHdrs: input.resHeaders || {},
  };
}
