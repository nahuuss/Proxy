import type { ServerResponse, IncomingMessage } from "http";
import type { Connector } from "./connectors";
import { createProxyServer } from "./proxy-server";
import {
  findPausedConnectorForHost,
  selectActiveConnectorForHost,
} from "./proxy-routing";

export const INTERNAL_DASHBOARD_CONNECTOR_ID = "internal-dashboard";

export interface PortConnectorResolution {
  activeConnector?: Connector;
  pausedConnector?: Connector;
  requestedHost: string;
}

export function isLocalDashboardHost(hostHeader: string): boolean {
  return hostHeader.includes("localhost") || hostHeader.includes("127.0.0.1");
}

export function buildInternalDashboardConnector(hostHeader: string): Connector {
  return {
    id: INTERNAL_DASHBOARD_CONNECTOR_ID,
    name: "Internal BizGuard Dashboard",
    description: "Maneja autenticacion y recursos estaticos internamente",
    port: 3000,
    targetUrl: "http://127.0.0.1:3000",
    publicHost: hostHeader,
    isActive: true,
    connectorType: "generic",
    productConfig: {},
  };
}

export function ensureInternalDashboardProxyServer(input: {
  proxyServers: Map<string, { server: ReturnType<typeof createProxyServer>; connector: Connector }>;
  hostHeader: string;
}): ReturnType<typeof createProxyServer> {
  const cached = input.proxyServers.get(INTERNAL_DASHBOARD_CONNECTOR_ID);
  if (cached) return cached.server;

  const connector = buildInternalDashboardConnector(input.hostHeader);
  const server = createProxyServer(connector, () => {}, 20_000);
  input.proxyServers.set(INTERNAL_DASHBOARD_CONNECTOR_ID, {
    server,
    connector,
  });
  return server;
}

export function applyInternalDashboardForwardHeaders(
  req: IncomingMessage,
  hostHeader: string,
): void {
  req.headers["x-forwarded-host"] = hostHeader;
  req.headers["x-forwarded-proto"] = isLocalDashboardHost(hostHeader) ? "http" : "https";
}

export function resolvePortConnectorForHost(
  connectors: Connector[],
  hostHeader: string,
): PortConnectorResolution {
  const activeConnector = selectActiveConnectorForHost(connectors, hostHeader);
  const pausedConnector = activeConnector
    ? undefined
    : findPausedConnectorForHost(connectors, hostHeader);

  return {
    activeConnector,
    pausedConnector,
    requestedHost: hostHeader.split(":")[0] || "",
  };
}

export function writePausedConnectorResponse(
  res: ServerResponse,
): void {
  res.writeHead(503, { "Content-Type": "text/plain" });
  res.end("BizGuard: Connector is paused.");
}

export function writeMissingConnectorResponse(
  res: ServerResponse,
): void {
  res.writeHead(404);
  res.end("BizGuard Gateway Error: Host not configured on this port.");
}
