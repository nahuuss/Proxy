import type { Connector } from "./connectors";
import type { GlobalSettings } from "./settings";
import { isLocalHostname, resolveAuthOrigin } from "./auth-origin";

export interface ResolveLoginEntryInput {
  callbackUrl?: string | null;
  forwardedHost?: string | null;
  requestHost?: string | null;
  forwardedProto?: string | null;
  connectors: Connector[];
  settings: GlobalSettings;
  fallbackAuthUrl?: string | null;
}

export interface LoginEntryResolution {
  matchedConnector?: Connector;
  effectiveCallbackUrl: string;
  shouldBypassSso: boolean;
  bypassRedirectUrl: string;
  reason: string;
}

function buildOrigin(protocol: string, host: string): string {
  return `${protocol}://${host}`;
}

function buildDefaultReturnUrl(protocol: string, host: string, connector?: Connector): string {
  const entryPath = connector?.entryPath?.trim() || "/";
  const normalizedPath = entryPath.startsWith("/") ? entryPath : `/${entryPath}`;
  return `${buildOrigin(protocol, host)}${normalizedPath}`;
}

function sanitizeCallbackUrl(
  rawCallbackUrl: string | undefined,
  protocol: string,
  host: string,
  isLocalRequest: boolean,
  connector?: Connector,
): string {
  const defaultReturnUrl = buildDefaultReturnUrl(protocol, host, connector);

  if (!rawCallbackUrl) {
    return defaultReturnUrl;
  }

  if (rawCallbackUrl.startsWith("/")) {
    return `${buildOrigin(protocol, host)}${rawCallbackUrl}`;
  }

  try {
    const parsed = new URL(rawCallbackUrl);
    const parsedHost = parsed.host.toLowerCase();
    const effectiveHost = host.toLowerCase();

    if (parsedHost === effectiveHost) {
      return parsed.toString();
    }

    if (isLocalRequest) {
      return isLocalHostname(parsed.hostname) ? parsed.toString() : defaultReturnUrl;
    }

    return parsed.toString();
  } catch {
    return defaultReturnUrl;
  }
}

export function resolveLoginEntry({
  callbackUrl,
  forwardedHost,
  requestHost,
  forwardedProto,
  connectors,
  settings,
  fallbackAuthUrl,
}: ResolveLoginEntryInput): LoginEntryResolution {
  const origin = resolveAuthOrigin({
    forwardedHost,
    requestHost,
    forwardedProto,
    connectors,
    settings,
    fallbackAuthUrl,
  });

  const effectiveHost = origin.effectiveHost;
  const effectiveProtocol = origin.effectiveProtocol || "https";
  const matchedConnector = origin.matchedConnector;
  const effectiveCallbackUrl = effectiveHost
    ? sanitizeCallbackUrl(callbackUrl || undefined, effectiveProtocol, effectiveHost, origin.isLocalRequest, matchedConnector)
    : callbackUrl || "/";
  const shouldBypassSso = Boolean(settings.bypassAuth || matchedConnector?.bypassAuth);

  return {
    matchedConnector,
    effectiveCallbackUrl,
    shouldBypassSso,
    bypassRedirectUrl: effectiveCallbackUrl,
    reason: shouldBypassSso
      ? matchedConnector?.bypassAuth
        ? "connector-bypass"
        : "global-bypass"
      : origin.isLocalRequest
        ? "local-login"
        : "standard-login",
  };
}
