import net from "net";
import type { ProxyStatsEntry } from "./proxy-observability";
import { buildConnectorPingCandidates, probeConnectorTarget } from "./proxy-monitoring-target";

export interface PingEndpoint {
  host: string;
  port: number;
  label: string;
}

export interface HttpProbeResult {
  online: boolean;
  detail: string;
}

export interface ConnectorPingResult {
  online: boolean;
  detail: string;
  latency: number;
}

export const CLOUDFLARE_PING_ENDPOINTS: readonly PingEndpoint[] = [
  { host: "region1.v2.argotunnel.com", port: 7844, label: "region1.argotunnel" },
  { host: "region2.v2.argotunnel.com", port: 7844, label: "region2.argotunnel" },
  { host: "api.cloudflare.com", port: 443, label: "api.cloudflare.com" },
  { host: "update.argotunnel.com", port: 443, label: "update.argotunnel" },
];

export { buildConnectorPingCandidates, probeConnectorTarget };

export function applyConnectorPingToStats(
  currentStats: ProxyStatsEntry,
  result: Pick<ConnectorPingResult, "online" | "latency">,
): ProxyStatsEntry {
  return {
    ...currentStats,
    activePing: result.online ? result.latency : -1,
    isOnline: result.online,
  };
}

export function pingTcpEndpoint(
  endpoint: PingEndpoint,
  socketFactory: () => net.Socket = () => new net.Socket(),
): Promise<number> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const socket = socketFactory();

    socket.setTimeout(5000);
    socket.connect(endpoint.port, endpoint.host, () => {
      resolve(Date.now() - startedAt);
      socket.destroy();
    });

    socket.on("error", () => {
      resolve(-1);
      socket.destroy();
    });

    socket.on("timeout", () => {
      resolve(-1);
      socket.destroy();
    });
  });
}
