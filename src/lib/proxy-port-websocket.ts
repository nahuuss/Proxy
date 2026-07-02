import type http from "http";
import net from "net";
import tls from "tls";
import type { Connector } from "./connectors";
import type { GlobalSettings } from "./settings";
import { authorizeProxyPortWebSocketUpgrade } from "./proxy-port-websocket-auth";
import { bridgeProxyPortWebSocketConnection } from "./proxy-port-websocket-bridge";
import { resolvePortConnectorForHost } from "./proxy-port-routing";
import type { ProxySession } from "./proxy-session";
import {
  buildWebSocketProxyRequest,
  buildWebSocketUpgradeFailureResponse,
  resolveWebSocketBackendTarget,
} from "./proxy-websocket";
import { normalizeProxyRequestUrlForConnector } from "./product-profiles";

export interface ProxyPortWebSocketContext {
  connectors: Connector[];
  settings: GlobalSettings;
}

export interface ProxyPortWebSocketLikeSocket {
  destroyed: boolean;
  write(data: string | Buffer): unknown;
  destroy(): void;
  pipe(destination: unknown): unknown;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  once(event: string, listener: (...args: unknown[]) => void): unknown;
}

export interface CreateProxyPortWebSocketUpgradeHandlerInput {
  loadContext: () => Promise<ProxyPortWebSocketContext>;
  verifySession: (cookieHeader: string) => Promise<ProxySession | null>;
  connectBackendSocket: (input: {
    connector: Connector;
    targetHost: string;
    targetPort: number;
    isHttps: boolean;
  }) => ProxyPortWebSocketLikeSocket;
  log: (message: string, type?: "info" | "error" | "system") => void;
}

export function createProxyPortWebSocketUpgradeHandler(
  input: CreateProxyPortWebSocketUpgradeHandlerInput,
) {
  return async (
    req: http.IncomingMessage,
    socket: ProxyPortWebSocketLikeSocket,
    head: Buffer,
  ) => {
    const hostHeader = req.headers.host || "";
    const context = await input.loadContext();
    const portResolution = resolvePortConnectorForHost(context.connectors, hostHeader);
    const connector = portResolution.activeConnector;

    if (!connector) {
      socket.write(buildWebSocketUpgradeFailureResponse(502));
      socket.destroy();
      return;
    }

    let accessRequirements;
    try {
      const authResult = await authorizeProxyPortWebSocketUpgrade({
        connector,
        settings: context.settings,
        req,
        verifySession: input.verifySession,
      });
      if (authResult.kind === "handled") {
        socket.write(buildWebSocketUpgradeFailureResponse(401));
        socket.destroy();
        return;
      }
      accessRequirements = authResult.accessRequirements;
    } catch {
      socket.write(buildWebSocketUpgradeFailureResponse(502));
      socket.destroy();
      return;
    }

    const normalizedUpgradeUrl = normalizeProxyRequestUrlForConnector(
      connector,
      req.url || "/",
    );

    const targetUrl = new URL(connector.targetUrl);
    const { isHttps, targetHost, targetPort } = resolveWebSocketBackendTarget(targetUrl);
    const wsRequest = buildWebSocketProxyRequest({
      method: req.method,
      normalizedRequestUrl: normalizedUpgradeUrl,
      requestHeaders: req.headers,
      hostHeader,
      remoteAddress: req.socket.remoteAddress,
      targetUrl,
      isLocalHost: accessRequirements.isLocalHost,
    });

    const backendSocket = input.connectBackendSocket({
      connector,
      targetHost,
      targetPort,
      isHttps,
    });
    const onReady = isHttps ? "secureConnect" : "connect";

    bridgeProxyPortWebSocketConnection({
      connector,
      req,
      clientSocket: socket,
      backendSocket,
      requestPayload: wsRequest.requestPayload,
      head,
      onReadyEvent: onReady,
      log: input.log,
    });
  };
}

export function connectProxyPortWebSocketBackend(input: {
  connector: Connector;
  targetHost: string;
  targetPort: number;
  isHttps: boolean;
}): net.Socket | tls.TLSSocket {
  if (input.isHttps) {
    return tls.connect({
      host: input.targetHost,
      port: input.targetPort,
      servername: input.targetHost,
      rejectUnauthorized: input.connector.strictTls === true,
    });
  }

  return net.connect({
    host: input.targetHost,
    port: input.targetPort,
  });
}
