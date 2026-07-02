import type os from "os";
import {
  computeProxyRuntimeTick,
  type ProxyRuntimeLoopState,
} from "./proxy-runtime-loop";
import type { ProxyLogEntry, ProxyStatsEntry, ProxySyncPayload } from "./proxy-observability";

export interface ExecuteProxyManagerRuntimeTickInput {
  stats: Map<string, ProxyStatsEntry>;
  pingStats: Record<string, number>;
  recentLogs: ProxyLogEntry[];
  heartbeatCount: number;
  state: ProxyRuntimeLoopState;
  now: number;
  currentCpus: os.CpuInfo[];
  totalMem: number;
  freeMem: number;
  rssBytes: number;
  lastCompactionTime: number;
  currentCompactionIntervalMs: number;
  emitStats: (snapshot: Record<string, unknown>) => void;
}

export interface ExecuteProxyManagerRuntimeTickResult {
  nextState: ProxyRuntimeLoopState;
  shouldStartSync: boolean;
  syncPayload?: ProxySyncPayload;
}

export function executeProxyManagerRuntimeTick(
  input: ExecuteProxyManagerRuntimeTickInput,
): ExecuteProxyManagerRuntimeTickResult {
  const tick = computeProxyRuntimeTick({
    stats: input.stats,
    pingStats: input.pingStats,
    recentLogs: input.recentLogs,
    heartbeatCount: input.heartbeatCount,
    now: input.now,
    currentCpus: input.currentCpus,
    totalMem: input.totalMem,
    freeMem: input.freeMem,
    rssBytes: input.rssBytes,
    lastCompactionTime: input.lastCompactionTime,
    currentCompactionIntervalMs: input.currentCompactionIntervalMs,
    state: input.state,
  });

  if (tick.shouldEmitStats && tick.statsSnapshot) {
    input.emitStats(tick.statsSnapshot);
  }

  return {
    nextState: tick.nextState,
    shouldStartSync: tick.shouldSync && !!tick.syncPayload,
    syncPayload: tick.syncPayload,
  };
}

export function scheduleProxyManagerLoops(input: {
  runRuntimeTick: () => void;
  runMonitoringCycle: () => void | Promise<void>;
  setIntervalFn?: (callback: () => void, delayMs: number) => unknown;
}): void {
  const schedule = input.setIntervalFn || setInterval;
  schedule(input.runRuntimeTick, 5000);
  void input.runMonitoringCycle();
  schedule(() => {
    void input.runMonitoringCycle();
  }, 15000);
}
