import http from "http";
import type { Connector } from "./connectors";
import { getConnectors } from "./connectors";
import type { GlobalSettings } from "./settings";
import { getSettings } from "./settings";
import type { ProxyServerCacheEntry } from "./proxy-lifecycle";
import { refreshProxyPortBinding } from "./proxy-port-lifecycle";
import { createProxyPortServer } from "./proxy-port-server";
import { dispatchProxyConnectorRequest } from "./proxy-request-dispatch";
import { connectProxyPortWebSocketBackend } from "./proxy-port-websocket";
import type { ProxyStatsEntry } from "./proxy-observability";
import {
  createInternalDashboardForwarder,
  createProxyPortContextLoader,
} from "./proxy-manager-adapters";
import { findProxyConnectorPort, listProxyPorts } from "./proxy-manager-context";
import type { ProxySession } from "./proxy-session";
import { verifyProxySession } from "./proxy-session";
import type { ProxyPortHttpRateLimiter } from "./proxy-port-http";

export interface CreateProxyManagerPortControllerInput {
  servers: Map<number, http.Server>;
  proxyServers: Map<string, ProxyServerCacheEntry>;
  stats: Map<string, ProxyStatsEntry>;
  markStatsPending: () => void;
  log: (message: string, type?: "info" | "error" | "system") => void;
  rateLimiter: ProxyPortHttpRateLimiter;
  loadConnectors?: typeof getConnectors;
  loadSettings?: typeof getSettings;
  verifySession?: typeof verifyProxySession;
  refreshPortBinding?: typeof refreshProxyPortBinding;
  buildPortServer?: typeof createProxyPortServer;
  dispatchRequest?: typeof dispatchProxyConnectorRequest;
  listPorts?: typeof listProxyPorts;
  findConnectorPort?: typeof findProxyConnectorPort;
}

export interface ProxyManagerPortController {
  init: () => Promise<void>;
  refreshPort: (port: number) => Promise<void>;
  startConnector: (connector: Connector) => Promise<void>;
  stopConnector: (id: string) => void;
}

export function createProxyManagerPortController(
  input: CreateProxyManagerPortControllerInput,
): ProxyManagerPortController {
  const loadConnectors = input.loadConnectors || getConnectors;
  const loadSettings = input.loadSettings || getSettings;
  const verifySession = input.verifySession || verifyProxySession;
  const refreshPortBinding = input.refreshPortBinding || refreshProxyPortBinding;
  const buildPortServer = input.buildPortServer || createProxyPortServer;
  const dispatchRequest = input.dispatchRequest || dispatchProxyConnectorRequest;
  const listPorts = input.listPorts || listProxyPorts;
  const findConnectorPort = input.findConnectorPort || findProxyConnectorPort;

  function handleConnectorRequest(
    connector: Connector,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    _session: ProxySession | null,
    settings: GlobalSettings,
  ) {
    dispatchRequest({
      connector,
      req,
      res,
      settings,
      stats: input.stats,
      proxyServers: input.proxyServers,
      markStatsPending: input.markStatsPending,
      log: input.log,
    });
  }

  function createServerForPort(port: number) {
    return buildPortServer({
      port,
      rateLimiter: input.rateLimiter,
      loadContext: createProxyPortContextLoader(port, {
        loadConnectors,
        loadSettings,
      }),
      verifySession,
      forwardToInternalDashboard: createInternalDashboardForwarder({
        proxyServers: input.proxyServers,
      }),
      handleConnectorRequest,
      webSocketBackend: {
        connectBackendSocket: connectProxyPortWebSocketBackend,
      },
      log: input.log,
    });
  }

  async function refreshPort(port: number) {
    const connectors = (await loadConnectors()).filter((connector) => connector.port === port);
    await refreshPortBinding({
      port,
      servers: input.servers,
      connectors,
      createServer: () => createServerForPort(port),
      log: input.log,
    });
  }

  async function init() {
    const ports = listPorts(await loadConnectors());
    for (const port of ports) {
      void refreshPort(port);
    }
  }

  async function startConnector(connector: Connector) {
    input.proxyServers.delete(connector.id);
    await refreshPort(connector.port);
  }

  function stopConnector(id: string) {
    input.proxyServers.delete(id);
    void findConnectorPort(id, loadConnectors).then((port) => {
      if (port !== null) {
        void refreshPort(port);
      }
    });
  }

  return {
    init,
    refreshPort,
    startConnector,
    stopConnector,
  };
}
