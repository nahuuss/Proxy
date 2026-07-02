import {
  buildProxyStatsSnapshot,
  buildProxySyncPayload,
  type ProxyGlobalMetrics,
  type ProxyLogEntry,
  type ProxyStatsEntry,
  type ProxySyncPayload,
} from './proxy-observability';

export function shouldSyncProxyRuntimeState(input: {
  statsPending: boolean;
  logsPending: boolean;
  syncInFlight: boolean;
}): boolean {
  return (input.statsPending || input.logsPending || true) && !input.syncInFlight;
}

export function buildProxyRuntimeSyncArtifacts(input: {
  shouldEmitStats: boolean;
  shouldSync: boolean;
  stats: Map<string, ProxyStatsEntry>;
  pingStats: Record<string, number>;
  globalMetrics: ProxyGlobalMetrics;
  recentLogs: ProxyLogEntry[];
}): {
  statsSnapshot?: Record<string, unknown>;
  syncPayload?: ProxySyncPayload;
} {
  return {
    statsSnapshot: input.shouldEmitStats
      ? buildProxyStatsSnapshot(input.stats, input.pingStats, input.globalMetrics)
      : undefined,
    syncPayload: input.shouldSync
      ? buildProxySyncPayload(input.stats, input.pingStats, input.globalMetrics, input.recentLogs)
      : undefined,
  };
}
