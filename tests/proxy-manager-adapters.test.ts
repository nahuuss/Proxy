import test from "node:test";
import assert from "node:assert/strict";
import type { Connector } from "../src/lib/connectors";
import type { GlobalSettings } from "../src/lib/settings";
import {
  createInternalDashboardForwarder,
  createProxyManagerLogger,
  createProxyManagerStatsPendingMarker,
  createProxyPortContextLoader,
} from "../src/lib/proxy-manager-adapters";

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

function makeSettings(overrides: Partial<GlobalSettings> = {}): GlobalSettings {
  return {
    id: "global_settings",
    internalTarget: "http://127.0.0.1:3000",
    publicHost: "app.example.com",
    bypassAuth: false,
    authUrl: "https://auth.example.com",
    hbFirstPulse: 20,
    memoryResetIntervalMinutes: 30,
    ...overrides,
  };
}

test("proxy manager adapters marca stats pending via setter", () => {
  let pending = false;
  const mark = createProxyManagerStatsPendingMarker({
    setStatsPending: (nextValue) => {
      pending = nextValue;
    },
  });

  mark();
  assert.equal(pending, true);
});

test("proxy manager adapters delega logger sin alterar parametros", () => {
  const calls: Array<{ message: string; type?: "info" | "error" | "system" }> = [];
  const log = createProxyManagerLogger({
    log: (message, type) => {
      calls.push({ message, type });
    },
  });

  log("hola", "system");
  assert.deepEqual(calls, [{ message: "hola", type: "system" }]);
});

test("proxy manager adapters carga contexto filtrado por puerto", async () => {
  const loadContext = createProxyPortContextLoader(8081, {
    loadConnectors: async () => [
      makeConnector({ id: "a", port: 8080 }),
      makeConnector({ id: "b", port: 8081 }),
    ],
    loadSettings: async () => makeSettings({ publicHost: "core.example.com" }),
  });

  const context = await loadContext();
  assert.deepEqual(context.connectors.map((connector) => connector.id), ["b"]);
  assert.equal(context.settings.publicHost, "core.example.com");
});

test("proxy manager adapters reenvia al dashboard interno y preserva cache", () => {
  let emitted = 0;
  const req = { headers: {} } as any;
  const res = {} as any;
  const cache = new Map<string, { server: any; connector: Connector }>([
    [
      "internal-dashboard",
      {
        server: {
          emit(event: string, eventReq: unknown, eventRes: unknown) {
            assert.equal(event, "request");
            assert.equal(eventReq, req);
            assert.equal(eventRes, res);
            emitted++;
          },
        },
        connector: makeConnector({
          id: "internal-dashboard",
          publicHost: "core.example.com",
        }),
      },
    ],
  ]);
  const forward = createInternalDashboardForwarder({
    proxyServers: cache as any,
  });

  forward(req, res, "core.example.com");

  assert.equal(req.headers["x-forwarded-host"], "core.example.com");
  assert.equal(emitted, 1);
});
