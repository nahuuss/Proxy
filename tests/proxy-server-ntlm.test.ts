import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "events";
import type http from "http";
import { handleProxyNtlmHandshake } from "../src/lib/proxy-server-ntlm";
import { createProxyHeartbeatState } from "../src/lib/proxy-heartbeat";
import type { Connector } from "../src/lib/connectors";

class MockRequest extends EventEmitter {
  method = "GET";
  url = "/";
  headers: Record<string, string | string[] | undefined> = {};
  socket = { remoteAddress: "127.0.0.1" };
}

class MockResponse {
  headersSent = false;
  writableEnded = false;
  destroyed = false;
  statusCode?: number;
  headers?: Record<string, string | string[] | undefined>;
  chunks: Buffer[] = [];

  writeHead(statusCode: number, headers?: Record<string, string | string[] | undefined>) {
    this.headersSent = true;
    this.statusCode = statusCode;
    this.headers = headers;
    return this;
  }

  write(chunk: string | Buffer) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return true;
  }

  end(chunk?: string | Buffer) {
    if (chunk) this.write(chunk);
    this.writableEnded = true;
    return this;
  }
}

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

function emitBody(req: MockRequest, body: Buffer) {
  if (body.length > 0) {
    req.emit("data", body);
  }
  req.emit("end");
}

test("proxy server ntlm ejecuta handshake core preservando query string y fallback de dominio", async () => {
  const req = new MockRequest();
  req.method = "POST";
  req.url = "/LoginExterno.aspx?ReturnUrl=%2Fhome";
  req.headers = { host: "core.example.com" };
  const res = new MockResponse();
  let startedHeartbeat = 0;
  let metricBytes = 0;
  let calledUrl = "";
  let calledDomain = "";

  const handled = handleProxyNtlmHandshake({
    connector: createConnector({
      id: "core-1",
      connectorType: "core",
      coreNtlmDomain: "COREAD",
      productConfig: { core: {} },
    }),
    req: req as unknown as http.IncomingMessage,
    res: res as unknown as http.ServerResponse,
    session: {
      coreUser: "demo",
      corePass: "secret",
      coreDomain: "COREAD",
      coreConnectorId: "core-1",
    },
    effectiveReqUrl: "/LoginExterno.aspx?ReturnUrl=%2Fhome",
    incomingHost: "core.example.com",
    urlPart: "/loginexterno.aspx",
    proto: "https",
    targetUrl: new URL("https://backend.example.com/LoginExterno.aspx"),
    agent: {} as any,
    heartbeatState: createProxyHeartbeatState(),
    hbEligible: true,
    startHeartbeatShield: () => {
      startedHeartbeat++;
    },
    clearHeartbeatTimers: () => {},
    startTime: Date.now() - 5,
    onMetric: (_id, bytes) => {
      metricBytes = bytes;
    },
    buildTrafficEntry: () => null,
    logHB: () => {},
    resolveNtlmMethodFn: () => {
      return (((options: { url: string; domain: string }, callback: (error: any, response: any) => void) => {
        calledUrl = options.url;
        calledDomain = options.domain;
        callback(null, {
          statusCode: 200,
          headers: { "content-type": "text/plain" },
          body: Buffer.from("ok"),
        });
      }) as any);
    },
  });

  assert.equal(handled, true);
  emitBody(req, Buffer.from("payload"));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(startedHeartbeat, 1);
  assert.match(calledUrl, /ReturnUrl=%2Fhome$/);
  assert.equal(calledDomain, "COREAD");
  assert.equal(metricBytes, 2);
  assert.equal(res.statusCode, 200);
  assert.equal(Buffer.concat(res.chunks).toString("utf8"), "ok");
});

test("proxy server ntlm responde 401 cuando la sesion CRM esta incompleta", () => {
  const res = new MockResponse();
  const handled = handleProxyNtlmHandshake({
    connector: createConnector({
      id: "crm-1",
      connectorType: "dynamics-crm",
      ntlmDomain: "SERENA",
      entryPath: "/ORG/",
      productConfig: { "dynamics-crm": {} },
    }),
    req: new MockRequest() as unknown as http.IncomingMessage,
    res: res as unknown as http.ServerResponse,
    session: {
      crmUser: "demo",
      crmPass: "secret",
      crmConnectorId: "crm-1",
    },
    effectiveReqUrl: "/ORG/main.aspx",
    incomingHost: "crm.example.com",
    urlPart: "/org/main.aspx",
    proto: "https",
    targetUrl: new URL("https://backend.example.com/ORG/main.aspx"),
    agent: {} as any,
    heartbeatState: createProxyHeartbeatState(),
    hbEligible: false,
    startHeartbeatShield: () => {},
    clearHeartbeatTimers: () => {},
    startTime: Date.now(),
    onMetric: () => {},
    buildTrafficEntry: () => null,
    logHB: () => {},
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 401);
});

test("proxy server ntlm bloquea CRM cuando el breaker esta abierto", async () => {
  const req = new MockRequest();
  req.url = "/ORG/main.aspx";
  const res = new MockResponse();

  const handled = handleProxyNtlmHandshake({
    connector: createConnector({
      id: "crm-1",
      connectorType: "dynamics-crm",
      ntlmDomain: "SERENA",
      entryPath: "/ORG/",
      productConfig: { "dynamics-crm": {} },
    }),
    req: req as unknown as http.IncomingMessage,
    res: res as unknown as http.ServerResponse,
    session: {
      crmUser: "demo",
      crmPass: "secret",
      crmDomain: "SERENA",
      crmConnectorId: "crm-1",
    },
    effectiveReqUrl: "/ORG/main.aspx",
    incomingHost: "crm.example.com",
    urlPart: "/org/main.aspx",
    proto: "https",
    targetUrl: new URL("https://backend.example.com/ORG/main.aspx"),
    agent: {} as any,
    heartbeatState: createProxyHeartbeatState(),
    hbEligible: true,
    startHeartbeatShield: () => {},
    clearHeartbeatTimers: () => {},
    startTime: Date.now(),
    onMetric: () => {},
    buildTrafficEntry: () => null,
    logHB: () => {},
    getCrmBlockState: () => ({
      failures: [Date.now()],
      blockedUntil: Date.now() + 60_000,
    }),
  });

  assert.equal(handled, true);
  emitBody(req, Buffer.alloc(0));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(res.statusCode, 429);
});

test("proxy server ntlm ignora conectores sin contrato ntlm", () => {
  const handled = handleProxyNtlmHandshake({
    connector: createConnector(),
    req: new MockRequest() as unknown as http.IncomingMessage,
    res: new MockResponse() as unknown as http.ServerResponse,
    session: null,
    effectiveReqUrl: "/home",
    incomingHost: "proxy.local",
    urlPart: "/home",
    proto: "https",
    targetUrl: new URL("https://backend.example.com/home"),
    agent: {} as any,
    heartbeatState: createProxyHeartbeatState(),
    hbEligible: false,
    startHeartbeatShield: () => {},
    clearHeartbeatTimers: () => {},
    startTime: Date.now(),
    onMetric: () => {},
    buildTrafficEntry: () => null,
    logHB: () => {},
  });

  assert.equal(handled, false);
});
