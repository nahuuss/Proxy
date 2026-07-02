import test from "node:test";
import assert from "node:assert/strict";
import type { Connector } from "../src/lib/connectors";
import {
  validateCoreNtlmCredentials,
  validateCrmNtlmCredentials,
  type NtlmHttpClient,
} from "../src/lib/auth-ntlm-validation";

function createHttpNtlmStub(
  callback: (options: Record<string, unknown>) => { err?: any; statusCode?: number },
): NtlmHttpClient {
  return {
    get(options, done) {
      const result = callback(options);
      done(result.err, { statusCode: result.statusCode });
    },
  };
}

function createConnector(overrides: Partial<Connector>): Connector {
  return {
    id: "connector-1",
    name: "Connector",
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

test("validateCrmNtlmCredentials usa dominio y URL del perfil", async () => {
  let receivedUrl = "";
  let receivedDomain = "";
  const result = await validateCrmNtlmCredentials({
    connector: createConnector({
      connectorType: "dynamics-crm",
      ntlmDomain: "SERENA",
      entryPath: "/ORG/",
    }),
    connectorId: "crm-1",
    username: "juan",
    password: "secret",
    httpntlm: createHttpNtlmStub((options) => {
      receivedUrl = String(options.url);
      receivedDomain = String(options.domain);
      return { statusCode: 200 };
    }),
  });

  assert.deepEqual(result, { valid: true, domain: "SERENA" });
  assert.equal(receivedUrl, "https://backend.example.com/ORG/main.aspx");
  assert.equal(receivedDomain, "SERENA");
});

test("validateCrmNtlmCredentials rechaza 401 y conectores invalidos", async () => {
  const invalidConnector = await validateCrmNtlmCredentials({
    connector: createConnector({ connectorType: "generic", isNtlm: false }),
    connectorId: "generic-1",
    username: "juan",
    password: "secret",
    httpntlm: createHttpNtlmStub(() => ({ statusCode: 200 })),
  });
  const invalidCredentials = await validateCrmNtlmCredentials({
    connector: createConnector({
      connectorType: "dynamics-crm",
      ntlmDomain: "SERENA",
      entryPath: "/ORG/",
    }),
    connectorId: "crm-1",
    username: "juan",
    password: "secret",
    httpntlm: createHttpNtlmStub(() => ({ statusCode: 401 })),
  });

  assert.deepEqual(invalidConnector, { valid: false, error: "invalid-connector" });
  assert.deepEqual(invalidCredentials, { valid: false, error: "invalid-credentials" });
});

test("validateCoreNtlmCredentials usa dominio core y login externo del perfil", async () => {
  let receivedUrl = "";
  let receivedDomain = "";
  const result = await validateCoreNtlmCredentials({
    connector: createConnector({
      connectorType: "core",
      coreNtlmDomain: "COREAD",
    }),
    connectorId: "core-1",
    username: "maria",
    password: "secret",
    httpntlm: createHttpNtlmStub((options) => {
      receivedUrl = String(options.url);
      receivedDomain = String(options.domain);
      return { statusCode: 200 };
    }),
  });

  assert.deepEqual(result, { valid: true, domain: "COREAD" });
  assert.equal(receivedUrl, "https://backend.example.com/LoginExterno.aspx");
  assert.equal(receivedDomain, "COREAD");
});

test("validateCoreNtlmCredentials rechaza conectores sin contrato o 401", async () => {
  const invalidConnector = await validateCoreNtlmCredentials({
    connector: createConnector({ connectorType: "generic" }),
    connectorId: "generic-1",
    username: "maria",
    password: "secret",
    httpntlm: createHttpNtlmStub(() => ({ statusCode: 200 })),
  });
  const invalidCredentials = await validateCoreNtlmCredentials({
    connector: createConnector({
      connectorType: "core",
      coreNtlmDomain: "COREAD",
    }),
    connectorId: "core-1",
    username: "maria",
    password: "secret",
    httpntlm: createHttpNtlmStub(() => ({ statusCode: 401 })),
  });

  assert.deepEqual(invalidConnector, { valid: false, error: "invalid-connector" });
  assert.deepEqual(invalidCredentials, { valid: false, error: "invalid-credentials" });
});

test("validateCrmNtlmCredentials traduce errores inesperados del cliente NTLM", async () => {
  const result = await validateCrmNtlmCredentials({
    connector: createConnector({
      connectorType: "dynamics-crm",
      ntlmDomain: "SERENA",
      entryPath: "/ORG/",
    }),
    connectorId: "crm-1",
    username: "juan",
    password: "secret",
    httpntlm: {
      get() {
        throw new Error("boom");
      },
    },
  });

  assert.deepEqual(result, { valid: false, error: "unexpected-error" });
});
