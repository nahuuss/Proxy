import test from "node:test";
import assert from "node:assert/strict";
import http from "http";
import type { Connector } from "../src/lib/connectors";
import {
  createProxyManagerPortController,
} from "../src/lib/proxy-manager-port-controller";
import type { ProxyStatsEntry } from "../src/lib/proxy-observability";

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

function createController(overrides: {
  loadConnectors?: () => Promise<Connector[]>;
  refreshPortBinding?: (input: {
    port: number;
    servers: Map<number, http.Server>;
    connectors: Connector[];
    createServer: () => http.Server;
    log: (message: string, type?: "info" | "error" | "system") => void;
  }) => Promise<void>;
  buildPortServer?: (input: { port: number }) => http.Server;
  listPorts?: (connectors: Connector[]) => number[];
  findConnectorPort?: (
    connectorId: string,
    loadConnectors: () => Promise<Connector[]>,
  ) => Promise<number | null>;
  dispatchRequest?: (input: { connector: Connector }) => void;
} = {}) {
  const servers = new Map<number, http.Server>();
  const proxyServers = new Map<string, any>();
  const stats = new Map<string, ProxyStatsEntry>();
  const controller = createProxyManagerPortController({
    servers,
    proxyServers,
    stats,
    markStatsPending: () => {},
    log: () => {},
    rateLimiter: {
      check: () => true,
    },
    loadConnectors:
      overrides.loadConnectors ||
      (async () => [makeConnector({ id: "a", port: 8080 }), makeConnector({ id: "b", port: 8081 })]),
    loadSettings: async () => ({
      id: "global_settings",
      internalTarget: "http://127.0.0.1:3000",
      publicHost: "app.example.com",
      bypassAuth: false,
      authUrl: "https://auth.example.com",
      hbFirstPulse: 20,
      memoryResetIntervalMinutes: 30,
    }),
    verifySession: async () => null,
    refreshPortBinding: overrides.refreshPortBinding as any,
    buildPortServer: (overrides.buildPortServer as any) || ((input: { port: number }) => {
      return { port: input.port } as unknown as http.Server;
    }),
    dispatchRequest: (overrides.dispatchRequest as any) || (() => {}),
    listPorts: overrides.listPorts as any,
    findConnectorPort: overrides.findConnectorPort as any,
  });

  return { controller, proxyServers, stats, servers };
}

test("proxy manager port controller refresca un puerto filtrando conectores", async () => {
  const calls: Array<{ port: number; connectorIds: string[]; createdPort: number }> = [];
  const { controller } = createController({
    refreshPortBinding: async (input) => {
      const createdServer = input.createServer() as unknown as { port: number };
      calls.push({
        port: input.port,
        connectorIds: input.connectors.map((connector) => connector.id),
        createdPort: createdServer.port,
      });
    },
  });

  await controller.refreshPort(8081);

  assert.deepEqual(calls, [
    {
      port: 8081,
      connectorIds: ["b"],
      createdPort: 8081,
    },
  ]);
});

test("proxy manager port controller inicializa todos los puertos detectados", async () => {
  const refreshed: number[] = [];
  const { controller } = createController({
    listPorts: () => [8080, 8081],
    refreshPortBinding: async (input) => {
      refreshed.push(input.port);
    },
  });

  await controller.init();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(refreshed.sort((a, b) => a - b), [8080, 8081]);
});

test("proxy manager port controller reinicia conector limpiando cache", async () => {
  const refreshed: number[] = [];
  const { controller, proxyServers } = createController({
    refreshPortBinding: async (input) => {
      refreshed.push(input.port);
    },
  });
  const connector = makeConnector({ id: "core-1", port: 8090 });
  proxyServers.set(connector.id, {} as any);

  await controller.startConnector(connector);

  assert.equal(proxyServers.has(connector.id), false);
  assert.deepEqual(refreshed, [8090]);
});

test("proxy manager port controller detiene conector y refresca su puerto si existe", async () => {
  const refreshed: number[] = [];
  const { controller, proxyServers } = createController({
    refreshPortBinding: async (input) => {
      refreshed.push(input.port);
    },
    findConnectorPort: async () => 9100,
  });
  proxyServers.set("crm-1", {} as any);

  controller.stopConnector("crm-1");
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(proxyServers.has("crm-1"), false);
  assert.deepEqual(refreshed, [9100]);
});
