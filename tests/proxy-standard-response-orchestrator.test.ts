import assert from "node:assert/strict";
import { EventEmitter } from "events";
import http from "http";
import test from "node:test";
import { createProxyHeartbeatState } from "../src/lib/proxy-heartbeat";
import { handleStandardProxyResponse } from "../src/lib/proxy-standard-response-orchestrator";
import type { Connector } from "../src/lib/connectors";

class MockResponse {
  headersSent = false;
  writableEnded = false;
  destroyed = false;
  statusCode?: number;
  headers?: Record<string, string | string[] | undefined>;
  body = "";

  writeHead(statusCode: number, headers?: Record<string, string | string[] | undefined>) {
    this.headersSent = true;
    this.statusCode = statusCode;
    this.headers = headers;
    return this;
  }

  write(chunk: string | Buffer) {
    this.body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
    return true;
  }

  end(chunk?: string | Buffer) {
    if (chunk) {
      this.write(chunk);
    }
    this.writableEnded = true;
    return this;
  }
}

class MockProxyResponse extends EventEmitter {
  statusCode?: number;
  headers: http.IncomingHttpHeaders;

  constructor(statusCode: number, headers: http.IncomingHttpHeaders) {
    super();
    this.statusCode = statusCode;
    this.headers = headers;
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
    session: { user: { email: "ana@example.com" } },
  } as unknown as http.IncomingMessage;
}

test("proxy standard response orchestrator fuerza redirect cuando hay heartbeat activo", () => {
  const heartbeatState = createProxyHeartbeatState();
  heartbeatState.isHeartbeatActive = true;
  heartbeatState.isHtmlCommentOpen = true;
  const res = new MockResponse();
  const proxyRes = new MockProxyResponse(302, {
    location: "/destino",
    "content-type": "text/html",
  });

  handleStandardProxyResponse({
    connector: createConnector(),
    req: createRequest("/home"),
    res: res as unknown as http.ServerResponse,
    proxyRes: proxyRes as unknown as http.IncomingMessage,
    heartbeatState,
    startTime: Date.now() - 10,
    ttfbMs: 3,
    path: "/home",
    incomingHost: "proxy.local",
    targetUrl: new URL("https://backend.example.com/home"),
    urlPart: "/home",
    proto: "https",
    responseHeaders: { location: "/destino", "content-type": "text/html" },
    requestBody: null,
    clearHeartbeatTimers: () => {},
    onMetric: () => {},
    buildTrafficEntry: () => null,
    logHB: () => {},
    logDebugEntry: () => {},
    getRedirectScript: (location) => `redir:${location}`,
  });

  assert.equal(res.writableEnded, true);
  assert.match(res.body, /redir:\/destino/);
});

test("proxy standard response orchestrator hace streaming directo para binario sin rewrite", () => {
  const heartbeatState = createProxyHeartbeatState();
  const res = new MockResponse();
  const proxyRes = new MockProxyResponse(200, {
    "content-type": "application/pdf",
  });
  let metricBytes = 0;

  handleStandardProxyResponse({
    connector: createConnector(),
    req: createRequest("/file"),
    res: res as unknown as http.ServerResponse,
    proxyRes: proxyRes as unknown as http.IncomingMessage,
    heartbeatState,
    startTime: Date.now() - 10,
    ttfbMs: 2,
    path: "/file",
    incomingHost: "proxy.local",
    targetUrl: new URL("https://backend.example.com/file"),
    urlPart: "/file",
    proto: "https",
    responseHeaders: { "content-type": "application/pdf" },
    requestBody: Buffer.from("req"),
    clearHeartbeatTimers: () => {},
    onMetric: (bytes) => {
      metricBytes += bytes;
    },
    buildTrafficEntry: () => null,
    logHB: () => {},
    logDebugEntry: () => {},
    getRedirectScript: () => "",
  });

  proxyRes.emit("data", Buffer.from("pdf"));
  proxyRes.emit("end");

  assert.equal(metricBytes, 3);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, "pdf");
  assert.equal(res.writableEnded, true);
});
