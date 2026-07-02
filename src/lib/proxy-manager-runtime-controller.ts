import os from "os";
import { getConnectors } from "./connectors";
import { writeProxySyncPayload } from "./proxy-sync-store";
import { runProxyMonitoringCycle } from "./proxy-monitoring-loop";
import {
  executeProxyManagerRuntimeTick,
  type ExecuteProxyManagerRuntimeTickResult,
} from "./proxy-manager-runtime-driver";
import {
  applyProxyManagerLog,
  type ApplyProxyManagerLogResult,
} from "./proxy-manager-log";
import type {
  ProxyLogEntry,
  ProxyStatsEntry,
} from "./proxy-observability";
import {
  createInitialProxyGlobalMetrics,
  type ProxyRuntimeLoopState,
} from "./proxy-runtime-loop";
import { resolveProxyManagerRuntimeDeps } from "./proxy-manager-runtime-deps";
import {
  applyProxyManagerRuntimeTickState,
  scheduleProxyManagerSync,
} from "./proxy-manager-runtime-sync";

export interface CreateProxyManagerRuntimeControllerInput {
  stats: Map<string, ProxyStatsEntry>;
  pingStats: Record<string, number>;
  getHeartbeatCount: () => number;
  emitStats: (snapshot: Record<string, unknown>) => void;
  loadConnectors?: typeof getConnectors;
  monitoringCycleRunner?: typeof runProxyMonitoringCycle;
  executeRuntimeTick?: (
    input: Parameters<typeof executeProxyManagerRuntimeTick>[0],
  ) => ExecuteProxyManagerRuntimeTickResult;
  writeSyncPayload?: typeof writeProxySyncPayload;
  getCurrentCpus?: () => os.CpuInfo[];
  getTotalMem?: () => number;
  getFreeMem?: () => number;
  getRssBytes?: () => number;
  getNow?: () => number;
  getLastCompactionTime?: () => number;
  getCurrentCompactionIntervalMs?: () => number;
  logInfo?: (message: string) => void;
  logError?: (message: string) => void;
}

export interface ProxyManagerRuntimeController {
  markStatsPending: () => void;
  runRuntimeTick: () => void;
  runMonitoringCycle: () => Promise<void>;
  applyLog: (
    message: string,
    type?: ProxyLogEntry["type"],
  ) => ApplyProxyManagerLogResult;
}

interface ProxyManagerRuntimeInternalState extends ProxyRuntimeLoopState {
  recentLogs: ProxyLogEntry[];
}

export function createProxyManagerRuntimeController(
  input: CreateProxyManagerRuntimeControllerInput,
): ProxyManagerRuntimeController {
  const deps = resolveProxyManagerRuntimeDeps(input);

  const state: ProxyManagerRuntimeInternalState = {
    statsPending: false,
    recentLogs: [],
    logsPending: false,
    lastTotalBytes: 0,
    lastSyncTime: deps.getNow(),
    syncInFlight: false,
    prevCpus: deps.getCurrentCpus(),
    globalMetrics: createInitialProxyGlobalMetrics({
      now: deps.getNow(),
      currentCompactionIntervalMs: deps.readCurrentCompactionIntervalMs(),
    }),
  };

  function markStatsPending() {
    state.statsPending = true;
  }

  function runRuntimeTick() {
    const result = deps.executeRuntimeTick({
      stats: input.stats,
      pingStats: input.pingStats,
      recentLogs: state.recentLogs,
      heartbeatCount: input.getHeartbeatCount(),
      state: {
        statsPending: state.statsPending,
        logsPending: state.logsPending,
        lastTotalBytes: state.lastTotalBytes,
        lastSyncTime: state.lastSyncTime,
        syncInFlight: state.syncInFlight,
        prevCpus: state.prevCpus,
        globalMetrics: state.globalMetrics,
      },
      now: deps.getNow(),
      currentCpus: deps.getCurrentCpus(),
      totalMem: deps.getTotalMem(),
      freeMem: deps.getFreeMem(),
      rssBytes: deps.getRssBytes(),
      lastCompactionTime: deps.readLastCompactionTime(),
      currentCompactionIntervalMs: deps.readCurrentCompactionIntervalMs(),
      emitStats: input.emitStats,
    });

    applyProxyManagerRuntimeTickState(state, result.nextState);
    scheduleProxyManagerSync({
      shouldStartSync: result.shouldStartSync,
      syncPayload: result.syncPayload,
      writeSyncPayload: deps.writeSyncPayload,
      setSyncInFlight: (value) => {
        state.syncInFlight = value;
      },
    });
  }

  async function runMonitoringCycle() {
    await deps.monitoringCycleRunner({
      connectors: await deps.loadConnectors(),
      stats: input.stats,
      pingStats: input.pingStats,
      markStatsPending,
      logInfo: deps.logInfo,
      logError: deps.logError,
    });
  }

  function applyLog(
    message: string,
    type?: ProxyLogEntry["type"],
  ): ApplyProxyManagerLogResult {
    const result = applyProxyManagerLog({
      recentLogs: state.recentLogs,
      logsPending: state.logsPending,
      message,
      type,
    });

    state.recentLogs = result.nextState.recentLogs;
    state.logsPending = result.nextState.logsPending;
    return result;
  }

  return {
    markStatsPending,
    runRuntimeTick,
    runMonitoringCycle,
    applyLog,
  };
}
