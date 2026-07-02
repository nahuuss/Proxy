import test from "node:test";
import assert from "node:assert/strict";
import type http from "http";
import { handleCoreNtlmError, handleCoreNtlmSuccess, handleCrmNtlmError, handleCrmNtlmSuccess } from "../src/lib/proxy-ntlm-callbacks";
import type { Connector } from "../src/lib/connectors";
import { createProxyHeartbeatState } from "../src/lib/proxy-heartbeat";

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
    harLog: false,
    trafficLog: false,
    ...overrides,
  };
}

function createRequest(): http.IncomingMessage {
  return {
    method: "GET",
    url: "/home",
    headers: {},
  } as http.IncomingMessage;
}

test("proxy ntlm callbacks responde exito core con body y content-length", () => {
  const res = new MockResponse();
  let metricId: string | null = null;
  let metricBytes: number | null = null;

  handleCoreNtlmSuccess({
    connector: createConnector(),
    req: createRequest(),
    res: res as unknown as http.ServerResponse,
    reqBody: Buffer.from("req"),
    startTime: Date.now() - 5,
    targetUrl: new URL("https://backend.example.com/home"),
    incomingHost: "proxy.local",
    urlPart: "/home",
    proto: "https",
    response: {
      statusCode: 200,
      headers: { "content-type": "text/plain" },
      body: Buffer.from("ok"),
    },
    credentials: {
      username: "ana",
      password: "secret",
      domain: "SERENA",
      connectorId: "generic-1",
    },
    onMetric: (id, bytes, latency) => {
      metricId = id;
      metricBytes = bytes;
    },
    buildTrafficEntry: () => null,
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers?.["content-length"], "2");
  assert.equal(Buffer.concat(res.chunks).toString("utf8"), "ok");
  assert.equal(metricId, "generic-1");
  assert.equal(metricBytes, 2);
});

test("proxy ntlm callbacks responde error crm con 502", () => {
  const res = new MockResponse();

  handleCrmNtlmError({
    connector: createConnector({ connectorType: "dynamics-crm", productConfig: { "dynamics-crm": {} } }),
    req: createRequest(),
    res: res as unknown as http.ServerResponse,
    reqBody: Buffer.from("req"),
    startTime: Date.now() - 5,
    targetUrl: new URL("https://backend.example.com/main.aspx"),
    incomingHost: "proxy.local",
    urlPart: "/main.aspx",
    proto: "https",
    error: new Error("fallo ntlm"),
    credentials: {
      username: "crm.user",
      password: "secret",
      domain: "SERENA",
      connectorId: "generic-1",
    },
    buildTrafficEntry: () => null,
  });

  assert.equal(res.statusCode, 502);
  assert.equal(Buffer.concat(res.chunks).toString("utf8"), "NTLM Error: fallo ntlm");
});

test("proxy ntlm callbacks mantiene el helper de heartbeat disponible para crm", () => {
  const heartbeat = createProxyHeartbeatState();
  assert.equal(heartbeat.isHeartbeatActive, false);
});

test("proxy ntlm callbacks responde exito crm con body y callback de auth", () => {
  const res = new MockResponse();
  const heartbeat = createProxyHeartbeatState();
  let authStatus: number | null = null;

  handleCrmNtlmSuccess({
    connector: createConnector({ connectorType: "dynamics-crm", productConfig: { "dynamics-crm": {} } }),
    req: createRequest(),
    res: res as unknown as http.ServerResponse,
    reqBody: Buffer.from("req"),
    startTime: Date.now() - 5,
    targetUrl: new URL("https://backend.example.com/main.aspx"),
    incomingHost: "proxy.local",
    urlPart: "/main.aspx",
    proto: "https",
    response: {
      statusCode: 200,
      headers: { "content-type": "text/plain" },
      body: Buffer.from("ok-crm"),
    },
    credentials: {
      username: "crm.user",
      password: "secret",
      domain: "SERENA",
      connectorId: "generic-1",
    },
    heartbeatState: heartbeat,
    onMetric: () => {},
    onAuthResult: (statusCode) => {
      authStatus = statusCode;
    },
    buildTrafficEntry: () => null,
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers?.["content-length"], "6");
  assert.equal(Buffer.concat(res.chunks).toString("utf8"), "ok-crm");
  assert.equal(authStatus, 200);
});

test("proxy ntlm callbacks responde error core con 502", () => {
  const res = new MockResponse();

  handleCoreNtlmError({
    connector: createConnector({ connectorType: "core", productConfig: { core: {} } }),
    req: createRequest(),
    res: res as unknown as http.ServerResponse,
    reqBody: Buffer.from("req"),
    startTime: Date.now() - 5,
    targetUrl: new URL("https://backend.example.com/LoginExterno.aspx"),
    incomingHost: "proxy.local",
    urlPart: "/LoginExterno.aspx",
    proto: "https",
    error: new Error("credenciales invalidas"),
    buildTrafficEntry: () => null,
  });

  assert.equal(res.statusCode, 502);
  assert.equal(Buffer.concat(res.chunks).toString("utf8"), "NTLM Error: credenciales invalidas");
});
