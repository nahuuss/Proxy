import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { Connector } from "../src/lib/connectors";
import { getRulesFor, type RequestContext } from "../src/lib/rules/index";
import {
  ConnectorProductType,
  getEffectiveProductConfig,
  getProductProfileContract,
  ProductExecutionMode,
} from "../src/lib/product-catalog";
import {
  buildConnectorCoreNtlmLoginUrl,
  buildConnectorNtlmLoginUrl,
  buildCoreNtlmValidationUrlForConnector,
  buildNtlmValidationUrlForConnector,
  getConnectorCoreNtlmDefaultDomain,
  getConnectorNtlmDefaultDomain,
  getLegacyForcedExecutionPaths,
  getProductBadgeLabel,
  getProductFieldPresentation,
  matchesLegacyForcedExecutionPath,
  requiresConnectorCoreNtlmDomain,
  getProductProfile,
  isConnectorNtlmActive,
  normalizeConnectorWithProfile,
  normalizeProxyRequestUrlForConnector,
  requiresConnectorNtlmDomain,
  rewriteResponseBodyForConnector,
  validateConnectorWithProfile,
} from "../src/lib/product-profiles";

function createContext(
  connectorType: ConnectorProductType,
  overrides: Partial<RequestContext> = {},
): RequestContext {
  const connector = {
    id: `${connectorType}-connector`,
    name: connectorType,
    description: "",
    isActive: true,
    targetUrl: "http://backend.local",
    publicHost: "bizguard.local",
    port: 8080,
    connectorType,
    hbForceUrls: [],
    productConfig: {},
  } as Connector;

  return {
    req: {
      method: "GET",
      headers: {},
      url: "/",
    } as unknown as http.IncomingMessage,
    connector,
    urlPart: "/",
    path: "/",
    isStatic: false,
    isImage: false,
    isPostLike: false,
    isAjax: false,
    isMultipartUpload: false,
    hasForcedHeartbeatPath: false,
    productConfig: getEffectiveProductConfig(connector),
    ...overrides,
  };
}

function resolveMode(ctx: RequestContext): ProductExecutionMode {
  return getRulesFor(ctx.connector.connectorType).resolveExecutionMode(ctx);
}

test("generic mantiene modo conservador para GET largos", () => {
  const ctx = createContext("generic");
  assert.equal(resolveMode(ctx), "passive-html");
});

test("bank usa background-job para UploadAndProcess multipart", () => {
  const ctx = createContext("bank", {
    req: {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=test" },
      url: "/CobranzaAutomatica/UploadAndProcess",
    } as unknown as http.IncomingMessage,
    urlPart: "/CobranzaAutomatica/UploadAndProcess",
    path: "/cobranzaautomatica/uploadandprocess",
    isPostLike: true,
    isMultipartUpload: true,
  });

  assert.equal(resolveMode(ctx), "background-job");
});

test("core mantiene xhr-keepalive para XHR largos", () => {
  const ctx = createContext("core", {
    req: {
      method: "POST",
      headers: { "x-requested-with": "XMLHttpRequest" },
      url: "/api/process",
    } as unknown as http.IncomingMessage,
    urlPart: "/api/process",
    path: "/api/process",
    isPostLike: true,
    isAjax: true,
  });

  assert.equal(resolveMode(ctx), "xhr-keepalive");
});

test("core mantiene xhr-keepalive para XHR GET largos", () => {
  const ctx = createContext("core", {
    req: {
      method: "GET",
      headers: { "x-requested-with": "XMLHttpRequest" },
      url: "/core/api/slow-json",
    } as unknown as http.IncomingMessage,
    urlPart: "/core/api/slow-json",
    path: "/core/api/slow-json",
    isAjax: true,
  });

  assert.equal(resolveMode(ctx), "xhr-keepalive");
});

test("serena-test excluye login del heartbeat", () => {
  const ctx = createContext("serena-test", {
    req: {
      method: "GET",
      headers: {},
      url: "/login.aspx",
    } as unknown as http.IncomingMessage,
    urlPart: "/login.aspx",
    path: "/login.aspx",
  });

  assert.equal(resolveMode(ctx), "none");
});

