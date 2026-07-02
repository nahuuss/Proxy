import type { Connector } from './connectors';
import { hasCrmNtlmSessionForConnector } from './auth-ntlm';
import { hasCoreNtlmSessionForConnector } from './core-ntlm';

export type ProxySession = Record<string, unknown> | null;

export function hasRequiredCoreNtlmSession(session: ProxySession, connector?: Connector): boolean {
  if (!session || !connector) return false;
  return hasCoreNtlmSessionForConnector(session, connector.id);
}

export function hasRequiredCrmNtlmSession(session: ProxySession, connector?: Connector): boolean {
  if (!session || !connector) return false;
  return hasCrmNtlmSessionForConnector(session, connector.id);
}
