import type { Connector } from "./connectors";
import type { GlobalSettings } from "./settings";
import {
  inferProtocol,
  isLocalHost,
  isLocalHostname,
  normalizeHost,
  normalizeProto,
} from "./auth-origin-host";
import { findConnectorByPort } from "./auth-origin-connector";

export type AuthOriginSource =
  | "forwarded-host"
  | "request-host"
  | "connector-public-host"
  | "settings-public-host"
  | "auth-url"
  | "unresolved";

export interface ResolvedAuthOrigin {
  forwardedHost: string;
  requestHost: string;
  canonicalConnectorHost: string;
  effectiveHost: string;
  effectiveProtocol: string;
  isLocalRequest: boolean;
  matchedConnector?: Connector;
  source: AuthOriginSource;
}

export { isLocalHost, isLocalHostname };

export interface ResolveAuthOriginInput {
  forwardedHost?: string | null;
  requestHost?: string | null;
  forwardedProto?: string | null;
  connectors: Connector[];
  settings?: Pick<GlobalSettings, "publicHost" | "authUrl"> | null;
  fallbackAuthUrl?: string | null;
}

export function resolveAuthOrigin({
  forwardedHost,
  requestHost,
  forwardedProto,
  connectors,
  settings,
  fallbackAuthUrl,
}: ResolveAuthOriginInput): ResolvedAuthOrigin {
  const normalizedForwardedHost = normalizeHost(forwardedHost);
  const normalizedRequestHost = normalizeHost(requestHost);
  const normalizedForwardedProto = normalizeProto(forwardedProto);
  const matchedConnector = findConnectorByPort(connectors, normalizedRequestHost, normalizedForwardedHost);
  const canonicalConnectorHost = normalizeHost(matchedConnector?.publicHost);
  const settingsPublicHost = normalizeHost(settings?.publicHost);
  const authUrl = (settings?.authUrl || fallbackAuthUrl || "").trim();

  if (normalizedForwardedHost && !isLocalHost(normalizedForwardedHost)) {
    return {
      forwardedHost: normalizedForwardedHost,
      requestHost: normalizedRequestHost,
      canonicalConnectorHost,
      effectiveHost: normalizedForwardedHost,
      effectiveProtocol: inferProtocol(normalizedForwardedHost, normalizedForwardedProto),
      isLocalRequest: false,
      matchedConnector,
      source: "forwarded-host",
    };
  }

  if (normalizedRequestHost) {
    return {
      forwardedHost: normalizedForwardedHost,
      requestHost: normalizedRequestHost,
      canonicalConnectorHost,
      effectiveHost: normalizedRequestHost,
      effectiveProtocol: inferProtocol(normalizedRequestHost, normalizedForwardedProto),
      isLocalRequest: isLocalHost(normalizedRequestHost),
      matchedConnector,
      source: "request-host",
    };
  }

  if (canonicalConnectorHost) {
    return {
      forwardedHost: normalizedForwardedHost,
      requestHost: normalizedRequestHost,
      canonicalConnectorHost,
      effectiveHost: canonicalConnectorHost,
      effectiveProtocol: inferProtocol(canonicalConnectorHost, normalizedForwardedProto),
      isLocalRequest: isLocalHost(canonicalConnectorHost),
      matchedConnector,
      source: "connector-public-host",
    };
  }

  if (settingsPublicHost) {
    return {
      forwardedHost: normalizedForwardedHost,
      requestHost: normalizedRequestHost,
      canonicalConnectorHost,
      effectiveHost: settingsPublicHost,
      effectiveProtocol: inferProtocol(settingsPublicHost, normalizedForwardedProto),
      isLocalRequest: isLocalHost(settingsPublicHost),
      matchedConnector,
      source: "settings-public-host",
    };
  }

  if (authUrl) {
    try {
      const parsed = new URL(authUrl);
      return {
        forwardedHost: normalizedForwardedHost,
        requestHost: normalizedRequestHost,
        canonicalConnectorHost,
        effectiveHost: normalizeHost(parsed.host),
        effectiveProtocol: normalizeProto(parsed.protocol) || "https",
        isLocalRequest: isLocalHostname(parsed.hostname),
        matchedConnector,
        source: "auth-url",
      };
    } catch {
      // Ignore malformed fallback URL and continue unresolved.
    }
  }

  return {
    forwardedHost: normalizedForwardedHost,
    requestHost: normalizedRequestHost,
    canonicalConnectorHost,
    effectiveHost: "",
    effectiveProtocol: normalizedForwardedProto || "https",
    isLocalRequest: false,
    matchedConnector,
    source: "unresolved",
  };
}
