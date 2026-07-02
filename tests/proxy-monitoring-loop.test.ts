import test from "node:test";
import assert from "node:assert/strict";
import type { Connector } from "../src/lib/connectors";
import type { PingEndpoint } from "../src/lib/proxy-monitoring";
import type { ProxyStatsEntry } from "../src/lib/proxy-observability";
import {
  runProxyMonitoringCycle,
  updateProxyConnectorPingState,
  updateProxyEndpointPingState,
} from "../src/lib/proxy-monitoring-loop";

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

test("proxy monitoring loop actualiza ping de endpoint y marca stats pendientes", () => {
  const pingStats: Record<string, number> = {};
  let pendingCalls = 0;
  const endpoint: PingEndpoint = {
    host: "api.cloudflare.com",
    port: 443,
    label: "api.cloudflare.com",
  };

  updateProxyEndpointPingState({
    pingStats,
    endpoint,
    latency: 42,
    markStatsPending: () => {
      pendingCalls++;
    },
  });

  assert.equal(pingStats["api.cloudflare.com"], 42);
  assert.equal(pendingCalls, 1);
});

test("proxy monitoring loop actualiza snapshot del conector con resultado de ping", () => {
  const stats = new Map<string, ProxyStatsEntry>();
  let pendingCalls = 0;

  updateProxyConnectorPingState({
    stats,
    connectorId: "connector-1",
    result: { online: true, latency: 88 },
    markStatsPending: () => {
      pendingCalls++;
    },
  });

  assert.deepEqual(stats.get("connector-1"), {
    requests: 0,
    bytes: 0,
    activePing: 88,
    isOnline: true,
  });
  assert.equal(pendingCalls, 1);
});

test("proxy monitoring loop ejecuta endpoints y conectores activos", async () => {
  const stats = new Map<string, ProxyStatsEntry>();
  const pingStats: Record<string, number> = {};
  const logs: string[] = [];
  let pendingCalls = 0;

  await runProxyMonitoringCycle({
    connectors: [
      makeConnector({ id: "active-1", targetUrl: "https://one.example.com" }),
      makeConnector({ id: "paused-1", isActive: false, targetUrl: "https://two.example.com" }),
    ],
    stats,
    pingStats,
    markStatsPending: () => {
      pendingCalls++;
    },
    logInfo: (message) => {
      logs.push(message);
    },
    logError: (message) => {
      logs.push(message);
    },
    pingEndpoints: [{ host: "edge.example.com", port: 443, label: "edge" }],
    pingEndpoint: async () => 12,
    probeConnector: async (targetUrl) => ({
      online: true,
      latency: targetUrl.includes("one") ? 33 : 99,
      detail: "status=200",
    }),
  });

  assert.equal(pingStats.edge, 12);
  assert.equal(stats.get("active-1")?.activePing, 33);
  assert.equal(stats.has("paused-1"), false);
  assert.ok(logs.some((entry) => entry.includes("[PING-RESULT] active-1")));
  assert.equal(pendingCalls, 2);
});

test("proxy monitoring loop registra fatal y degrada el conector si el probe falla", async () => {
  const stats = new Map<string, ProxyStatsEntry>();
  const logs: string[] = [];

  await runProxyMonitoringCycle({
    connectors: [makeConnector({ id: "broken-1", targetUrl: "https://broken.example.com" })],
    stats,
    pingStats: {},
    markStatsPending: () => {},
    logInfo: () => {},
    logError: (message) => {
      logs.push(message);
    },
    pingEndpoints: [],
    probeConnector: async () => {
      throw new Error("timeout");
    },
  });

  assert.equal(stats.get("broken-1")?.activePing, -1);
  assert.equal(stats.get("broken-1")?.isOnline, false);
  assert.ok(logs.some((entry) => entry.includes("[PING-FATAL] broken-1")));
});
