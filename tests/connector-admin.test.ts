import test from "node:test";
import assert from "node:assert/strict";
import { buildConnectorId, prepareConnectorForCreate, prepareConnectorForUpdate } from "../src/lib/connector-admin";
import type { ConnectorDraftInput } from "../src/lib/connector-draft";

function createDraft(overrides: Partial<ConnectorDraftInput> = {}): ConnectorDraftInput {
  return {
    name: "Core Demo",
    description: "Conector demo",
    targetUrl: "https://example.com",
    publicHost: "demo.example.com",
    port: 3100,
    bypassAuth: false,
    connectorType: "core",
    isNtlm: false,
    ntlmDomain: undefined,
    coreNtlmDomain: "SERENA",
    entryPath: "/login",
    harLog: false,
    trafficLog: false,
    ssoLog: false,
    hbLog: false,
    hbFirstPulse: 20,
    trafficRetentionValue: undefined,
    trafficRetentionUnit: "hours",
    ...overrides,
  };
}

test("connector admin genera ids estables y sanitizados", () => {
  assert.equal(buildConnectorId("Mi Conector 01"), "mi-conector-01");
  assert.equal(buildConnectorId("CRM @ Serena!"), "crm--serena");
});

test("connector admin prepara altas con defaults de producto y validacion por perfil", () => {
  const result = prepareConnectorForCreate(createDraft());

  assert.equal(result.connector.id, "core-demo");
  assert.equal(result.connector.connectorType, "core");
  assert.deepEqual(result.validationErrors, []);
  assert.equal(result.connector.productConfig?.core?.xhrKeepAliveForAjax, true);
});

test("connector admin conserva la validacion de perfil en updates", () => {
  const result = prepareConnectorForUpdate(createDraft({ connectorType: "core", coreNtlmDomain: undefined }));

  assert.ok(result.validationErrors.some((error) => error.toLowerCase().includes("ntlm core")));
});
