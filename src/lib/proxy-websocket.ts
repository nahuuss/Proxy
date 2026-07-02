import type http from "http";
import type { Connector } from "./connectors";
import { resolveRequestClientIp } from "./proxy-rate-limit";

export interface WebSocketBackendTarget {
  targetHost: string;
  targetPort: number;
  isHttps: boolean;
}

export interface BuildWebSocketProxyRequestInput {
  method?: string;
  normalizedRequestUrl: string;
  requestHeaders: http.IncomingHttpHeaders;
  hostHeader: string;
  remoteAddress?: string | null;
  targetUrl: URL;
  isLocalHost: boolean;
}

export interface WebSocketProxyRequest {
  forwardedHeaders: Record<string, string>;
  requestPayload: string;
}

export function resolveWebSocketBackendTarget(
  targetUrl: URL,
): WebSocketBackendTarget {
  const isHttps = targetUrl.protocol === "https:";
  return {
    isHttps,
    targetHost: targetUrl.hostname,
    targetPort: targetUrl.port ? parseInt(targetUrl.port) : isHttps ? 443 : 80,
  };
}

export function buildWebSocketProxyRequest(
  input: BuildWebSocketProxyRequestInput,
): WebSocketProxyRequest {
  const forwardedHeaders: Record<string, string> = {};

  for (const [key, value] of Object.entries(input.requestHeaders)) {
    if (key.startsWith("cf-") || key.startsWith("x-forwarded-")) continue;
    forwardedHeaders[key] = Array.isArray(value) ? value.join(", ") : value || "";
  }

  forwardedHeaders.host = input.targetUrl.host;
  forwardedHeaders["x-forwarded-host"] = input.hostHeader;
  forwardedHeaders["x-forwarded-proto"] = input.isLocalHost ? "http" : "https";
  forwardedHeaders["x-forwarded-for"] = resolveRequestClientIp(
    input.requestHeaders as Record<string, string | string[] | undefined>,
    input.remoteAddress,
  );

  let requestPayload = `${input.method || "GET"} ${input.normalizedRequestUrl} HTTP/1.1\r\n`;
  for (const [key, value] of Object.entries(forwardedHeaders)) {
    requestPayload += `${key}: ${value}\r\n`;
  }
  requestPayload += "\r\n";

  return {
    forwardedHeaders,
    requestPayload,
  };
}

export function buildWebSocketUpgradeFailureResponse(
  statusCode: 401 | 502,
): string {
  return statusCode === 401
    ? "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n"
    : "HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n";
}

export function isExpectedWebSocketBackendClose(code?: string): boolean {
  return code === "ECONNRESET" || code === "EPIPE" || code === "ECONNREFUSED";
}

export function describeWebSocketProxyConnection(
  connector: Pick<Connector, "id">,
  requestUrl?: string,
): string {
  return `[WS-PROXY] Conectado: ${requestUrl} -> ${connector.id}`;
}

export function describeWebSocketProxyError(
  connector: Pick<Connector, "id">,
  errorMessage: string,
): string {
  return `[WS-PROXY] Error backend: ${errorMessage} (${connector.id})`;
}
