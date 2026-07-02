import http from "http";
import type { Connector } from "./connectors";
import type { GlobalSettings } from "./settings";
import type { ProxySession } from "./proxy-session";
import type { ProxyPortHttpRateLimiter } from "./proxy-port-http";
import { createProxyPortHttpRequestHandler } from "./proxy-port-http";
import {
  createProxyPortWebSocketUpgradeHandler,
  type CreateProxyPortWebSocketUpgradeHandlerInput,
} from "./proxy-port-websocket";

export interface CreateProxyPortServerInput {
  port: number;
  rateLimiter: ProxyPortHttpRateLimiter;
  loadContext: () => Promise<{
    connectors: Connector[];
    settings: GlobalSettings;
  }>;
  verifySession: (cookieHeader: string) => Promise<ProxySession | null>;
  forwardToInternalDashboard: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    hostHeader: string,
  ) => void;
  handleConnectorRequest: (
    connector: Connector,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    session: ProxySession | null,
    settings: GlobalSettings,
  ) => void;
  webSocketBackend: Pick<
    CreateProxyPortWebSocketUpgradeHandlerInput,
    "connectBackendSocket"
  >;
  log: (message: string, type?: "info" | "error" | "system") => void;
  createHttpServer?: (
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>,
  ) => http.Server;
}

export function createProxyPortServer(input: CreateProxyPortServerInput): http.Server {
  const createHttpServer = input.createHttpServer || http.createServer;
  const server = createHttpServer(
    createProxyPortHttpRequestHandler({
      port: input.port,
      rateLimiter: input.rateLimiter,
      loadContext: input.loadContext,
      verifySession: input.verifySession,
      forwardToInternalDashboard: input.forwardToInternalDashboard,
      handleConnectorRequest: input.handleConnectorRequest,
      log: input.log,
    }),
  );

  server.on(
    "upgrade",
    createProxyPortWebSocketUpgradeHandler({
      loadContext: input.loadContext,
      verifySession: input.verifySession,
      connectBackendSocket: input.webSocketBackend.connectBackendSocket,
      log: input.log,
    }),
  );

  return server;
}
