import type http from "http";
import type { Connector } from "./connectors";
import { logSSO } from "./logger-sso";

export interface CrmNtlmCircuitState {
  failures: number[];
  blockedUntil: number;
}

const CRM_NTLM_FAIL_WINDOW_MS = 60_000;
const CRM_NTLM_FAIL_THRESHOLD = 5;
const CRM_NTLM_BLOCK_MS = 3 * 60_000;
const crmNtlmCircuit = new Map<string, CrmNtlmCircuitState>();

function getCrmNtlmCircuitKey(connectorId: string, username: string) {
  return `${connectorId}:${username}`.toLowerCase();
}

function pruneCrmNtlmFailures(now: number, state?: CrmNtlmCircuitState) {
  if (!state) return;
  state.failures = state.failures.filter((timestamp) => now - timestamp <= CRM_NTLM_FAIL_WINDOW_MS);
  if (state.blockedUntil && state.blockedUntil <= now) {
    state.blockedUntil = 0;
  }
}

export function isCrmNtlmNoisePath(pathname: string) {
  return pathname.toLowerCase().startsWith("/.well-known/appspecific/");
}

export function buildCrmNtlmHeaders(headers: http.IncomingHttpHeaders, bodyLength: number) {
  const allowedHeaderNames = new Set([
    "accept",
    "accept-language",
    "cache-control",
    "content-type",
    "if-match",
    "if-none-match",
    "origin",
    "pragma",
    "referer",
    "soapaction",
    "user-agent",
    "x-requested-with",
  ]);

  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers || {})) {
    const normalizedKey = key.toLowerCase();
    if (!allowedHeaderNames.has(normalizedKey)) continue;
    if (typeof value === "string") sanitized[normalizedKey] = value;
    else if (Array.isArray(value)) sanitized[normalizedKey] = value.join(", ");
  }

  if (bodyLength > 0) {
    sanitized["content-length"] = String(bodyLength);
  }

  return sanitized;
}

export function getCrmNtlmBlockState(connector: Connector, username: string) {
  const key = getCrmNtlmCircuitKey(connector.id, username);
  const state = crmNtlmCircuit.get(key);
  const now = Date.now();
  pruneCrmNtlmFailures(now, state);
  if (!state || !state.blockedUntil || state.blockedUntil <= now) {
    if (state) crmNtlmCircuit.set(key, state);
    return null;
  }
  crmNtlmCircuit.set(key, state);
  return state;
}

export function recordCrmNtlmFailure(connector: Connector, username: string, pathname: string, statusCode: number) {
  if (isCrmNtlmNoisePath(pathname)) return;
  const now = Date.now();
  const key = getCrmNtlmCircuitKey(connector.id, username);
  const state = crmNtlmCircuit.get(key) || { failures: [], blockedUntil: 0 };
  pruneCrmNtlmFailures(now, state);
  state.failures.push(now);
  const count = state.failures.length;

  if (count === 1) {
    logSSO(connector.id, `[CRM-NTLM-401] Primer 401 para usuario=${username} path=${pathname}`);
  } else {
    logSSO(connector.id, `[CRM-NTLM-401] status=${statusCode} acumulado=${count} usuario=${username} path=${pathname}`);
  }

  if (count >= CRM_NTLM_FAIL_THRESHOLD) {
    state.blockedUntil = now + CRM_NTLM_BLOCK_MS;
    logSSO(
      connector.id,
      `[CRM-NTLM-BREAKER] Apertura por ${count} fallos NTLM para usuario=${username} path=${pathname} hasta=${new Date(state.blockedUntil).toISOString()}`,
    );
  }

  crmNtlmCircuit.set(key, state);
}

export function resetCrmNtlmFailureState(connector: Connector, username: string) {
  const key = getCrmNtlmCircuitKey(connector.id, username);
  const state = crmNtlmCircuit.get(key);
  if (!state) return;
  crmNtlmCircuit.delete(key);
  if (state.failures.length > 0 || state.blockedUntil > 0) {
    logSSO(connector.id, `[CRM-NTLM-BREAKER] Cierre y reset por respuesta exitosa para usuario=${username}`);
  }
}
