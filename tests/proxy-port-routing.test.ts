import test from "node:test";
import assert from "node:assert/strict";
import type { Connector } from "../src/lib/connectors";
import {
  applyInternalDashboardForwardHeaders,
  buildInternalDashboardConnector,
  ensureInternalDashboardProxyServer,
  INTERNAL_DASHBOARD_CONNECTOR_ID,
  isLocalDashboardHost,
  resolvePortConnectorForHost,
} from "../src/lib/proxy-port-routing";

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

test("proxy port routing detecta host local del dashboard", () => {
  assert.equal(isLocalDashboardHost("localhost:3000"), true);
  assert.equal(isLocalDashboardHost("127.0.0.1:3000"), true);
  assert.equal(isLocalDashboardHost("core.example.com"), false);
});

test("proxy port routing arma conector interno y lo cachea", () => {
  const connector = buildInternalDashboardConnector("core.example.com");
  assert.equal(connector.id, INTERNAL_DASHBOARD_CONNECTOR_ID);
  assert.equal(connector.publicHost, "core.example.com");

  const cache = new Map<string, { server: any; connector: Connector }>();
  const first = ensureInternalDashboardProxyServer({
    proxyServers: cache,
    hostHeader: "core.example.com",
  });
  const second = ensureInternalDashboardProxyServer({
    proxyServers: cache,
    hostHeader: "other.example.com",
  });

  assert.equal(first, second);
  assert.equal(cache.get(INTERNAL_DASHBOARD_CONNECTOR_ID)?.connector.publicHost, "core.example.com");
});

test("proxy port routing aplica forwarded headers del dashboard", () => {
  const req = { headers: {} } as any;
  applyInternalDashboardForwardHeaders(req, "core.example.com");
  assert.equal(req.headers["x-forwarded-host"], "core.example.com");
  assert.equal(req.headers["x-forwarded-proto"], "https");
});

test("proxy port routing resuelve conector activo, pausado y host pedido", () => {
  const active = makeConnector();
  const secondActive = makeConnector({
    id: "connector-2",
    publicHost: "other.example.com",
  });
  const paused = makeConnector({
    id: "paused",
    publicHost: "paused.example.com",
    isActive: false,
  });

  assert.equal(
    resolvePortConnectorForHost([active, secondActive, paused], "app.example.com:8080").activeConnector?.id,
    "connector-1",
  );
  assert.equal(
    resolvePortConnectorForHost([active, secondActive, paused], "paused.example.com").pausedConnector?.id,
    "paused",
  );
  assert.equal(
    resolvePortConnectorForHost([active, secondActive, paused], "missing.example.com").requestedHost,
    "missing.example.com",
  );
});
