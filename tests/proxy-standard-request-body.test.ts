import assert from "node:assert/strict";
import { EventEmitter } from "events";
import http from "http";
import test from "node:test";
import { forwardProxyRequestBody } from "../src/lib/proxy-standard-request-body";

class MockRequest extends EventEmitter {
  pipedTo: unknown[] = [];
  unpipedFrom: unknown[] = [];
  resumed = false;

  pipe(target: unknown) {
    this.pipedTo.push(target);
    return target;
  }

  unpipe(target: unknown) {
    this.unpipedFrom.push(target);
    return this;
  }

  resume() {
    this.resumed = true;
    return this;
  }
}

class MockResponse {
  headersSent = false;
  writableEnded = false;
  statusCode?: number;
  chunks: Buffer[] = [];

  writeHead(statusCode: number) {
    this.headersSent = true;
    this.statusCode = statusCode;
    return this;
  }

  end(chunk?: string | Buffer) {
    if (chunk) {
      this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    this.writableEnded = true;
    return this;
  }
}

class MockClientRequest {
  destroyed = false;

  destroy() {
    this.destroyed = true;
  }
}

test("proxy standard request body pipea el request y captura chunks cuando se pide HAR", () => {
  const req = new MockRequest();
  const res = new MockResponse();
  const proxyReq = new MockClientRequest();
  const captureChunks: Buffer[] = [];
  let metricBytes = 0;

  forwardProxyRequestBody({
    req: req as unknown as http.IncomingMessage,
    res: res as unknown as http.ServerResponse,
    proxyReq: proxyReq as unknown as http.ClientRequest,
    maxBodyBytes: 1024,
    captureChunks,
    onMetric: (bytes) => {
      metricBytes += bytes;
    },
    clearHeartbeatTimers: () => {},
  });

  req.emit("data", Buffer.from("abc"));

  assert.equal(req.pipedTo[0], proxyReq);
  assert.equal(metricBytes, 3);
  assert.equal(captureChunks.length, 1);
  assert.equal(captureChunks[0].toString("utf8"), "abc");
  assert.equal(proxyReq.destroyed, false);
});

test("proxy standard request body corta el request con 413 cuando supera el maximo", () => {
  const req = new MockRequest();
  const res = new MockResponse();
  const proxyReq = new MockClientRequest();
  let clearedHeartbeat = 0;

  forwardProxyRequestBody({
    req: req as unknown as http.IncomingMessage,
    res: res as unknown as http.ServerResponse,
    proxyReq: proxyReq as unknown as http.ClientRequest,
    maxBodyBytes: 4,
    onMetric: () => {},
    clearHeartbeatTimers: () => {
      clearedHeartbeat++;
    },
  });

  req.emit("data", Buffer.from("12345"));

  assert.equal(proxyReq.destroyed, true);
  assert.equal(clearedHeartbeat, 1);
  assert.equal(req.unpipedFrom[0], proxyReq);
  assert.equal(req.resumed, true);
  assert.equal(res.statusCode, 413);
  assert.equal(Buffer.concat(res.chunks).toString("utf8"), "Request Entity Too Large");
});
