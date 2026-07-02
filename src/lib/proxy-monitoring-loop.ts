import type { Connector } from "./connectors";
import {
  applyConnectorPingToStats,
  CLOUDFLARE_PING_ENDPOINTS,
  pingTcpEndpoint,
  probeConnectorTarget,
  type ConnectorPingResult,
  type PingEndpoint,
} from "./proxy-monitoring";
import type { ProxyStatsEntry } from "./proxy-observability";

export interface RunProxyMonitoringCycleInput {
  connectors: Connector[];
  stats: Map<string, ProxyStatsEntry>;
  pingStats: Record<string, number>;
  markStatsPending: () => void;
  logInfo: (message: string) => void;
  logError: (message: string) => void;
  pingEndpoints?: readonly PingEndpoint[];
  probeConnector?: (targetUrl: string) => Promise<ConnectorPingResult>;
  pingEndpoint?: (endpoint: PingEndpoint) => Promise<number>;
}

export function updateProxyEndpointPingState(input: {
  pingStats: Record<string, number>;
  endpoint: PingEndpoint;
  latency: number;
  markStatsPending: () => void;
}) {
  input.pingStats[input.endpoint.label] = input.latency;
  input.markStatsPending();
}

export function updateProxyConnectorPingState(input: {
  stats: Map<string, ProxyStatsEntry>;
  connectorId: string;
  result: Pick<ConnectorPingResult, "online" | "latency">;
  markStatsPending: () => void;
}) {
  const currentStats = input.stats.get(input.connectorId) || { requests: 0, bytes: 0 };
  input.stats.set(
    input.connectorId,
    applyConnectorPingToStats(currentStats, input.result),
  );
  input.markStatsPending();
}

export async function runProxyMonitoringCycle(
  input: RunProxyMonitoringCycleInput,
): Promise<void> {
  const pingEndpoints = input.pingEndpoints || CLOUDFLARE_PING_ENDPOINTS;
  const probeConnector = input.probeConnector || probeConnectorTarget;
  const pingEndpoint = input.pingEndpoint || pingTcpEndpoint;

  await Promise.all(
    pingEndpoints.map(async (endpoint) => {
      const latency = await pingEndpoint(endpoint);
      updateProxyEndpointPingState({
        pingStats: input.pingStats,
        endpoint,
        latency,
        markStatsPending: input.markStatsPending,
      });
    }),
  );

  await Promise.all(
    input.connectors
      .filter((connector) => connector.isActive)
      .map(async (connector) => {
        try {
          const result = await probeConnector(connector.targetUrl);
          input.logInfo(
            `[PING-RESULT] ${connector.id} | URL: ${connector.targetUrl} | Online: ${result.online} | Latency: ${result.latency}ms | ${result.detail}`,
          );
          updateProxyConnectorPingState({
            stats: input.stats,
            connectorId: connector.id,
            result,
            markStatsPending: input.markStatsPending,
          });
        } catch (error: any) {
          input.logError(
            `[PING-FATAL] ${connector.id} | URL: ${connector.targetUrl} | ${error.message}`,
          );
          updateProxyConnectorPingState({
            stats: input.stats,
            connectorId: connector.id,
            result: { online: false, latency: -1 },
            markStatsPending: input.markStatsPending,
          });
        }
      }),
  );
}
