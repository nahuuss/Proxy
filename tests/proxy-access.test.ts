import test from "node:test";
import assert from "node:assert/strict";
import type { Connector } from "../src/lib/connectors";
import { getProxyAccessRequirements } from "../src/lib/proxy-access";

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return {
    id: "test-connector",
    name: "Test Connector",
    description: "",
    port: 8080,
    targetUrl: "https://backend.example.com",
    publicHost: "proxy.example.com",
    isActive: true,
    connectorType: "generic",
    productConfig: {},
    ...overrides,
  };
}

test("proxy access exige auth remota cuando no hay bypass", () => {
  const connector = makeConnector();
  const access = getProxyAccessRequirements({
    connector,
    hostHeader: "proxy.example.com",
    settingsBypass: false,
    requestUrl: "/",
  });

  assert.equal(access.requiresAuth, true);
  assert.equal(access.needsSessionForNtlm, false);
  assert.equal(access.needsCoreNtlmSession, false);
});

test("proxy access respeta bypass local y global", () => {
  const connector = makeConnector();

  assert.equal(
    getProxyAccessRequirements({
      connector,
      hostHeader: "localhost:8080",
      settingsBypass: false,
      requestUrl: "/",
    }).requiresAuth,
    false,
  );

  assert.equal(
    getProxyAccessRequirements({
      connector,
      hostHeader: "proxy.example.com",
      settingsBypass: true,
      requestUrl: "/",
    }).requiresAuth,
    false,
  );
});

test("proxy access activa contratos NTLM por perfil y request", () => {
  const coreConnector = makeConnector({
    connectorType: "core",
    coreNtlmDomain: "COREAD",
  });
  const crmConnector = makeConnector({
    connectorType: "dynamics-crm",
    ntlmDomain: "SERENA",
    entryPath: "/ORG/",
  });

  const coreAccess = getProxyAccessRequirements({
    connector: coreConnector,
    hostHeader: "core.example.com",
    settingsBypass: false,
    requestUrl: "/LoginExterno.aspx?ReturnUrl=%2Fhome",
  });
  const crmAccess = getProxyAccessRequirements({
    connector: crmConnector,
    hostHeader: "crm.example.com",
    settingsBypass: false,
    requestUrl: "/ORG/?id=1",
    normalizeRequestUrl: true,
  });

  assert.equal(coreAccess.needsCoreNtlmSession, true);
  assert.equal(coreAccess.needsSessionForNtlm, false);
  assert.equal(crmAccess.needsSessionForNtlm, true);
  assert.equal(crmAccess.needsCoreNtlmSession, false);
});
