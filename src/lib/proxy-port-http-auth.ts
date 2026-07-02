import type http from 'http';
import type { Connector } from './connectors';
import { resolveHttpProxyAuthDecision } from './proxy-auth-flow';
import { getProxyAccessRequirements } from './proxy-access';
import type { ProxySession } from './proxy-session';
import type { GlobalSettings } from './settings';

export type ProxyPortHttpAuthInput = {
  url: string;
  hostHeader: string;
  connector?: Connector;
  settings: GlobalSettings;
  cookieHeader: string;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  verifySession: (cookieHeader: string) => Promise<ProxySession | null>;
  log: (message: string, type?: 'info' | 'error' | 'system') => void;
};

export type ProxyPortHttpAuthResult =
  | { kind: 'continue'; session: ProxySession | null }
  | { kind: 'handled'; session: ProxySession | null };

function buildAuthDecisionLog(url: string, decision: Extract<ReturnType<typeof resolveHttpProxyAuthDecision>, { kind: 'redirect' }>): string {
  if (
    decision.reason.startsWith('missing-core') ||
    decision.reason.startsWith('connector-mismatch-core')
  ) {
    return `[BIZGUARD-Auth] Core NTLM session missing or invalid for ${url}. Redirecting to: ${decision.location}`;
  }

  if (decision.reason === 'missing-sso-session') {
    return `[BIZGUARD-Auth] No session for ${url}. Redirecting to: ${decision.location}`;
  }

  return `[BIZGUARD-Auth] SSO ok but NTLM credentials missing or bound to another connector for ${url}. Redirecting to: ${decision.location}`;
}

export async function handleProxyPortHttpAuth(input: ProxyPortHttpAuthInput): Promise<ProxyPortHttpAuthResult> {
  if (!input.connector) {
    return { kind: 'continue', session: null };
  }

  const accessRequirements = getProxyAccessRequirements({
    connector: input.connector,
    hostHeader: input.hostHeader,
    settingsBypass: input.settings.bypassAuth,
    requestUrl: input.url,
  });
  const requiresSession =
    accessRequirements.requiresAuth ||
    accessRequirements.needsSessionForNtlm ||
    accessRequirements.needsCoreNtlmSession;

  if (!requiresSession) {
    return { kind: 'continue', session: null };
  }

  const session = await input.verifySession(input.cookieHeader);
  (input.req as http.IncomingMessage & { session?: ProxySession | null }).session = session;

  const authDecision = resolveHttpProxyAuthDecision({
    url: input.url,
    hostHeader: input.hostHeader,
    connector: input.connector,
    accessRequirements: {
      requiresAuth: accessRequirements.requiresAuth,
      needsSessionForNtlm: accessRequirements.needsSessionForNtlm,
      needsCoreNtlmSession: accessRequirements.needsCoreNtlmSession,
    },
    session,
  });

  if (authDecision.kind === 'unauthorized-api') {
    input.log(`[BIZGUARD-Auth] API route ${input.url} requires auth. Returning 401.`, 'info');
    input.res.writeHead(401, { 'Content-Type': 'application/json' });
    input.res.end(JSON.stringify({ error: 'Unauthorized' }));
    return { kind: 'handled', session };
  }

  if (authDecision.kind === 'redirect') {
    input.log(buildAuthDecisionLog(input.url, authDecision), 'info');
    input.res.writeHead(302, { Location: authDecision.location });
    input.res.end();
    return { kind: 'handled', session };
  }

  if (authDecision.kind === 'root-entry-redirect') {
    input.res.writeHead(302, { Location: authDecision.location });
    input.res.end();
    return { kind: 'handled', session };
  }

  return { kind: 'continue', session };
}
