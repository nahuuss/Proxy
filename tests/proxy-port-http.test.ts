import test from "node:test";
import assert from "node:assert/strict";
import type http from "http";
import type { Connector } from "../src/lib/connectors";
import type { GlobalSettings } from "../src/lib/settings";
import { createProxyPortHttpRequestHandler } from "../src/lib/proxy-port-http";

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return {
    id: "connector-1",
    name: "Connector 1",
    description: "",
    port: 8080,
    targetUrl: "https://backend.example.com",
    publicHost: "app.example.com",
    isActive: true,
    connectorType: "generic",
    productConfig: {},
    ...overrides,
  };
}

function makeSettings(overrides: Partial<GlobalSettings> = {}): GlobalSettings {
  return {
    id: "global_settings",
    internalTarget: "http://127.0.0.1:3000",
    publicHost: "app.example.com",
    bypassAuth: false,
    authUrl: "https://auth.example.com",
    hbFirstPulse: 20,
    memoryResetIntervalMinutes: 30,
    ...overrides,
  };
}

function createMockResponse() {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: "",
    headersSent: false,
    writeHead(statusCode: number, headers?: Record<string, string>) {
      response.statusCode = statusCode;
      response.headers = headers || {};
      response.headersSent = true;
      return response;
    },
    end(body?: string) {
      response.body = body || "";
      response.headersSent = true;
      return response;
    },
  };

  return response as unknown as http.ServerResponse & {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    headersSent: boolean;
  };
}

function createMockRequest(input?: {
  url?: string;
  host?: string;
  cookie?: string;
  remoteAddress?: string;
}) {
  return {
    url: input?.url || "/",
    method: "GET",
    headers: {
      host: input?.host || "app.example.com",
      cookie: input?.cookie || "",
    },
    socket: {
      remoteAddress: input?.remoteAddress || "10.0.0.1",
    },
  } as unknown as http.IncomingMessage;
}

test("proxy port http bloquea anonimos por rate limit antes de cargar contexto", async () => {
  let loadCalls = 0;
  const handler = createProxyPortHttpRequestHandler({
    port: 8080,
    rateLimiter: { check: () => false },
    loadContext: async () => {
      loadCalls++;
      return { connectors: [], settings: makeSettings() };
    },
    verifySession: async () => null,
    forwardToInternalDashboard: () => {},
    handleConnectorRequest: () => {},
    log: () => {},
  });

  const req = createMockRequest();
  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 429);
  assert.equal(loadCalls, 0);
  assert.equal(res.body, "Too Many Requests");
});

test("proxy port http delega rutas internas al dashboard", async () => {
  let forwardedHost = "";
  const handler = createProxyPortHttpRequestHandler({
    port: 8080,
    rateLimiter: { check: () => true },
    loadContext: async () => ({
      connectors: [makeConnector()],
      settings: makeSettings(),
    }),
    verifySession: async () => null,
    forwardToInternalDashboard: (_req, _res, hostHeader) => {
      forwardedHost = hostHeader;
    },
    handleConnectorRequest: () => {
      throw new Error("no deberia llegar al conector");
    },
    log: () => {},
  });

  await handler(
    createMockRequest({ url: "/login", host: "core.example.com" }),
    createMockResponse(),
  );

  assert.equal(forwardedHost, "core.example.com");
});

test("proxy port http devuelve 401 en api protegida sin sesion", async () => {
  const logs: string[] = [];
  const handler = createProxyPortHttpRequestHandler({
    port: 8080,
    rateLimiter: { check: () => true },
    loadContext: async () => ({
      connectors: [makeConnector()],
      settings: makeSettings(),
    }),
    verifySession: async () => null,
    forwardToInternalDashboard: () => {},
    handleConnectorRequest: () => {
      throw new Error("no deberia despachar al proxy");
    },
    log: (message) => {
      logs.push(message);
    },
  });

  const res = createMockResponse();
  await handler(createMockRequest({ url: "/api/data" }), res);

  assert.equal(res.statusCode, 401);
  assert.match(res.body, /Unauthorized/);
  assert.ok(logs.some((entry) => entry.includes("requires auth")));
});

test("proxy port http despacha al conector cuando el acceso no requiere sesion", async () => {
  let handledConnectorId = "";
  const handler = createProxyPortHttpRequestHandler({
    port: 8080,
    rateLimiter: { check: () => true },
    loadContext: async () => ({
      connectors: [makeConnector({ bypassAuth: true })],
      settings: makeSettings(),
    }),
    verifySession: async () => null,
    forwardToInternalDashboard: () => {},
    handleConnectorRequest: (connector) => {
      handledConnectorId = connector.id;
    },
    log: () => {},
  });

  await handler(createMockRequest(), createMockResponse());

  assert.equal(handledConnectorId, "connector-1");
});