test("la configuracion legacy hbForceUrls sigue funcionando como override", () => {
  const connector = {
    id: "legacy-bank",
    name: "legacy-bank",
    description: "",
    isActive: true,
    targetUrl: "http://backend.local",
    publicHost: "bizguard.local",
    port: 8080,
    connectorType: "generic" as ConnectorProductType,
    hbForceUrls: ["/legacy/upload"],
    productConfig: {},
  } as Connector;

  const config = getEffectiveProductConfig(connector);
  assert.ok(config.backgroundJobPaths?.includes("/legacy/upload"));
  assert.deepEqual(getLegacyForcedExecutionPaths(connector), ["/legacy/upload"]);
  assert.equal(matchesLegacyForcedExecutionPath(connector, "/legacy/upload?id=1"), true);
  assert.equal(matchesLegacyForcedExecutionPath(connector, "/otra/ruta"), false);
});

test("dynamics-crm mantiene contrato NTLM y rewrite aislado por perfil", () => {
  const contract = getProductProfileContract("dynamics-crm");
  const profile = getProductProfile("dynamics-crm");

  assert.equal(profile.catalog.contract.normalizesDynamicsCrmPath, true);
  assert.equal(isConnectorNtlmActive({ connectorType: "dynamics-crm", isNtlm: false } as Connector), true);
  assert.equal(profile.supports.ntlmToggle, false);
  assert.equal(requiresConnectorNtlmDomain({ connectorType: "dynamics-crm", isNtlm: false } as Connector), true);
  assert.equal(contract.rewritesDynamicsCrmClientConfig, true);
  assert.equal(contract.keepsNtlmTransportPerRequest, true);
});

test("core mantiene contrato propio de NTLM sin toggle general", () => {
  const contract = getProductProfileContract("core");
  const profile = getProductProfile("core");

  assert.equal(profile.catalog.contract.requiresCoreNtlmDomain, true);
  assert.equal(isConnectorNtlmActive({ connectorType: "core", isNtlm: true } as Connector), false);
  assert.equal(profile.supports.ntlmToggle, false);
  assert.equal(profile.supports.coreNtlmDomain, true);
  assert.equal(requiresConnectorNtlmDomain({ connectorType: "core", isNtlm: false } as Connector), false);
  assert.equal(contract.requiresCoreNtlmDomain, true);
});

test("generic y bank no heredan parches especiales de CRM o Core", () => {
  assert.equal(getProductProfile("generic").catalog.contract.normalizesDynamicsCrmPath, false);
  assert.equal(getProductProfile("generic").catalog.contract.requiresCoreNtlmDomain, false);
  assert.equal(isConnectorNtlmActive({ connectorType: "generic", isNtlm: false } as Connector), false);
  assert.equal(isConnectorNtlmActive({ connectorType: "bank", isNtlm: false } as Connector), false);
  assert.equal(getProductProfile("generic").supports.ntlmToggle, true);
  assert.equal(getProductProfile("bank").supports.ntlmToggle, true);
});

test("el registry central devuelve un perfil por producto con reglas asociadas", () => {
  assert.equal(getProductProfile("generic").type, "generic");
  assert.equal(getProductProfile("bank").type, "bank");
  assert.equal(getProductProfile("core").type, "core");
  assert.equal(getProductProfile("dynamics-crm").type, "dynamics-crm");
  assert.equal(getProductProfile("serena-test").type, "serena-test");
});

test("la normalizacion por perfil limpia campos ajenos y fuerza invariantes", () => {
  const coreConnector = normalizeConnectorWithProfile({
    connectorType: "core" as ConnectorProductType,
    isNtlm: true,
    ntlmDomain: "IGNORAR",
    coreNtlmDomain: "CORE",
  });
  assert.equal(coreConnector.isNtlm, false);
  assert.equal(coreConnector.ntlmDomain, undefined);
  assert.equal(coreConnector.coreNtlmDomain, "CORE");

  const crmConnector = normalizeConnectorWithProfile({
    connectorType: "dynamics-crm" as ConnectorProductType,
    isNtlm: false,
    entryPath: "OrgCRM",
  });
  assert.equal(crmConnector.isNtlm, true);
  assert.equal(crmConnector.entryPath, "/OrgCRM");
});

