import assert from "node:assert/strict";
import test from "node:test";
import type { Connector } from "../src/lib/connectors";
import { resolveProxyNtlmSession } from "../src/lib/proxy-ntlm-session";

function createConnector(overrides: Partial<Connector> = {}): Connector {
  return {
    id: "generic-1",
    name: "Generic",
    description: "",
    port: 3001,
    targetUrl: "https://backend.example.com",
    publicHost: "proxy.local",
    isActive: true,
    connectorType: "generic",
    productConfig: { generic: {} },
    ...overrides,
  };
}

test("proxy ntlm session resuelve handshake core cuando el request lo requiere y la sesion coincide", () => {
  const result = resolveProxyNtlmSession({
    connector: createConnector({
      id: "core-1",
      connectorType: "core",
      coreNtlmDomain: "COREAD",
      productConfig: { core: {} },
    }),
    requestUrl: "/LoginExterno.aspx?ReturnUrl=%2Fhome",
    session: {
      coreUser: "demo",
      corePass: "secret",
      coreDomain: "COREAD",
      coreConnectorId: "core-1",
    },
  });

  assert.equal(result.kind, "core");
  if (result.kind === "core") {
    assert.equal(result.credentials.connectorId, "core-1");
  }
});

test("proxy ntlm session devuelve missing-session para CRM cuando falta parte del contrato", () => {
  const result = resolveProxyNtlmSession({
    connector: createConnector({
      id: "crm-1",
      connectorType: "dynamics-crm",
      ntlmDomain: "SERENA",
      entryPath: "/ORG/",
      productConfig: { "dynamics-crm": {} },
    }),
    requestUrl: "/ORG/main.aspx",
    session: {
      crmUser: "demo",
      crmPass: "secret",
      crmConnectorId: "crm-1",
    },
  });

  assert.deepEqual(result, { kind: "crm-missing-session" });
});

test("proxy ntlm session ignora requests sin contrato NTLM", () => {
  const result = resolveProxyNtlmSession({
    connector: createConnector(),
    requestUrl: "/home",
    session: null,
  });

  assert.deepEqual(result, { kind: "none" });
});
