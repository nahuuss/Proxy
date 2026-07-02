import http from "http";
import https from "https";
import type { Connector } from "./connectors";

export interface NtlmRequestOptions {
  username: string;
  password: string;
  domain: string;
  workstation: string;
  url: string;
  body: Buffer;
  headers: Record<string, string>;
  agent: http.Agent | https.Agent;
  timeout: number;
  binary: boolean;
}

export interface NtlmMethodRegistry {
  get?: NtlmMethod;
  post?: NtlmMethod;
  put?: NtlmMethod;
  patch?: NtlmMethod;
  delete?: NtlmMethod;
  [key: string]: unknown;
}

export type NtlmMethod = (
  options: NtlmRequestOptions,
  callback: (error: any, response: any) => void,
) => void;

export function resolveNtlmMethod(httpntlm: NtlmMethodRegistry, method?: string): NtlmMethod {
  const normalizedMethod = (method || "GET").toLowerCase();
  return (httpntlm[normalizedMethod] as NtlmMethod) || (httpntlm.get as NtlmMethod);
}

export function createCoreNtlmRequestOptions(input: {
  username: string;
  password: string;
  domain?: string;
  validationUrl: string;
  body: Buffer;
  headers: Record<string, string>;
  agent: http.Agent | https.Agent;
  timeout?: number;
}): NtlmRequestOptions {
  return {
    username: input.username,
    password: input.password,
    domain: input.domain || "",
    workstation: "",
    url: input.validationUrl,
    body: input.body,
    headers: input.headers,
    agent: input.agent,
    timeout: input.timeout ?? 15000,
    binary: true,
  };
}

export function createCrmNtlmAgent(connector: Pick<Connector, "strictTls">, protocol: string) {
  return protocol === "https:"
    ? new https.Agent({
        keepAlive: true,
        maxSockets: 1,
        maxFreeSockets: 0,
        rejectUnauthorized: connector.strictTls === true,
      })
    : new http.Agent({
        keepAlive: true,
        maxSockets: 1,
        maxFreeSockets: 0,
      });
}

export function buildCrmNtlmRequestHeaders(
  headers: http.OutgoingHttpHeaders | readonly string[] | undefined,
  bodyLength: number,
): Record<string, string> {
  const ntlmHeaders: Record<string, string> = {};
  if (Array.isArray(headers)) {
    return bodyLength > 0 ? { "content-length": String(bodyLength) } : ntlmHeaders;
  }

  for (const [key, value] of Object.entries(headers || {})) {
    if (typeof value === "string") ntlmHeaders[key] = value;
    else if (Array.isArray(value)) ntlmHeaders[key] = value.join(", ");
  }
  if (bodyLength > 0) {
    ntlmHeaders["content-length"] = String(bodyLength);
  }
  return ntlmHeaders;
}

export function createCrmNtlmRequestOptions(input: {
  username: string;
  password: string;
  domain?: string;
  targetUrl: string;
  body: Buffer;
  headers: Record<string, string>;
  agent: http.Agent | https.Agent;
  timeout?: number;
}): NtlmRequestOptions {
  return {
    username: input.username,
    password: input.password,
    domain: input.domain || "",
    workstation: "",
    url: input.targetUrl,
    body: input.body,
    headers: input.headers,
    agent: input.agent,
    timeout: input.timeout ?? 15000,
    binary: true,
  };
}
