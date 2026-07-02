import test from "node:test";
import assert from "node:assert/strict";
import {
  applyNtlmJwtClaims,
  applyNtlmSessionClaims,
  CORE_NTLM_PROVIDER_ID,
  CRM_NTLM_PROVIDER_ID,
  createCoreNtlmAuthUser,
  createCrmNtlmAuthUser,
  getCoreNtlmSessionCredentials,
  getCrmNtlmSessionCredentials,
  getPreferredSessionUsername,
  hasCoreNtlmSessionForConnector,
  hasCrmNtlmSessionForConnector,
} from "../src/lib/auth-ntlm";

test("createCrmNtlmAuthUser arma el shape canonico para CRM", () => {
  const user = createCrmNtlmAuthUser({
    connectorId: "crm-1",
    username: "juan",
    password: "secret",
    domain: "SERENA",
  });

  assert.equal(user.id, "crm-1:juan");
  assert.equal(user.email, "juan@SERENA");
  assert.equal(user.crmConnectorId, "crm-1");
  assert.equal(user.crmDomain, "SERENA");
});

test("createCoreNtlmAuthUser arma el shape canonico para Core", () => {
  const user = createCoreNtlmAuthUser({
    connectorId: "core-1",
    username: "maria",
    password: "secret",
    domain: "COREAD",
  });

  assert.equal(user.id, "core-1:maria");
  assert.equal(user.email, "maria@COREAD");
  assert.equal(user.coreConnectorId, "core-1");
  assert.equal(user.coreDomain, "COREAD");
});

test("applyNtlmJwtClaims y applyNtlmSessionClaims replican claims canonicos", () => {
  const crmUser = createCrmNtlmAuthUser({
    connectorId: "crm-1",
    username: "juan",
    password: "secret",
    domain: "SERENA",
  });
  const coreUser = createCoreNtlmAuthUser({
    connectorId: "core-1",
    username: "maria",
    password: "secret",
    domain: "COREAD",
  });

  const token = applyNtlmJwtClaims({}, crmUser, CRM_NTLM_PROVIDER_ID);
  applyNtlmJwtClaims(token, coreUser, CORE_NTLM_PROVIDER_ID);

  assert.equal(token.crmUser, "juan");
  assert.equal(token.coreUser, "maria");

  const session = applyNtlmSessionClaims({}, token);
  assert.equal(session.crmConnectorId, "crm-1");
  assert.equal(session.coreConnectorId, "core-1");
});

test("helpers de sesion detectan scope por conector y usuario preferido", () => {
  const session = {
    crmUser: "juan",
    crmPass: "secret",
    crmDomain: "SERENA",
    crmConnectorId: "crm-1",
    coreUser: "maria",
    corePass: "secret",
    coreDomain: "COREAD",
    coreConnectorId: "core-1",
    user: { email: "fallback@example.com", name: "Fallback" },
  };

  assert.equal(hasCrmNtlmSessionForConnector(session, "crm-1"), true);
  assert.equal(hasCrmNtlmSessionForConnector(session, "otro"), false);
  assert.equal(hasCoreNtlmSessionForConnector(session, "core-1"), true);
  assert.equal(hasCoreNtlmSessionForConnector(session, "otro"), false);
  assert.deepEqual(getCrmNtlmSessionCredentials(session), {
    username: "juan",
    password: "secret",
    domain: "SERENA",
    connectorId: "crm-1",
  });
  assert.deepEqual(getCoreNtlmSessionCredentials(session), {
    username: "maria",
    password: "secret",
    domain: "COREAD",
    connectorId: "core-1",
  });
  assert.equal(getCrmNtlmSessionCredentials({ crmUser: "juan" }), null);
  assert.equal(getCoreNtlmSessionCredentials({ coreUser: "maria" }), null);
  assert.equal(getPreferredSessionUsername(session), "juan");
  assert.equal(getPreferredSessionUsername({ coreUser: "maria" }), "maria");
  assert.equal(getPreferredSessionUsername({ user: { email: "fallback@example.com" } }), "fallback@example.com");
});
