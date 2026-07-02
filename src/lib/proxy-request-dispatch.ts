import type { IncomingMessage, ServerResponse } from "http";
import type { GlobalSettings } from "./settings";
import type { Connector } from "./connectors";
import {
  createProxyMetricCallback,
  emitProxyRequest,
  ensureConnectorProxyServer,
  registerProxyRequest,
  type ProxyRuntimeStats,
  type ProxyServerCacheEntry,
} from "./proxy-lifecycle";

export interface DispatchProxyConnectorRequestInput {
  connector: Connector;
  req: IncomingMessage;
  res: ServerResponse;
  settings: GlobalSettings;
  stats: Map<string, ProxyRuntimeStats>;
  proxyServers: Map<string, ProxyServerCacheEntry>;
  markStatsPending: () => void;
  log: (message: string, type?: "info" | "error" | "system") => void;
}

export function dispatchProxyConnectorRequest(
  input: DispatchProxyConnectorRequestInput,
): void {
  registerProxyRequest(input.stats, input.connector.id);
  input.markStatsPending();

  try {
    const proxyServer = ensureConnectorProxyServer({
      connector: input.connector,
      settings: input.settings,
      cache: input.proxyServers,
      createMetricCallback: () =>
        createProxyMetricCallback({
          stats: input.stats,
          markStatsPending: input.markStatsPending,
        }),
      onRecreate: (connectorId) => {
        input.log(
          `[BIZGUARD] Configuración de ${connectorId} cambió. Recreando proxy server.`,
          "system",
        );
      },
    });

    input.log(
      `[BIZGUARD-IN] ${input.req.method} ${input.req.url} -> ${input.connector.id}`,
      "info",
    );
    emitProxyRequest(proxyServer, input.req, input.res);
  } catch (error) {
    input.log(`[BIZGUARD Error] Proxy failed for ${input.connector.id}: ${error}`, "error");
    if (!input.res.headersSent) {
      input.res.writeHead(502);
      input.res.end("BizGuard Proxy Error");
    }
  }
}
