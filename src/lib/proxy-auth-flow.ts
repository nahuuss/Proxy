import type { Connector } from "./connectors";
import {
  buildCoreNtlmRedirect,
  buildCrmNtlmRedirect,
  buildSignInRedirect,
  isProtectedApiRoute,
  resolveRootEntryRedirect,
} from "./proxy-auth-flow-routes";
import {
  hasRequiredCoreNtlmSession,
  hasRequiredCrmNtlmSession,
  type ProxySession,
} from "./proxy-auth-flow-session";
import type { ProxyAccessRequirements } from "./proxy-access";

export type HttpProxyAuthDecision =
  | { kind: "allow" }
  | { kind: "unauthorized-api" }
  | { kind: "redirect"; location: string; reason: string }
  | { kind: "root-entry-redirect"; location: string };

export type WebSocketProxyAuthDecision =
  | { kind: "allow" }
  | { kind: "unauthorized" };

export function resolveHttpProxyAuthDecision(input: {
  url: string;
  hostHeader: string;
  connector?: Connector;
  accessRequirements: Pick<
    ProxyAccessRequirements,
    "requiresAuth" | "needsSessionForNtlm" | "needsCoreNtlmSession"
  >;
  session: ProxySession;
}): HttpProxyAuthDecision {
  const {
    url,
    hostHeader,
    connector,
    accessRequirements,
    session,
  } = input;

  const { requiresAuth, needsSessionForNtlm, needsCoreNtlmSession } = accessRequirements;

  if (!session) {
    if (isProtectedApiRoute(url)) {
      return { kind: "unauthorized-api" };
    }

    if (needsCoreNtlmSession && connector) {
      return {
        kind: "redirect",
        location: buildCoreNtlmRedirect(connector, hostHeader, url),
        reason: "missing-core-ntlm-session",
      };
    }

    return {
      kind: "redirect",
      location:
        needsSessionForNtlm && !requiresAuth && connector
          ? buildCrmNtlmRedirect(connector, hostHeader, url)
          : buildSignInRedirect(hostHeader, url, connector),
      reason:
        needsSessionForNtlm && !requiresAuth
          ? "missing-ntlm-session"
          : "missing-sso-session",
    };
  }

  if (
    needsCoreNtlmSession &&
    connector &&
    !hasRequiredCoreNtlmSession(session, connector)
  ) {
    return {
      kind: "redirect",
      location: buildCoreNtlmRedirect(connector, hostHeader, url),
      reason: "connector-mismatch-core-ntlm-session",
    };
  }

  if (
    needsSessionForNtlm &&
    connector &&
    !hasRequiredCrmNtlmSession(session, connector) &&
    !isProtectedApiRoute(url)
  ) {
    return {
      kind: "redirect",
      location: buildCrmNtlmRedirect(connector, hostHeader, url),
      reason: "connector-mismatch-ntlm-session",
    };
  }

  const rootEntryPath = resolveRootEntryRedirect(connector);
  if (url === "/" && rootEntryPath && session) {
    return { kind: "root-entry-redirect", location: rootEntryPath };
  }

  return { kind: "allow" };
}

export function resolveWebSocketProxyAuthDecision(input: {
  connector: Connector;
  accessRequirements: Pick<
    ProxyAccessRequirements,
    "requiresAuth" | "needsSessionForNtlm" | "needsCoreNtlmSession"
  >;
  session: ProxySession;
}): WebSocketProxyAuthDecision {
  const { connector, accessRequirements, session } = input;

  if (
    !accessRequirements.requiresAuth &&
    !accessRequirements.needsSessionForNtlm &&
    !accessRequirements.needsCoreNtlmSession
  ) {
    return { kind: "allow" };
  }

  if (!session) {
    return { kind: "unauthorized" };
  }

  if (
    accessRequirements.needsCoreNtlmSession &&
    !hasRequiredCoreNtlmSession(session, connector)
  ) {
    return { kind: "unauthorized" };
  }

  if (
    accessRequirements.needsSessionForNtlm &&
    !hasRequiredCrmNtlmSession(session, connector)
  ) {
    return { kind: "unauthorized" };
  }

  return { kind: "allow" };
}
