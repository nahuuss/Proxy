import test from "node:test";
import assert from "node:assert/strict";
import type { Connector } from "../src/lib/connectors";
import {
  resolveHttpProxyAuthDecision,
  resolveWebSocketProxyAuthDecision,
} from "../src/lib/proxy-auth-flow";

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

test("proxy auth flow devuelve 401 virtual para api sin sesion", () => {
  const decision = resolveHttpProxyAuthDecision({
    url: "/api/data",
    hostHeader: "core.example.com",
    connector: makeConnector(),
    accessRequirements: {
      requiresAuth: true,
      needsSessionForNtlm: false,
      needsCoreNtlmSession: false,
    },
    session: null,
  });

  assert.deepEqual(decision, { kind: "unauthorized-api" });
});

test("proxy auth flow redirige a core ntlm cuando falta sesion requerida", () => {
  const connector = makeConnector({
    connectorType: "core",
    coreNtlmDomain: "COREAD",
  });

  const decision = resolveHttpProxyAuthDecision({
    url: "/LoginExterno.aspx?ReturnUrl=%2Fhome",
    hostHeader: "core.example.com",
    connector,
    accessRequirements: {
      requiresAuth: true,
      needsSessionForNtlm: false,
      needsCoreNtlmSession: true,
    },
    session: null,
  });

  assert.equal(decision.kind, "redirect");
  assert.match(decision.location, /\/login\/core-ntlm\?/);
});

test("proxy auth flow redirige a ntlm cuando hay sso pero falta atado crm", () => {
  const connector = makeConnector({
    id: "crm-1",
    connectorType: "dynamics-crm",
    ntlmDomain: "SERENA",
    entryPath: "/ORG/",
  });

  const decision = resolveHttpProxyAuthDecision({
    url: "/ORG/main.aspx",
    hostHeader: "crm.example.com",
    connector,
    accessRequirements: {
      requiresAuth: false,
      needsSessionForNtlm: true,
      needsCoreNtlmSession: false,
    },
    session: {
      user: { email: "demo@example.com" },
      crmConnectorId: "other-connector",
      crmUser: "demo",
      crmPass: "secret",
    },
  });

  assert.equal(decision.kind, "redirect");
  assert.match(decision.location, /\/login\/ntlm\?/);
});

test("proxy auth flow redirige la raiz autenticada al entry path del perfil", () => {
  const connector = makeConnector({
    connectorType: "dynamics-crm",
    entryPath: "/ORG/",
  });

  const decision = resolveHttpProxyAuthDecision({
    url: "/",
    hostHeader: "crm.example.com",
    connector,
    accessRequirements: {
      requiresAuth: true,
      needsSessionForNtlm: false,
      needsCoreNtlmSession: false,
    },
    session: { user: { email: "demo@example.com" } },
  });

  assert.deepEqual(decision, {
    kind: "root-entry-redirect",
    location: "/ORG",
  });
});

test("proxy auth flow permite websocket cuando la sesion cumple el contrato", () => {
  const connector = makeConnector({
    id: "crm-1",
    connectorType: "dynamics-crm",
    ntlmDomain: "SERENA",
    entryPath: "/ORG/",
  });

  const decision = resolveWebSocketProxyAuthDecision({
    connector,
    accessRequirements: {
      requiresAuth: true,
      needsSessionForNtlm: true,
      needsCoreNtlmSession: false,
    },
    session: {
      user: { email: "demo@example.com" },
      crmConnectorId: "crm-1",
      crmUser: "demo",
      crmPass: "secret",
      crmDomain: "SERENA",
    },
  });

  assert.deepEqual(decision, { kind: "allow" });
});

test("proxy auth flow rechaza websocket cuando falta atado ntlm/core", () => {
  const connector = makeConnector({
    id: "core-1",
    connectorType: "core",
    coreNtlmDomain: "COREAD",
  });

  const decision = resolveWebSocketProxyAuthDecision({
    connector,
    accessRequirements: {
      requiresAuth: true,
      needsSessionForNtlm: false,
      needsCoreNtlmSession: true,
    },
    session: {
      user: { email: "demo@example.com" },
      coreConnectorId: "other",
      coreUser: "demo",
      corePass: "secret",
    },
  });

  assert.deepEqual(decision, { kind: "unauthorized" });
});
