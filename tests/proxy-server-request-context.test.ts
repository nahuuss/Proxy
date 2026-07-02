import test from "node:test";
import assert from "node:assert/strict";
import type http from "http";
import type { Connector } from "../src/lib/connectors";
import {
  createProxyServerRequestContext,
  describeProxyExecutionMode,
  normalizeHeartbeatPathCandidate,
  resolveProfileLabel,
} from "../src/lib/proxy-server-request-context";

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

function createRequest(overrides: Partial<http.IncomingMessage> = {}): http.IncomingMessage {
  return {
    method: "GET",
    url: "/home",
    headers: {
      host: "proxy.local",
    },
    socket: {
      remoteAddress: "10.0.0.5",
    },
    ...overrides,
  } as http.IncomingMessage;
}

test("proxy server request context sanea headers forward y arma request options", () => {
  const req = createRequest({
    headers: {
      host: "localhost:3000",
      "x-bizguard-client-id": "abc123",
      "x-bizguard-request-id": "req-1",
      "x-forwarded-for": "203.0.113.2",
      "cf-ray": "secret",
      cookie: "a=b",
    },
  });

  const context = createProxyServerRequestContext({
    connector: createConnector(),
    req,
    targetUrl: new URL("https://backend.example.com/home"),
    isHttps: true,
    agent: {} as http.Agent,
  });
  const requestHeaders = context.options.headers as Record<string, string | string[] | undefined>;

  assert.equal(context.bizguardClientId, "abc123");
  assert.equal(context.bizguardRequestId, "req-1");
  assert.equal(context.proto, "http");
  assert.equal(requestHeaders.host, "backend.example.com");
  assert.equal(requestHeaders["x-forwarded-host"], "localhost:3000");
  assert.equal(requestHeaders["x-forwarded-for"], "203.0.113.2");
  assert.equal(requestHeaders["accept-encoding"], "identity");
  assert.equal("cf-ray" in context.forwardedHeaders, false);
  assert.equal("x-bizguard-client-id" in context.forwardedHeaders, false);
});

test("proxy server request context respeta dashboard interno y desactiva heartbeat", () => {
  const context = createProxyServerRequestContext({
    connector: createConnector({
      id: "internal-dashboard",
      connectorType: "core",
      productConfig: { core: {} },
    }),
    req: createRequest(),
    targetUrl: new URL("http://127.0.0.1:3000/dashboard"),
    isHttps: false,
    agent: {} as http.Agent,
  });

  assert.equal(context.hostToSend, "proxy.local");
  assert.equal(context.executionMode, "none");
  assert.equal(context.hbEligible, false);
});

test("proxy server request context preserva contrato core para XHR largos", () => {
  const context = createProxyServerRequestContext({
    connector: createConnector({
      connectorType: "core",
      productConfig: { core: { xhrKeepAliveForAjax: true } },
    }),
    req: createRequest({
      method: "POST",
      url: "/api/report",
      headers: {
        host: "core.example.com",
        accept: "application/json",
      },
    }),
    targetUrl: new URL("https://backend.example.com/api/report"),
    isHttps: true,
    agent: {} as http.Agent,
  });

  assert.equal(context.isAjax, true);
  assert.equal(context.executionMode, "xhr-keepalive");
  assert.match(describeProxyExecutionMode(context), /mode=xhr-keepalive/);
});

test("proxy server request context mantiene override legacy hbForceUrls", () => {
  const context = createProxyServerRequestContext({
    connector: createConnector({
      connectorType: "generic",
      hbForceUrls: ["/legacy/upload"],
      productConfig: { generic: {} },
    }),
    req: createRequest({
      method: "POST",
      url: "/legacy/upload",
      headers: {
        host: "generic.example.com",
      },
    }),
    targetUrl: new URL("https://backend.example.com/legacy/upload"),
    isHttps: true,
    agent: {} as http.Agent,
  });

  assert.equal(context.hasForcedHeartbeatPath, true);
  assert.equal(context.executionMode, "background-job");
});

test("proxy server request context expone helpers de perfil y normalizacion", () => {
  assert.equal(normalizeHeartbeatPathCandidate(" Login "), "/login");
  assert.equal(resolveProfileLabel(createConnector({ connectorType: "dynamics-crm" })), "dynamics-crm");
  assert.equal(resolveProfileLabel(createConnector({ connectorType: undefined })), "generic");
});
