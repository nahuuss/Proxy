import test from "node:test";
import assert from "node:assert/strict";
import type { Connector } from "../src/lib/connectors";
import {
  findPausedConnectorForHost,
  isInternalDashboardRoute,
  selectActiveConnectorForHost,
} from "../src/lib/proxy-routing";

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

test("proxy routing detecta solo las rutas internas reales del dashboard", () => {
  assert.equal(isInternalDashboardRoute("/api/auth/signin"), true);
  assert.equal(isInternalDashboardRoute("/login"), true);
  assert.equal(isInternalDashboardRoute("/login/ntlm"), true);
  assert.equal(isInternalDashboardRoute("/_next/static/chunk.js"), true);
  assert.equal(isInternalDashboardRoute("/LoginExterno.aspx"), false);
});

test("proxy routing selecciona conector activo por host o fallback unico", () => {
  const first = makeConnector();
  const second = makeConnector({
    id: "connector-2",
    publicHost: "core.example.com",
  });

  assert.equal(selectActiveConnectorForHost([first, second], "core.example.com:8080")?.id, "connector-2");
  assert.equal(selectActiveConnectorForHost([first], "unknown.example.com")?.id, "connector-1");
});

test("proxy routing detecta conector pausado por host", () => {
  const paused = makeConnector({
    id: "paused",
    publicHost: "paused.example.com",
    isActive: false,
  });

  assert.equal(findPausedConnectorForHost([paused], "paused.example.com")?.id, "paused");
  assert.equal(findPausedConnectorForHost([paused], "other.example.com"), undefined);
});
