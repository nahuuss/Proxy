import test from "node:test";
import assert from "node:assert/strict";
import type { Connector } from "../src/lib/connectors";
import {
  createProxyMetricCallback,
  ensureProxyStatsEntry,
  registerProxyRequest,
  resolveHeartbeatFirstPulseMs,
  shouldRecreateProxyServer,
} from "../src/lib/proxy-lifecycle";

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return {
    id: "connector-1",
    name: "Connector 1",
    description: "",
    port: 8080,
    targetUrl: "https://backend.example.com",
    publicHost: "core.example.com",
    isActive: true,
    connectorType: "generic",
    productConfig: {},
    ...overrides,
  };
}

test("proxy lifecycle inicializa y registra requests en stats", () => {
  const stats = new Map<string, { requests: number; bytes: number; latency: number }>();
  const initial = ensureProxyStatsEntry(stats, "a");
  assert.deepEqual(initial, { requests: 0, bytes: 0, latency: 0 });

  const updated = registerProxyRequest(stats, "a");
  assert.equal(updated.requests, 1);
  assert.equal(stats.get("a")?.requests, 1);
});

test("proxy lifecycle resuelve hb first pulse con prioridad conector > settings > default", () => {
  assert.equal(
    resolveHeartbeatFirstPulseMs({ hbFirstPulse: 45 }, { hbFirstPulse: 30 }),
    45_000,
  );
  assert.equal(
    resolveHeartbeatFirstPulseMs({ hbFirstPulse: undefined }, { hbFirstPulse: 30 }),
    30_000,
  );
  assert.equal(
    resolveHeartbeatFirstPulseMs({ hbFirstPulse: undefined }, { hbFirstPulse: undefined }),
    20_000,
  );
});

test("proxy lifecycle detecta si hay que recrear server segun runtime config", () => {
  const connector = makeConnector();
  assert.equal(shouldRecreateProxyServer(undefined, connector), true);
  assert.equal(
    shouldRecreateProxyServer({ server: {} as any, connector }, connector),
    false,
  );
  assert.equal(
    shouldRecreateProxyServer(
      { server: {} as any, connector },
      makeConnector({ strictTls: true }),
    ),
    true,
  );
});

test("proxy lifecycle actualiza bytes y latencia via callback", () => {
  const stats = new Map<string, { requests: number; bytes: number; latency: number }>();
  let pending = 0;

  const onMetric = createProxyMetricCallback({
    stats,
    markStatsPending: () => {
      pending++;
    },
  });

  onMetric("a", 128, 250);

  assert.deepEqual(stats.get("a"), {
    requests: 0,
    bytes: 128,
    latency: 250,
  });
  assert.equal(pending, 1);
});
