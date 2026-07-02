export interface ProxyStatsEntry {
  requests: number;
  bytes: number;
  latency?: number;
  activePing?: number;
  isOnline?: boolean;
}

export interface ProxyGlobalMetrics {
  throughput: number;
  cpuLoad: number;
  memUsage: number;
  activeHeartbeats: number;
  nodeMemUsage: number;
  nodeMemPercent: number;
  lastMemoryReset: number;
  nextMemoryReset: number;
}

export interface ProxyLogEntry {
  timestamp: string;
  message: string;
  type: "info" | "error" | "system";
}

export interface ProxySyncPayload {
  stats: Record<string, unknown>;
  logs: ProxyLogEntry[];
}

export function buildProxyStatsSnapshot(
  stats: Map<string, ProxyStatsEntry>,
  pingStats: Record<string, number>,
  globalMetrics: ProxyGlobalMetrics,
): Record<string, unknown> {
  return {
    ...Object.fromEntries(stats),
    __pings: pingStats,
    __metrics: globalMetrics,
  };
}

export function buildProxySyncPayload(
  stats: Map<string, ProxyStatsEntry>,
  pingStats: Record<string, number>,
  globalMetrics: ProxyGlobalMetrics,
  recentLogs: ProxyLogEntry[],
): ProxySyncPayload {
  return {
    stats: buildProxyStatsSnapshot(stats, pingStats, globalMetrics),
    logs: recentLogs,
  };
}

export function appendRecentProxyLog(
  recentLogs: ProxyLogEntry[],
  entry: ProxyLogEntry,
  maxEntries = 200,
): ProxyLogEntry[] {
  const nextLogs = [...recentLogs, entry];
  if (nextLogs.length <= maxEntries) {
    return nextLogs;
  }
  return nextLogs.slice(nextLogs.length - maxEntries);
}
