import http from "http";
import https from "https";
import {
  type CrmNtlmSessionCredentials,
} from "./auth-ntlm";
import type { Connector } from "./connectors";
import { logSSO } from "./logger-sso";
import {
  createCrmNtlmAgent,
  type NtlmMethod,
  type NtlmMethodRegistry,
} from "./proxy-ntlm";
import { type BuildNtlmTrafficEntry } from "./proxy-ntlm-callbacks";
import type { ProxyHeartbeatState } from "./proxy-heartbeat";
import {
  getCrmNtlmBlockState,
  recordCrmNtlmFailure,
  resetCrmNtlmFailureState,
} from "./proxy-crm-ntlm";
import {
  runCoreNtlmHandshake,
  runCrmNtlmHandshake,
} from "./proxy-ntlm-handshake-runners";
import { resolveProxyNtlmSession } from "./proxy-ntlm-session";

export interface HandleProxyNtlmHandshakeInput {
  connector: Connector;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  session: any;
  effectiveReqUrl: string;
  incomingHost: string;
  urlPart: string;
  proto: string;
  targetUrl: URL;
  agent: http.Agent | https.Agent;
  heartbeatState: ProxyHeartbeatState;
  hbEligible: boolean;
  startHeartbeatShield: () => void;
  clearHeartbeatTimers: () => void;
  startTime: number;
  onMetric: (connectorId: string, bytes: number, latency?: number) => void;
  buildTrafficEntry: BuildNtlmTrafficEntry;
  logHB: (message: string) => void;
  httpntlmRegistry?: NtlmMethodRegistry;
  resolveNtlmMethodFn?: (registry: NtlmMethodRegistry, method?: string) => NtlmMethod;
  createCrmAgent?: typeof createCrmNtlmAgent;
  getCrmBlockState?: typeof getCrmNtlmBlockState;
  recordCrmFailure?: typeof recordCrmNtlmFailure;
  resetCrmFailureState?: typeof resetCrmNtlmFailureState;
}

function writePlainResponse(
  res: http.ServerResponse,
  statusCode: number,
  body: string,
  headers?: Record<string, string>,
) {
  if (res.headersSent) return;
  res.writeHead(statusCode, headers);
  res.end(body);
}

function handleMissingCrmSession(
  input: Pick<HandleProxyNtlmHandshakeInput, "connector" | "res">,
) {
  logSSO(input.connector.id, `[CRM-NTLM-ERR] Sesion CRM NTLM invalida para ${input.connector.id}`);
  writePlainResponse(
    input.res,
    401,
    "La sesion NTLM CRM no esta disponible. Reingresa.",
    { "Content-Type": "text/plain; charset=utf-8" },
  );
}

function handleCrmConnectorMismatch(
  input: Pick<HandleProxyNtlmHandshakeInput, "connector" | "res">,
  credentials: CrmNtlmSessionCredentials,
) {
  logSSO(
    input.connector.id,
    `[CRM-NTLM-MISMATCH] sessionConnector=${credentials.connectorId} requestConnector=${input.connector.id} user=${credentials.username}`,
  );
  writePlainResponse(
    input.res,
    409,
    "La sesi\u00f3n NTLM activa pertenece a otro conector CRM. Reingresa.",
    { "Content-Type": "text/plain; charset=utf-8" },
  );
}

function handleCrmBreakerOpen(
  input: Pick<HandleProxyNtlmHandshakeInput, "connector" | "res">,
  credentials: CrmNtlmSessionCredentials,
  requestPath: string,
  blockedUntil: number,
) {
  const retryAfterSeconds = Math.max(1, Math.ceil((blockedUntil - Date.now()) / 1000));
  logSSO(
    input.connector.id,
    `[CRM-NTLM-BREAKER] Bloqueando intento NTLM para usuario=${credentials.username} path=${requestPath} retryAfter=${retryAfterSeconds}s`,
  );
  writePlainResponse(
    input.res,
    429,
    "BizGuard detuvo temporalmente nuevos intentos NTLM para proteger la cuenta AD. Reintenta en unos minutos.",
    {
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": String(retryAfterSeconds),
    },
  );
}

export function handleProxyNtlmHandshake(input: HandleProxyNtlmHandshakeInput): boolean {
  const resolution = resolveProxyNtlmSession({
    connector: input.connector,
    session: input.session,
    requestUrl: input.req.url,
  });

  switch (resolution.kind) {
    case "core":
      runCoreNtlmHandshake(input, resolution.credentials);
      return true;
    case "crm-missing-session":
      handleMissingCrmSession(input);
      return true;
    case "crm-connector-mismatch":
      handleCrmConnectorMismatch(input, resolution.credentials);
      return true;
    case "crm":
      runCrmNtlmHandshake(input, resolution.credentials, (requestPath, blockedUntil) => {
        handleCrmBreakerOpen(input, resolution.credentials, requestPath, blockedUntil);
      });
      return true;
    case "none":
      return false;
  }
}
