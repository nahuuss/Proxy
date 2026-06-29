import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { Connector } from "../src/lib/connectors";
import { getRulesFor, type RequestContext } from "../src/lib/rules/index";
import {
  ConnectorProductType,
  getEffectiveProductConfig,
  ProductExecutionMode,
} from "../src/lib/product-catalog";

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
});
