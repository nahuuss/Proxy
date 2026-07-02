import test from "node:test";
import assert from "node:assert/strict";
import type http from "http";
import type { Connector } from "../src/lib/connectors";
import { createProxyHeartbeatState } from "../src/lib/proxy-heartbeat";
import { finalizeStandardRewrite } from "../src/lib/proxy-standard-rewrite";

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

function createRequest(url = "/home"): http.IncomingMessage {
  return {
    method: "GET",
    url,
    headers: {},
  } as http.IncomingMessage;
}

test("proxy standard rewrite entrega respuesta de texto reescrita", () => {
  const res = new MockResponse();
  let cleared = false;

  finalizeStandardRewrite({
    connector: createConnector(),
    req: createRequest(),
    res: res as unknown as http.ServerResponse,
    heartbeatState: createProxyHeartbeatState(),
    startTime: Date.now() - 5,
    ttfbMs: 2,
    path: "/home",
    incomingHost: "proxy.local",
    targetUrl: new URL("https://backend.example.com/home"),
    urlPart: "/home",
    proto: "https",
    contentEncoding: "",
    contentType: "text/html",
    isFileDownload: false,
    statusCode: 200,
    responseHeaders: { "content-type": "text/html" },
    originalHeaders: { "content-type": "text/html" },
    requestBody: Buffer.from("req"),
    rawBody: Buffer.from('<a href="https://backend.example.com/home">ok</a>'),
    username: "ana",
    buildTrafficEntry: () => null,
    clearHeartbeatTimers: () => {
      cleared = true;
    },
    logHB: () => {},
    logDebugEntry: () => {},
  });

  assert.equal(cleared, true);
  assert.equal(res.statusCode, 200);
  assert.equal(Buffer.concat(res.chunks).toString("utf8").includes("backend.example.com"), false);
});

test("proxy standard rewrite usa descarga binaria cuando heartbeat esta activo", () => {
  const res = new MockResponse();
  const heartbeat = createProxyHeartbeatState();
  heartbeat.isHeartbeatActive = true;

  finalizeStandardRewrite({
    connector: createConnector(),
    req: createRequest("/file"),
    res: res as unknown as http.ServerResponse,
    heartbeatState: heartbeat,
    startTime: Date.now() - 5,
    ttfbMs: 2,
    path: "/file",
    incomingHost: "proxy.local",
    targetUrl: new URL("https://backend.example.com/file"),
    urlPart: "/file",
    proto: "https",
    contentEncoding: "",
    contentType: "application/pdf",
    isFileDownload: true,
    statusCode: 200,
    responseHeaders: { "content-type": "application/pdf" },
    originalHeaders: { "content-type": "application/pdf" },
    requestBody: null,
    rawBody: Buffer.concat([Buffer.from("x"), Buffer.from([0x25, 0x50, 0x44, 0x46]), Buffer.from("resto")]),
    username: "ana",
    buildTrafficEntry: () => null,
    clearHeartbeatTimers: () => {},
    logHB: () => {},
    logDebugEntry: () => {},
  });

  assert.equal(res.writableEnded, true);
});
