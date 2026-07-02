import test from "node:test";
import assert from "node:assert/strict";
import type os from "os";
import {
  computeProxyRuntimeTick,
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

test("proxy runtime loop inicializa metricas globales", () => {
  const metrics = createInitialProxyGlobalMetrics({
    now: 1000,
    currentCompactionIntervalMs: 30_000,
  });

  assert.equal(metrics.throughput, 0);
  assert.equal(metrics.nextMemoryReset, 31_000);
});

test("proxy runtime loop calcula throughput, cpu, memoria y snapshot", () => {
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

  const result = computeProxyRuntimeTick({
    stats: new Map([["a", { requests: 1, bytes: 1_048_676, latency: 10 }]]),
    pingStats: { cf: 20 },
    recentLogs: [],
    heartbeatCount: 2,
    now: 2_000,
    currentCpus: [makeCpu(150, 250)],
    totalMem: 1000,
    freeMem: 250,
    rssBytes: 500,
    lastCompactionTime: 700,
    currentCompactionIntervalMs: 30_000,
    state,
  });

  assert.equal(result.shouldEmitStats, true);
  assert.equal(result.shouldSync, true);
  assert.ok(result.statsSnapshot);
  assert.ok(result.syncPayload);
  assert.equal(Math.round(result.nextState.globalMetrics.throughput), 1);
  assert.equal(result.nextState.globalMetrics.activeHeartbeats, 2);
  assert.equal(result.nextState.globalMetrics.memUsage, 75);
  assert.equal(result.nextState.globalMetrics.lastMemoryReset, 700);
  assert.equal(result.nextState.statsPending, false);
});

test("proxy runtime loop no genera sync si ya hay uno en vuelo", () => {
  const state: ProxyRuntimeLoopState = {
    statsPending: false,
    logsPending: true,
    lastTotalBytes: 0,
    lastSyncTime: 1_000,
    syncInFlight: true,
    prevCpus: [makeCpu(100, 100)],
    globalMetrics: createInitialProxyGlobalMetrics({
      now: 1_000,
      currentCompactionIntervalMs: 30_000,
    }),
  };

  const result = computeProxyRuntimeTick({
    stats: new Map(),
    pingStats: {},
    recentLogs: [],
    heartbeatCount: 0,
    now: 2_000,
    currentCpus: [makeCpu(150, 150)],
    totalMem: 1000,
    freeMem: 500,
    rssBytes: 100,
    lastCompactionTime: 700,
    currentCompactionIntervalMs: 30_000,
    state,
  });

  assert.equal(result.shouldSync, false);
  assert.equal(result.syncPayload, undefined);
});
