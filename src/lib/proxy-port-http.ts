import type http from "http";
import type { Connector } from "./connectors";
import type { GlobalSettings } from "./settings";
import { handleProxyPortHttpAuth } from "./proxy-port-http-auth";
import {
  isInternalDashboardRoute,
} from "./proxy-routing";
import {
  resolvePortConnectorForHost,
  writeMissingConnectorResponse,
  writePausedConnectorResponse,
} from "./proxy-port-routing";
import { hasKnownProxySessionCookie, type ProxySession } from "./proxy-session";
import { resolveRequestClientIp } from "./proxy-rate-limit";

export interface ProxyPortHttpContext {
  connectors: Connector[];
  settings: GlobalSettings;
}

export interface ProxyPortHttpRateLimiter {
  check(ip: string): boolean;
}

export interface CreateProxyPortHttpRequestHandlerInput {
  port: number;
  rateLimiter: ProxyPortHttpRateLimiter;
  loadContext: () => Promise<ProxyPortHttpContext>;
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
  log: (message: string, type?: "info" | "error" | "system") => void;
}

export function createProxyPortHttpRequestHandler(
  input: CreateProxyPortHttpRequestHandlerInput,
) {
  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const clientIp = resolveRequestClientIp(
      req.headers as Record<string, string | string[] | undefined>,
      req.socket.remoteAddress,
    );
    const cookieHeader = req.headers.cookie || "";
    const hasCookieSession = hasKnownProxySessionCookie(cookieHeader);

    if (!hasCookieSession && !input.rateLimiter.check(clientIp)) {
      res.writeHead(429, { "Content-Type": "text/plain", "Retry-After": "60" });
      res.end("Too Many Requests");
      return;
    }

    const url = req.url || "";
    const hostHeader = req.headers.host || "";
    const context = await input.loadContext();

    if (isInternalDashboardRoute(url)) {
      input.forwardToInternalDashboard(req, res, hostHeader);
      return;
    }

    const portResolution = resolvePortConnectorForHost(context.connectors, hostHeader);
    const connector = portResolution.activeConnector;

    if (!connector) {
      const pausedConnector = portResolution.pausedConnector;
      if (pausedConnector) {
        input.log(
          `[BIZGUARD] Connector ${pausedConnector.id} is paused. Returning 503.`,
          "info",
        );
        writePausedConnectorResponse(res);
        return;
      }
    }

    let session: ProxySession | null = null;
    if (connector) {
      try {
        const authResult = await handleProxyPortHttpAuth({
          url,
          hostHeader,
          connector,
          settings: context.settings,
          cookieHeader,
          req,
          res,
          verifySession: input.verifySession,
          log: input.log,
        });
        session = authResult.session;
        if (authResult.kind === "handled") {
          return;
        }
      } catch (error) {
        input.log(`[BIZGUARD-Auth] Critical failure: ${error}`, "error");
        res.writeHead(502);
        res.end("BizGuard Authorization Error");
        return;
      }
    }

    if (!connector) {
      input.log(
        `[BIZGUARD] No service found for host: ${portResolution.requestedHost} on port ${input.port}`,
        "error",
      );
      writeMissingConnectorResponse(res);
      return;
    }

    input.handleConnectorRequest(connector, req, res, session, context.settings);
  };
}
