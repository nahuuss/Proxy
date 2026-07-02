import test from "node:test";
import assert from "node:assert/strict";
import type { Connector } from "../src/lib/connectors";
import type { GlobalSettings } from "../src/lib/settings";
import {
  findProxyConnectorPort,
  listProxyPorts,
  loadProxyPortRuntimeContext,
} from "../src/lib/proxy-manager-context";

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

test("proxy manager context lista puertos unicos", () => {
  const ports = listProxyPorts([
    makeConnector({ id: "a", port: 8080 }),
    makeConnector({ id: "b", port: 8081 }),
    makeConnector({ id: "c", port: 8080 }),
  ]);

  assert.deepEqual(ports, [8080, 8081]);
});

test("proxy manager context carga runtime filtrado por puerto y settings", async () => {
  const context = await loadProxyPortRuntimeContext(8081, {
    loadConnectors: async () => [
      makeConnector({ id: "a", port: 8080 }),
      makeConnector({ id: "b", port: 8081 }),
    ],
    loadSettings: async () => makeSettings({ publicHost: "core.example.com" }),
  });

  assert.deepEqual(context.connectors.map((connector) => connector.id), ["b"]);
  assert.equal(context.settings.publicHost, "core.example.com");
});

test("proxy manager context encuentra puerto del conector o null", async () => {
  const loadConnectors = async () => [
    makeConnector({ id: "a", port: 8080 }),
    makeConnector({ id: "b", port: 8081 }),
  ];

  assert.equal(await findProxyConnectorPort("b", loadConnectors), 8081);
  assert.equal(await findProxyConnectorPort("missing", loadConnectors), null);
});