test("el perfil expone dominio y URL de validacion NTLM sin hardcodes globales", () => {
  const crmConnector = {
    id: "crm",
    name: "CRM",
    description: "",
    isActive: true,
    targetUrl: "https://crm.example.com",
    publicHost: "crm.bizguard.local",
    port: 8443,
    connectorType: "dynamics-crm" as ConnectorProductType,
    ntlmDomain: "SERENA",
    entryPath: "/ORG/",
    productConfig: {},
  } as Connector;

  const coreConnector = {
    id: "core",
    name: "Core",
    description: "",
    isActive: true,
    targetUrl: "https://core.example.com",
    publicHost: "core.bizguard.local",
    port: 9443,
    connectorType: "core" as ConnectorProductType,
    coreNtlmDomain: "COREAD",
    productConfig: {},
  } as Connector;

  assert.equal(getConnectorNtlmDefaultDomain(crmConnector), "SERENA");
  assert.equal(getConnectorCoreNtlmDefaultDomain(coreConnector), "COREAD");
  assert.equal(getConnectorCoreNtlmDefaultDomain(crmConnector), undefined);
  assert.equal(buildNtlmValidationUrlForConnector(crmConnector), "https://crm.example.com/ORG/main.aspx");
  assert.equal(buildCoreNtlmValidationUrlForConnector(coreConnector), "https://core.example.com/LoginExterno.aspx");
  assert.equal(buildConnectorNtlmLoginUrl(crmConnector, "https://crm.bizguard.local/ORG"), "/login/ntlm?callbackUrl=https%3A%2F%2Fcrm.bizguard.local%2FORG&connectorId=crm&domain=SERENA");
  assert.equal(buildConnectorCoreNtlmLoginUrl(coreConnector, "https://core.bizguard.local/LoginExterno.aspx"), "/login/core-ntlm?callbackUrl=https%3A%2F%2Fcore.bizguard.local%2FLoginExterno.aspx&connectorId=core&domain=COREAD");
  assert.equal(requiresConnectorCoreNtlmDomain(crmConnector), false);
  assert.equal(requiresConnectorCoreNtlmDomain(coreConnector), true);
  assert.equal(getProductBadgeLabel("generic"), null);
  assert.equal(getProductBadgeLabel("dynamics-crm"), "CRM");
  assert.equal(getProductFieldPresentation("dynamics-crm").entryPathLabel, "Ruta de organizacion");
  assert.match(getProductFieldPresentation("dynamics-crm").entryPathHelp, /organizacion CRM/i);
  assert.equal(getProductFieldPresentation("core").entryPathLabel, "Path de entrada");
  assert.match(getProductFieldPresentation("core").coreNtlmDomainHelp, /NTLM Core/i);
});

test("la validacion central detecta contratos incompletos por perfil", () => {
  assert.deepEqual(
    validateConnectorWithProfile({ connectorType: "core" as ConnectorProductType, coreNtlmDomain: "" }),
    ["El perfil requiere Dominio NTLM Core."],
  );

  assert.deepEqual(
    validateConnectorWithProfile({ connectorType: "dynamics-crm" as ConnectorProductType, ntlmDomain: "" }),
    ["El perfil requiere Dominio NTLM."],
  );
});

test("las necesidades NTLM salen del perfil y no del toggle visual", () => {
  assert.equal(isConnectorNtlmActive({ connectorType: "dynamics-crm", isNtlm: false } as Connector), true);
  assert.equal(requiresConnectorNtlmDomain({ connectorType: "dynamics-crm", isNtlm: false } as Connector), true);
  assert.equal(requiresConnectorNtlmDomain({ connectorType: "generic", isNtlm: false } as Connector), false);
});

test("el proxy usa el perfil para normalizar request y reescribir respuesta", () => {
  const crmConnector = {
    id: "crm",
    name: "CRM",
    description: "",
    isActive: true,
    targetUrl: "http://backend.local",
    publicHost: "bizguard.local",
    port: 8080,
    connectorType: "dynamics-crm" as ConnectorProductType,
    entryPath: "/ORG/",
    hbForceUrls: [],
    productConfig: {},
  } as Connector;

  assert.equal(normalizeProxyRequestUrlForConnector(crmConnector, "/ORG/?id=1"), "/ORG/main.aspx?id=1");

  const rewritten = rewriteResponseBodyForConnector(
    crmConnector,
    "<html><body><script>var SERVER_URL = 'http://old'; var WEB_SERVER_HOST = 'old'; var WEB_SERVER_PORT = 80;</script></body></html>",
    { incomingHost: "crm.example.com", proto: "https" },
  );

  assert.match(rewritten, /crm\.example\.com/);
  assert.match(rewritten, /WEB_SERVER_PORT = 443/);
});
