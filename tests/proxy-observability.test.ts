import test from "node:test";
import assert from "node:assert/strict";
import {
  appendRecentProxyLog,
  buildProxyStatsSnapshot,
  buildProxySyncPayload,
} from "../src/lib/proxy-observability";

test("proxy observability agrega metadatos de pings y metrics al snapshot", () => {
  const stats = new Map([
    ["core", { requests: 10, bytes: 2048, latency: 120 }],
  ]);

  const snapshot = buildProxyStatsSnapshot(
    stats,
    { cloudflare: 80 },
    {
      throughput: 1.5,
      cpuLoad: 12,
      memUsage: 40,
      activeHeartbeats: 2,
      nodeMemUsage: 256,
      nodeMemPercent: 10,
      lastMemoryReset: 1000,
      nextMemoryReset: 2000,
    },
  );

  assert.deepEqual(snapshot.core, { requests: 10, bytes: 2048, latency: 120 });
  assert.deepEqual(snapshot.__pings, { cloudflare: 80 });
  assert.equal((snapshot.__metrics as any).throughput, 1.5);
});

test("proxy observability arma payload sincronizable sin perder logs", () => {
  const stats = new Map([["crm", { requests: 5, bytes: 512 }]]);
  const payload = buildProxySyncPayload(
    stats,
    {},
    {
      throughput: 0,
      cpuLoad: 0,
      memUsage: 0,
      activeHeartbeats: 0,
      nodeMemUsage: 0,
      nodeMemPercent: 0,
      lastMemoryReset: 1,
      nextMemoryReset: 2,
    },
    [{ timestamp: "10:00:00", message: "ok", type: "info" }],
  );

  assert.equal(Array.isArray(payload.logs), true);
  assert.equal(payload.logs.length, 1);
  assert.deepEqual((payload.stats as any).crm, { requests: 5, bytes: 512 });
});

test("proxy observability limita el buffer de logs recientes", () => {
  let logs = [] as Array<{ timestamp: string; message: string; type: "info" | "error" | "system" }>;
  for (let index = 0; index < 205; index++) {
    logs = appendRecentProxyLog(logs, {
      timestamp: `10:00:${index}`,
      message: `log-${index}`,
      type: "info",
    });
  }

  assert.equal(logs.length, 200);
  assert.equal(logs[0]?.message, "log-5");
  assert.equal(logs[199]?.message, "log-204");
});
