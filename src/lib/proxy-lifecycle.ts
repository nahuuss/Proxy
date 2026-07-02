import type { IncomingMessage, ServerResponse } from "http";
import type { GlobalSettings } from "./settings";
import type { Connector } from "./connectors";
import { createProxyServer, type MetricCallback } from "./proxy-server";
import { hasConnectorRuntimeConfigChanged } from "./connector-runtime";

export interface ProxyServerCacheEntry {
  server: ReturnType<typeof createProxyServer>;
  connector: Connector;
}

export interface ProxyRuntimeStats {
  requests: number;
  bytes: number;
  latency?: number;
}

export function ensureProxyStatsEntry(
  stats: Map<string, ProxyRuntimeStats>,
  connectorId: string,
): ProxyRuntimeStats {
  const current = stats.get(connectorId);
  if (current) return current;

  const initial = { requests: 0, bytes: 0, latency: 0 };
  stats.set(connectorId, initial);
  return initial;
}

export function registerProxyRequest(
  stats: Map<string, ProxyRuntimeStats>,
  connectorId: string,
): ProxyRuntimeStats {
  const current = ensureProxyStatsEntry(stats, connectorId);
  current.requests++;
  return current;
}

export function resolveHeartbeatFirstPulseMs(
  connector: Pick<Connector, "hbFirstPulse">,
  settings: Pick<GlobalSettings, "hbFirstPulse">,
): number {
  const firstPulseSeconds =
    connector.hbFirstPulse !== undefined && connector.hbFirstPulse > 0
      ? connector.hbFirstPulse
      : settings.hbFirstPulse !== undefined && settings.hbFirstPulse > 0
        ? settings.hbFirstPulse
        : 20;

  return firstPulseSeconds * 1000;
}

export function shouldRecreateProxyServer(
  cached: ProxyServerCacheEntry | undefined,
  connector: Connector,
): boolean {
  if (!cached) return true;
  return hasConnectorRuntimeConfigChanged(cached.connector, connector);
}

export function createProxyMetricCallback(input: {
  stats: Map<string, ProxyRuntimeStats>;
  markStatsPending: () => void;
}): MetricCallback {
  return (id, bytes, latency) => {
    const current = ensureProxyStatsEntry(input.stats, id);
    if (bytes > 0) current.bytes += bytes;
    if (latency !== undefined) current.latency = latency;
    input.stats.set(id, { ...current });
    input.markStatsPending();
  };
}

export function ensureConnectorProxyServer(input: {
  connector: Connector;
  settings: Pick<GlobalSettings, "hbFirstPulse">;
  cache: Map<string, ProxyServerCacheEntry>;
  createMetricCallback: () => MetricCallback;
  onRecreate?: (connectorId: string) => void;
}): ReturnType<typeof createProxyServer> {
  const cached = input.cache.get(input.connector.id);
  if (shouldRecreateProxyServer(cached, input.connector)) {
    if (cached) {
      input.onRecreate?.(input.connector.id);
    }

    const server = createProxyServer(
      input.connector,
      input.createMetricCallback(),
      resolveHeartbeatFirstPulseMs(input.connector, input.settings),
    );

    input.cache.set(input.connector.id, {
      server,
      connector: input.connector,
    });
  }

  return input.cache.get(input.connector.id)!.server;
}

export function emitProxyRequest(
  proxyServer: ReturnType<typeof createProxyServer>,
  req: IncomingMessage,
  res: ServerResponse,
): void {
  (proxyServer as any).emit("request", req, res);
}
