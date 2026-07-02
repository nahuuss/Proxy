import type os from "os";
import type {
  ProxyGlobalMetrics,
  ProxyLogEntry,
  ProxyStatsEntry,
  ProxySyncPayload,
} from "./proxy-observability";
import {
  computeProxyGlobalMetrics,
  computeTotalBytes,
  createInitialProxyGlobalMetrics,
} from "./proxy-runtime-loop-metrics";
import {
  buildProxyRuntimeSyncArtifacts,
  shouldSyncProxyRuntimeState,
} from "./proxy-runtime-loop-sync";

export interface ProxyRuntimeLoopState {
  statsPending: boolean;
  logsPending: boolean;
  lastTotalBytes: number;
  lastSyncTime: number;
  syncInFlight: boolean;
  prevCpus: os.CpuInfo[];
  globalMetrics: ProxyGlobalMetrics;
}

export interface ComputeProxyRuntimeTickInput {
  stats: Map<string, ProxyStatsEntry>;
  pingStats: Record<string, number>;
  recentLogs: ProxyLogEntry[];
  heartbeatCount: number;
  now: number;
  currentCpus: os.CpuInfo[];
  totalMem: number;
  freeMem: number;
  rssBytes: number;
  lastCompactionTime: number;
  currentCompactionIntervalMs: number;
  state: ProxyRuntimeLoopState;
}

export interface ComputeProxyRuntimeTickResult {
  nextState: ProxyRuntimeLoopState;
  shouldEmitStats: boolean;
  statsSnapshot?: Record<string, unknown>;
  shouldSync: boolean;
  syncPayload?: ProxySyncPayload;
}

export { createInitialProxyGlobalMetrics };

export function computeProxyRuntimeTick(
  input: ComputeProxyRuntimeTickInput,
): ComputeProxyRuntimeTickResult {
  const elapsedSec = (input.now - input.state.lastSyncTime) / 1000;
  const currentTotalBytes = computeTotalBytes(input.stats);
  const globalMetrics: ProxyGlobalMetrics = computeProxyGlobalMetrics({
    previousMetrics: input.state.globalMetrics,
    prevCpus: input.state.prevCpus,
    currentCpus: input.currentCpus,
    currentTotalBytes,
    lastTotalBytes: input.state.lastTotalBytes,
    elapsedSec,
    totalMem: input.totalMem,
    freeMem: input.freeMem,
    rssBytes: input.rssBytes,
    heartbeatCount: input.heartbeatCount,
    lastCompactionTime: input.lastCompactionTime,
    currentCompactionIntervalMs: input.currentCompactionIntervalMs,
  });

  const shouldEmitStats = input.state.statsPending;
  const shouldSync = shouldSyncProxyRuntimeState({
    statsPending: input.state.statsPending,
    logsPending: input.state.logsPending,
    syncInFlight: input.state.syncInFlight,
  });
  const artifacts = buildProxyRuntimeSyncArtifacts({
    shouldEmitStats,
    shouldSync,
    stats: input.stats,
    pingStats: input.pingStats,
    globalMetrics,
    recentLogs: input.recentLogs,
  });

  return {
    nextState: {
      statsPending: false,
      logsPending: false,
      lastTotalBytes: currentTotalBytes,
      lastSyncTime: input.now,
      syncInFlight: input.state.syncInFlight,
      prevCpus: input.currentCpus,
      globalMetrics,
    },
    shouldEmitStats,
    statsSnapshot: artifacts.statsSnapshot,
    shouldSync,
    syncPayload: artifacts.syncPayload,
  };
}
