import test from "node:test";
import assert from "node:assert/strict";
import type http from "http";
import { createProxyHeartbeatState } from "../src/lib/proxy-heartbeat";
import { writeHeartbeatRedirectResponse, writeStandardProxyResponse } from "../src/lib/proxy-standard-delivery";

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

test("proxy standard delivery escribe redirect por script", () => {
  const res = new MockResponse();
  writeHeartbeatRedirectResponse({
    res: res as unknown as http.ServerResponse,
    script: "<script>go()</script>",
  });

  assert.equal(Buffer.concat(res.chunks).toString("utf8"), "<script>go()</script>");
  assert.equal(res.writableEnded, true);
});

test("proxy standard delivery responde normal sin heartbeat", () => {
  const res = new MockResponse();
  writeStandardProxyResponse({
    res: res as unknown as http.ServerResponse,
    heartbeatState: createProxyHeartbeatState(),
    body: Buffer.from("ok"),
    headers: { "content-type": "text/plain" },
    statusCode: 200,
    path: "/home",
    connectorId: "generic-1",
    logHB: () => {},
    logDebugEntry: () => {},
    elapsedMs: 5,
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers?.["content-length"], "2");
  assert.equal(Buffer.concat(res.chunks).toString("utf8"), "ok");
});

test("proxy standard delivery cierra html heartbeat y adjunta body", () => {
  const res = new MockResponse();
  res.headersSent = true;
  const heartbeat = createProxyHeartbeatState();
  heartbeat.isHeartbeatActive = true;
  heartbeat.isHtmlCommentOpen = true;

  writeStandardProxyResponse({
    res: res as unknown as http.ServerResponse,
    heartbeatState: heartbeat,
    body: Buffer.from("payload"),
    headers: { "content-type": "text/html" },
    statusCode: 200,
    path: "/home",
    connectorId: "generic-1",
    logHB: () => {},
    logDebugEntry: () => {},
    elapsedMs: 5,
  });

  const output = Buffer.concat(res.chunks).toString("utf8");
  assert.equal(output.includes("bg-cleanup-script"), true);
  assert.equal(output.includes("payload"), true);
});
