import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConnectorAbsoluteCallbackUrl,
  resolveConnectorCallbackTargetPath,
  resolveLoginEntry,
} from "../src/lib/login-entry";
import type { Connector } from "../src/lib/connectors";
import type { GlobalSettings } from "../src/lib/settings";

const baseSettings: GlobalSettings = {
  id: "global_settings",
  internalTarget: "",
  publicHost: "",
  bypassAuth: false,
  authUrl: "http://localhost:3000",
};

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return {
    id: "test-port",
    name: "Test Port",
    description: "",
    port: 8081,
    targetUrl: "https://origin.example.com",
    publicHost: "core.serenaart.com.ar",
    isActive: true,
    connectorType: "core",
    ...overrides,
  };
}

test("login local con bypass de conector evita SSO y sanea callback externo contaminado", () => {
  const connector = makeConnector({ bypassAuth: true });
  const result = resolveLoginEntry({
    callbackUrl: "https://bank.bzld.click",
    requestHost: "localhost:8081",
    connectors: [connector],
    settings: baseSettings,
    fallbackAuthUrl: "http://localhost:3000",
  });

  assert.equal(result.shouldBypassSso, true);
  assert.equal(result.reason, "connector-bypass");
  assert.equal(result.bypassRedirectUrl, "http://localhost:8081/");
});

test("login local sin bypass conserva callback local del conector", () => {
  const connector = makeConnector();
  const result = resolveLoginEntry({
    callbackUrl: "http://localhost:8081/operaciones",
    requestHost: "localhost:8081",
    connectors: [connector],
    settings: baseSettings,
    fallbackAuthUrl: "http://localhost:3000",
  });

  assert.equal(result.shouldBypassSso, false);
  assert.equal(result.effectiveCallbackUrl, "http://localhost:8081/operaciones");
});

test("cloudflare conserva callback publico cuando el request llega con forwarded host", () => {
  const connector = makeConnector({ bypassAuth: false });
  const result = resolveLoginEntry({
    callbackUrl: "https://dominio.com/menu",
    forwardedHost: "dominio.com",
    requestHost: "localhost:8081",
    forwardedProto: "https",
    connectors: [connector],
    settings: baseSettings,
    fallbackAuthUrl: "http://localhost:3000",
  });

  assert.equal(result.shouldBypassSso, false);
  assert.equal(result.effectiveCallbackUrl, "https://dominio.com/menu");
});

test("login sin callback usa entryPath normalizado desde el perfil del conector", () => {
  const connector = makeConnector({
    connectorType: "dynamics-crm",
    entryPath: "ARTTesting",
  });
  const result = resolveLoginEntry({
    requestHost: "crm.example.com",
    connectors: [connector],
    settings: baseSettings,
    fallbackAuthUrl: "http://localhost:3000",
  });

  assert.equal(result.effectiveCallbackUrl, "https://crm.example.com/ARTTesting");
});

test("callback absoluto usa entryPath del perfil cuando el request entra por raiz", () => {
  const connector = makeConnector({
    connectorType: "dynamics-crm",
    entryPath: "ARTTesting",
  });

  assert.equal(resolveConnectorCallbackTargetPath("/", connector), "/ARTTesting");
  assert.equal(
    buildConnectorAbsoluteCallbackUrl({
      host: "crm.example.com",
      requestUrl: "/",
      connector,
    }),
    "https://crm.example.com/ARTTesting",
  );
});

test("callback absoluto preserva localhost para bypass y logins locales", () => {
  const connector = makeConnector({
    connectorType: "core",
    entryPath: "/inicio",
  });

  assert.equal(
    buildConnectorAbsoluteCallbackUrl({
      host: "localhost:8081",
      requestUrl: "/operaciones",
      connector,
    }),
    "http://localhost:8081/operaciones",
  );
});
