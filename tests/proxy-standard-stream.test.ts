import test from "node:test";
import assert from "node:assert/strict";
import type http from "http";
import type { Connector } from "../src/lib/connectors";
import { createProxyHeartbeatState } from "../src/lib/proxy-heartbeat";
import { finalizeDirectStreamSuccess, finalizeProxyRequestError } from "../src/lib/proxy-standard-stream";

class MockResponse {
  headersSent = false;
  writableEnded = false;
  destroyed = false;
  statusCode?: number;
  body = "";

  writeHead(statusCode: number) {
    this.headersSent = true;
    this.statusCode = statusCode;
    return this;
  }

  end(chunk?: string | Buffer) {
    if (chunk) {
      this.body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
    }
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

test("proxy standard stream finaliza streaming directo", () => {
  const res = new MockResponse();
  let cleared = false;

  finalizeDirectStreamSuccess({
    connector: createConnector(),
    req: createRequest(),
    res: res as unknown as http.ServerResponse,
    heartbeatState: createProxyHeartbeatState(),
    startTime: Date.now() - 5,
    ttfbMs: 3,
    statusCode: 200,
    responseHeaders: { "content-type": "application/pdf" },
    requestBody: Buffer.from("req"),
    responseBodyBytes: 128,
    username: "ana",
    clearHeartbeatTimers: () => {
      cleared = true;
    },
    buildTrafficEntry: () => null,
  });

  assert.equal(res.writableEnded, true);
  assert.equal(cleared, true);
});

test("proxy standard stream maneja error 502", () => {
  const res = new MockResponse();
  let cleared = false;
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    finalizeProxyRequestError({
      connector: createConnector(),
      req: createRequest(),
      res: res as unknown as http.ServerResponse,
      heartbeatState: createProxyHeartbeatState(),
      startTime: Date.now() - 5,
      requestBody: Buffer.from("req"),
      error: new Error("fallo"),
      username: "ana",
      clearHeartbeatTimers: () => {
        cleared = true;
      },
      buildTrafficEntry: () => null,
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 502);
  assert.equal(res.body, "Bad Gateway");
  assert.equal(cleared, true);
});
