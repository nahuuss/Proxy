export interface AuthAuthorizedDecisionInput {
  host: string;
  pathname: string;
  isLoggedIn: boolean;
  settingsBypass: boolean;
  connectorBypass: boolean;
}

export interface AuthAuthorizedDecision {
  allow: boolean;
  reason:
    | "localhost-bypass"
    | "connector-bypass"
    | "global-bypass"
    | "proxy-route-allow"
    | "proxy-route-deny"
    | "non-proxy-route-allow";
}

export function isProxyProtectedPath(pathname: string): boolean {
  return pathname.startsWith("/proxy") || pathname === "/";
}

export function getAuthAuthorizedDecision(input: AuthAuthorizedDecisionInput): AuthAuthorizedDecision {
  if (input.host.includes(":3000")) {
    return { allow: true, reason: "localhost-bypass" };
  }

  if (input.connectorBypass) {
    return { allow: true, reason: "connector-bypass" };
  }

  if (input.settingsBypass) {
    return { allow: true, reason: "global-bypass" };
  }

  if (isProxyProtectedPath(input.pathname)) {
    return input.isLoggedIn
      ? { allow: true, reason: "proxy-route-allow" }
      : { allow: false, reason: "proxy-route-deny" };
  }

  return { allow: true, reason: "non-proxy-route-allow" };
}
