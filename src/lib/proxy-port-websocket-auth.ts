import type http from 'http';
import type { Connector } from './connectors';
import { getProxyAccessRequirements } from './proxy-access';
import { resolveWebSocketProxyAuthDecision } from './proxy-auth-flow';
import type { ProxySession } from './proxy-session';
import type { GlobalSettings } from './settings';

export type ProxyPortWebSocketAuthResult =
  | { kind: 'handled' }
  | { kind: 'continue'; accessRequirements: ReturnType<typeof getProxyAccessRequirements> };

export async function authorizeProxyPortWebSocketUpgrade(input: {
  connector: Connector;
  settings: GlobalSettings;
  req: http.IncomingMessage;
  verifySession: (cookieHeader: string) => Promise<ProxySession | null>;
}): Promise<ProxyPortWebSocketAuthResult> {
  const accessRequirements = getProxyAccessRequirements({
    connector: input.connector,
    hostHeader: input.req.headers.host || '',
    settingsBypass: input.settings.bypassAuth,
    requestUrl: input.req.url || '/',
    normalizeRequestUrl: true,
  });

  if (
    !accessRequirements.requiresAuth &&
    !accessRequirements.needsSessionForNtlm &&
    !accessRequirements.needsCoreNtlmSession
  ) {
    return { kind: 'continue', accessRequirements };
  }

  const session = await input.verifySession(input.req.headers.cookie || '');
  const authDecision = resolveWebSocketProxyAuthDecision({
    connector: input.connector,
    accessRequirements: {
      requiresAuth: accessRequirements.requiresAuth,
      needsSessionForNtlm: accessRequirements.needsSessionForNtlm,
      needsCoreNtlmSession: accessRequirements.needsCoreNtlmSession,
    },
    session,
  });

  if (authDecision.kind === 'unauthorized') {
    return { kind: 'handled' };
  }

  return { kind: 'continue', accessRequirements };
}
