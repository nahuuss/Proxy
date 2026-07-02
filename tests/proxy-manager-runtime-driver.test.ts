import test from "node:test";
import assert from "node:assert/strict";
import type os from "os";
import {
  executeProxyManagerRuntimeTick,
  scheduleProxyManagerLoops,
} from "../src/lib/proxy-manager-runtime-driver";
import {
  createInitialProxyGlobalMetrics,
  type ProxyRuntimeLoopState,
} from "../src/lib/proxy-runtime-loop";

function makeCpu(idle: number, work: number): os.CpuInfo {
  return {
    model: "test",
    speed: 1000,
    times: {
      user: work,
      nice: 0,
      sys: 0,
      idle,
      irq: 0,
    },
  };
}

test("proxy manager runtime driver emite stats y prepara sync", () => {
  const state: ProxyRuntimeLoopState = {
    statsPending: true,
    logsPending: false,
    lastTotalBytes: 100,
    lastSyncTime: 1_000,
    syncInFlight: false,
    prevCpus: [makeCpu(100, 100)],
    globalMetrics: createInitialProxyGlobalMetrics({
      now: 1_000,
      currentCompactionIntervalMs: 30_000,
    }),
  };
  let emittedSnapshot: Record<string, unknown> | undefined;

  const result = executeProxyManagerRuntimeTick({
    stats: new Map([["a", { requests: 1, bytes: 1_048_676, latency: 10 }]]),
    pingStats: { cf: 20 },
    recentLogs: [],
    heartbeatCount: 2,
    state,
    now: 2_000,
    currentCpus: [makeCpu(150, 250)],
    totalMem: 1000,
    freeMem: 250,
    rssBytes: 500,
    lastCompactionTime: 700,
    currentCompactionIntervalMs: 30_000,
    emitStats: (snapshot) => {
      emittedSnapshot = snapshot;
    },
  });

  assert.ok(emittedSnapshot);
  assert.equal(result.shouldStartSync, true);
  assert.ok(result.syncPayload);
  assert.equal(result.nextState.statsPending, false);
});

test("proxy manager runtime driver agenda runtime y monitoring con delays canonicos", async () => {
  const scheduled: number[] = [];
  let runtimeCalls = 0;
  let monitoringCalls = 0;

  scheduleProxyManagerLoops({
    runRuntimeTick: () => {
      runtimeCalls++;
    },
    runMonitoringCycle: () => {
      monitoringCalls++;
    },
    setIntervalFn: (callback, delayMs) => {
      scheduled.push(delayMs);
      callback();
      return delayMs;
    },
  });

  assert.deepEqual(scheduled, [5000, 15000]);
  assert.equal(runtimeCalls, 1);
  assert.equal(monitoringCalls, 2);
});
