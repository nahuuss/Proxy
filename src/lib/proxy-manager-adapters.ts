import type http from "http";
import type { Connector } from "./connectors";
import type { GlobalSettings } from "./settings";
import { emitProxyRequest, type ProxyServerCacheEntry } from "./proxy-lifecycle";
import {
  applyInternalDashboardForwardHeaders,
  ensureInternalDashboardProxyServer,
} from "./proxy-port-routing";
import { loadProxyPortRuntimeContext, type ProxyPortRuntimeContext } from "./proxy-manager-context";

export function createProxyManagerStatsPendingMarker(input: {
  setStatsPending: (nextValue: boolean) => void;
}): () => void {
  return () => {
    input.setStatsPending(true);
  };
}

export function createProxyManagerLogger(input: {
  log: (message: string, type?: "info" | "error" | "system") => void;
}): (message: string, type?: "info" | "error" | "system") => void {
  return (message, type) => {
    input.log(message, type);
  };
}

export function createProxyPortContextLoader(
  port: number,
  input: {
    loadConnectors: () => Promise<Connector[]>;
    loadSettings: () => Promise<GlobalSettings>;
  },
): () => Promise<ProxyPortRuntimeContext> {
  return () => loadProxyPortRuntimeContext(port, input);
}

export function createInternalDashboardForwarder(input: {
  proxyServers: Map<string, ProxyServerCacheEntry>;
}): (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  hostHeader: string,
) => void {
  return (req, res, hostHeader) => {
    applyInternalDashboardForwardHeaders(req, hostHeader);
    const dashboardProxy = ensureInternalDashboardProxyServer({
      proxyServers: input.proxyServers,
      hostHeader,
    });
    emitProxyRequest(dashboardProxy, req, res);
  };
}
