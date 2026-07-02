import http from "http";
import https from "https";

import { Connector } from "./connectors";
import { logHB as rawLogHB } from "./logger-hb";
import { getRulesFor } from "./rules";
import {
  createProxyHeartbeatState,
} from "./proxy-heartbeat";
import { handleProxyControlRoute } from "./proxy-control-routes";
import {
  createProxyServerRequestContext,
  describeProxyExecutionMode,
} from "./proxy-server-request-context";
import { handleProxyNtlmHandshake } from "./proxy-server-ntlm";
import {
  createProxyDebugLogger,
  createProxyServerStatusEvents,
  createProxyStatusEmitter,
  createProxyTrafficEntryBuilder,
} from "./proxy-server-observability";
import {
  bindProxyServerHeartbeatLifecycle,
  createProxyServerHeartbeatController,
} from "./proxy-server-heartbeat";
import {
  ensureProxyServerRuntime,
  getProxyServerMaxBodyBytes,
} from "./proxy-server-runtime";
import { runProxyServerStandardFlow } from "./proxy-server-standard-flow";

export type MetricCallback = (id: string, bytes: number, latency?: number) => void;

export function createProxyServer(
  connector: Connector,
  onMetric: MetricCallback,
  hbFirstPulseMs: number,
) {
  ensureProxyServerRuntime();

  const logHB = (message: string) => rawLogHB(connector.id, message);
  const targetUrl = new URL(connector.targetUrl);
  const isHttps = targetUrl.protocol === "https:";
  const statusEvents = createProxyServerStatusEvents();
  const agent = isHttps
    ? new https.Agent({ keepAlive: true, rejectUnauthorized: connector.strictTls === true })
    : new http.Agent({ keepAlive: true });

  const server = http.createServer((req, res) => {
    const startTime = Date.now();
    const emitStatus = createProxyStatusEmitter(statusEvents, connector.id);

    if (handleProxyControlRoute({ req, res, statusEvents })) {
      return;
    }

    const requestContext = createProxyServerRequestContext({
      connector,
      req,
      targetUrl,
      isHttps,
      agent,
    });

    const heartbeatState = createProxyHeartbeatState();
    const rules = getRulesFor(connector.connectorType);

    const logDebugEntry = createProxyDebugLogger({
      connector,
      req,
    });
    logDebugEntry("[REQUEST-IN]", describeProxyExecutionMode(requestContext));

    const buildTrafficEntry = createProxyTrafficEntryBuilder({
      connector,
      req,
      startTime,
      isAjax: requestContext.isAjax,
    });

    const { emitHeartbeatEnd, startHeartbeatShield } = createProxyServerHeartbeatController({
      connector,
      req,
      res,
      requestContext,
      heartbeatState,
      startTime,
      hbFirstPulseMs,
      emitStatus,
      logHB,
      logDebugEntry,
    });

    bindProxyServerHeartbeatLifecycle({
      req,
      res,
      requestContext,
      heartbeatState,
      startTime,
      logHB,
      startHeartbeatShield,
      emitHeartbeatEnd,
    });

    if (
      handleProxyNtlmHandshake({
        connector,
        req,
        res,
        session: (req as http.IncomingMessage & { session?: unknown }).session,
        effectiveReqUrl: requestContext.effectiveReqUrl,
        incomingHost: requestContext.incomingHost,
        urlPart: requestContext.urlPart,
        proto: requestContext.proto,
        targetUrl,
        agent,
        heartbeatState,
        hbEligible: requestContext.hbEligible,
        startHeartbeatShield,
        clearHeartbeatTimers: () => {
          if (heartbeatState.hbTimer) {
            clearTimeout(heartbeatState.hbTimer);
          }
          if (heartbeatState.hbInterval) {
            clearInterval(heartbeatState.hbInterval);
          }
        },
        startTime,
        onMetric,
        buildTrafficEntry,
        logHB,
      })
    ) {
      return;
    }

    runProxyServerStandardFlow({
      connector,
      req,
      res,
      requestContext,
      heartbeatState,
      targetUrl,
      isHttps,
      startTime,
      onMetric,
      buildTrafficEntry,
      logHB,
      logDebugEntry,
      getRedirectScript: (location, isHtmlCommentOpen) => {
        return rules.getRedirectScript(location, isHtmlCommentOpen);
      },
      maxBodyBytes: getProxyServerMaxBodyBytes(),
    });
  });

  return server;
}
