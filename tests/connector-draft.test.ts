import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PRODUCT_TYPE } from "../src/lib/product-catalog";
import { parseConnectorDraftFromFormData } from "../src/lib/connector-draft";

test("parseConnectorDraftFromFormData aplica default de producto y normaliza campos opcionales", () => {
  const formData = new FormData();
  formData.set("name", " Core Serena ");
  formData.set("description", " Portal principal ");
  formData.set("targetUrl", " https://backend.local ");
  formData.set("publicHost", " core.example.com ");
  formData.set("port", "8080");
  formData.set("bypassAuth", "on");
  formData.set("isNtlm", "false");
  formData.set("entryPath", " /Inicio/ ");
  formData.set("trafficRetentionUnit", "days");

  const draft = parseConnectorDraftFromFormData(formData);

  assert.equal(draft.name, "Core Serena");
  assert.equal(draft.description, "Portal principal");
  assert.equal(draft.targetUrl, "https://backend.local");
  assert.equal(draft.publicHost, "core.example.com");
  assert.equal(draft.port, 8080);
  assert.equal(draft.bypassAuth, true);
  assert.equal(draft.connectorType, DEFAULT_PRODUCT_TYPE);
  assert.equal(draft.isNtlm, false);
  assert.equal(draft.entryPath, "/Inicio/");
  assert.equal(draft.trafficRetentionUnit, "days");
  assert.equal(draft.ntlmDomain, undefined);
  assert.equal(draft.coreNtlmDomain, undefined);
});

test("parseConnectorDraftFromFormData normaliza tipo, booleans y numeros opcionales", () => {
  const formData = new FormData();
  formData.set("name", "CRM");
  formData.set("description", "");
  formData.set("targetUrl", "http://crm.local");
  formData.set("publicHost", "crm.example.com");
  formData.set("port", "8443");
  formData.set("connectorType", "dynamics-crm");
  formData.set("isNtlm", "true");
  formData.set("ntlmDomain", " SERENA ");
  formData.set("hbFirstPulse", "45");
  formData.set("trafficRetentionValue", "12");
  formData.set("trafficLog", "yes");

  const draft = parseConnectorDraftFromFormData(formData);

  assert.equal(draft.connectorType, "dynamics-crm");
  assert.equal(draft.isNtlm, true);
  assert.equal(draft.ntlmDomain, "SERENA");
  assert.equal(draft.hbFirstPulse, 45);
  assert.equal(draft.trafficRetentionValue, 12);
  assert.equal(draft.trafficLog, true);
  assert.equal(draft.bypassAuth, false);
});
