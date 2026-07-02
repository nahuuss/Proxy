import type { Connector } from "./connectors";

function normalizeHost(hostHeader: string): string {
  return (hostHeader.split(":")[0] || "").trim().toLowerCase();
}

export function isInternalDashboardRoute(url: string): boolean {
  const urlPath = (url.split("?")[0] || "").toLowerCase();

  return (
    url.startsWith("/api/auth") ||
    url.startsWith("/api/stats") ||
    url.includes("_next") ||
    url.includes("favicon") ||
    urlPath === "/login" ||
    urlPath.startsWith("/login/")
  );
}

export function selectActiveConnectorForHost(
  connectors: Connector[],
  hostHeader: string,
): Connector | undefined {
  const normalizedHost = normalizeHost(hostHeader);
  const activeConnectors = connectors.filter((connector) => connector.isActive);
  const matchedConnector = activeConnectors.find(
    (connector) => normalizeHost(connector.publicHost || "") === normalizedHost,
  );

  if (matchedConnector) return matchedConnector;
  if (activeConnectors.length === 1) return activeConnectors[0];
  return undefined;
}

export function findPausedConnectorForHost(
  connectors: Connector[],
  hostHeader: string,
): Connector | undefined {
  const normalizedHost = normalizeHost(hostHeader);
  return connectors.find(
    (connector) =>
      !connector.isActive &&
      normalizeHost(connector.publicHost || "") === normalizedHost,
  );
}
