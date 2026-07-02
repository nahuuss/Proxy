import test from "node:test";
import assert from "node:assert/strict";
import type { Connector } from "../src/lib/connectors";
import type { GlobalSettings } from "../src/lib/settings";
import { dispatchProxyConnectorRequest } from "../src/lib/proxy-request-dispatch";

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

function createMockRequest() {
  return {
    method: "GET",
    url: "/path",
  } as any;
}

function createMockResponse() {
  const response = {
    headersSent: false,
    statusCode: 200,
    body: "",
    writeHead(statusCode: number) {
      response.statusCode = statusCode;
      response.headersSent = true;
      return response;
    },
    end(body?: string) {
      response.body = body || "";
      response.headersSent = true;
      return response;
    },
  };

  return response as any;
}

test("proxy request dispatch registra request, crea proxy server y emite al backend", () => {
  const connector = makeConnector();
  const req = createMockRequest();
  const res = createMockResponse();
  const logs: string[] = [];
  const stats = new Map<string, { requests: number; bytes: number; latency?: number }>();
  const emitted: Array<{ req: unknown; res: unknown }> = [];
  const proxyServer = {
    emit(event: string, eventReq: unknown, eventRes: unknown) {
      assert.equal(event, "request");
      emitted.push({ req: eventReq, res: eventRes });
    },
  };
  const proxyServers = new Map([
    [
      connector.id,
      {
        server: proxyServer,
        connector,
      },
    ],
  ]);
  let pendingCalls = 0;

  dispatchProxyConnectorRequest({
    connector,
    req,
    res,
    settings: makeSettings(),
    stats,
    proxyServers: proxyServers as any,
    markStatsPending: () => {
      pendingCalls++;
    },
    log: (message) => {
      logs.push(message);
    },
  });

  assert.equal(stats.get(connector.id)?.requests, 1);
  assert.equal(pendingCalls, 1);
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0]?.req, req);
  assert.equal(emitted[0]?.res, res);
  assert.ok(logs.some((entry) => entry.includes("[BIZGUARD-IN] GET /path")));
});

test("proxy request dispatch responde 502 si el proxy falla y no habia headers enviados", () => {
  const connector = makeConnector();
  const req = createMockRequest();
  const res = createMockResponse();
  const logs: string[] = [];
  const proxyServer = {
    emit() {
      throw new Error("boom");
    },
  };

  dispatchProxyConnectorRequest({
    connector,
    req,
    res,
    settings: makeSettings(),
    stats: new Map(),
    proxyServers: new Map([
      [
        connector.id,
        {
          server: proxyServer,
          connector,
        },
      ],
    ]) as any,
    markStatsPending: () => {},
    log: (message) => {
      logs.push(message);
    },
  });

  assert.equal(res.statusCode, 502);
  assert.equal(res.body, "BizGuard Proxy Error");
  assert.ok(logs.some((entry) => entry.includes("Proxy failed")));
});
