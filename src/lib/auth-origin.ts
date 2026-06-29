import type { Connector } from "./connectors";
import type { GlobalSettings } from "./settings";

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

function normalizeHost(host?: string | null): string {
  return (host || "").trim().toLowerCase();
}

function normalizeProto(proto?: string | null): string {
  const cleaned = (proto || "").trim().toLowerCase();
  if (!cleaned) return "";
  return cleaned.replace(/:$/, "");
}

function getHostname(host: string): string {
  return host.split(":")[0] || "";
}

function getPort(host: string): number | undefined {
  const portCandidate = host.split(":")[1];
  if (!portCandidate) return undefined;
  const parsed = parseInt(portCandidate, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}

export function isLocalHost(host: string): boolean {
  return isLocalHostname(getHostname(normalizeHost(host)));
}

function inferProtocol(host: string, forwardedProto: string): string {
  if (forwardedProto) return forwardedProto;
  return isLocalHost(host) ? "http" : "https";
}

function findConnectorByPort(connectors: Connector[], ...hosts: string[]): Connector | undefined {
  for (const host of hosts) {
    const port = getPort(normalizeHost(host));
    if (!port) continue;
    const connector = connectors.find((candidate) => candidate.port === port);
    if (connector) return connector;
  }
  if (connectors.length === 1) return connectors[0];
  return undefined;
}

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
