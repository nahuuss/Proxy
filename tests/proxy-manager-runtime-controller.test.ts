import test from "node:test";
import assert from "node:assert/strict";
import type os from "os";
import {
  createProxyManagerRuntimeController,
} from "../src/lib/proxy-manager-runtime-controller";
import type { Connector } from "../src/lib/connectors";
import type { ProxyStatsEntry, ProxySyncPayload } from "../src/lib/proxy-observability";

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

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return {
    id: "connector-1",
    name: "Connector 1",
    description: "",
    port: 8080,
    targetUrl: "https://backend.example.com",
    publicHost: "app.example.com",
    isActive: true,
    connectorType: "generic",
    productConfig: {},
    ...overrides,
  };
}

test("proxy manager runtime controller ejecuta tick, emite stats y sincroniza payload", async () => {
  const syncPayloads: ProxySyncPayload[] = [];
  const emitted: Record<string, unknown>[] = [];
  const stats = new Map([["a", { requests: 1, bytes: 1_048_676, latency: 10 }]]);
  const controller = createProxyManagerRuntimeController({
    stats,
    pingStats: { cf: 20 },
    getHeartbeatCount: () => 2,
    emitStats: (snapshot) => {
      emitted.push(snapshot);
    },
    getNow: () => 2_000,
    getCurrentCpus: () => [makeCpu(150, 250)],
    getTotalMem: () => 1000,
    getFreeMem: () => 250,
    getRssBytes: () => 500,
    getLastCompactionTime: () => 700,
    getCurrentCompactionIntervalMs: () => 30_000,
    writeSyncPayload: async (payload) => {
      syncPayloads.push(payload);
    },
  });

  controller.markStatsPending();
  controller.runRuntimeTick();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(emitted.length, 1);
  assert.equal(syncPayloads.length, 1);
});

test("proxy manager runtime controller ejecuta monitoreo con conectores y marca stats pending", async () => {
  const connectors = [makeConnector({ id: "core-1" })];
  const stats = new Map<string, ProxyStatsEntry>();
  let monitoringCalls = 0;
  const controller = createProxyManagerRuntimeController({
    stats,
    pingStats: {},
    getHeartbeatCount: () => 0,
    emitStats: () => {},
    loadConnectors: async () => connectors,
    monitoringCycleRunner: async (input) => {
      monitoringCalls++;
      assert.deepEqual(input.connectors, connectors);
      input.markStatsPending();
      input.stats.set("core-1", { requests: 0, bytes: 0, isOnline: true });
    },
    getCurrentCpus: () => [makeCpu(100, 100)],
    getCurrentCompactionIntervalMs: () => 30_000,
  });

  await controller.runMonitoringCycle();
  controller.runRuntimeTick();

  assert.equal(monitoringCalls, 1);
  assert.equal(stats.get("core-1")?.isOnline, true);
});

test("proxy manager runtime controller acumula logs y deja mensaje listo para emitir", () => {
  const controller = createProxyManagerRuntimeController({
    stats: new Map(),
    pingStats: {},
    getHeartbeatCount: () => 0,
    emitStats: () => {},
    getCurrentCpus: () => [makeCpu(100, 100)],
    getCurrentCompactionIntervalMs: () => 30_000,
  });

  const result = controller.applyLog("nuevo", "error");

  assert.equal(result.entry.message, "nuevo");
  assert.equal(result.entry.type, "error");
  assert.equal(result.nextState.logsPending, true);
  assert.equal(result.nextState.recentLogs.length, 1);
});
