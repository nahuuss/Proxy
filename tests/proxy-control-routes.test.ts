import assert from "node:assert/strict";
import { EventEmitter } from "events";
import http from "http";
import test from "node:test";
import { deleteBgJob, getBgJob, setBgJob } from "../src/lib/background-job-store";
import { handleProxyControlRoute } from "../src/lib/proxy-control-routes";

class MockRequest extends EventEmitter {
  url = "/";
}

class MockResponse extends EventEmitter {
  destroyed = false;
  headersSent = false;
  writableEnded = false;
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
    if (chunk) {
      this.write(chunk);
    }
    this.writableEnded = true;
    this.emit("finish");
    return this;
  }
}

test("proxy control routes atiende el stream de estado y filtra por clientId", () => {
  const req = new MockRequest();
  req.url = "/__bizguard_status/stream?clientId=client-1";
  const res = new MockResponse();
  const statusEvents = new EventEmitter();

  const handled = handleProxyControlRoute({
    req: req as unknown as http.IncomingMessage,
    res: res as unknown as http.ServerResponse,
    statusEvents,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers?.["Content-Type"], "text/event-stream");
  assert.match(Buffer.concat(res.chunks).toString("utf8"), /: open/);

  statusEvents.emit("status", { clientId: "other", kind: "skip" });
  statusEvents.emit("status", { clientId: "client-1", kind: "ok" });

  const payload = Buffer.concat(res.chunks).toString("utf8");
  assert.doesNotMatch(payload, /"skip"/);
  assert.match(payload, /"ok"/);

  req.emit("close");
  assert.equal(statusEvents.listenerCount("status"), 0);
});

test("proxy control routes devuelve 404 si el background job no existe", () => {
  const res = new MockResponse();

  const handled = handleProxyControlRoute({
    req: Object.assign(new MockRequest(), {
      url: "/__bizguard_job/missing/status",
    }) as unknown as http.IncomingMessage,
    res: res as unknown as http.ServerResponse,
    statusEvents: new EventEmitter(),
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 404);
  assert.match(Buffer.concat(res.chunks).toString("utf8"), /Job no encontrado o expirado/);
});

test("proxy control routes expone status y resultado del background job y libera memoria", () => {
  const jobId = "job-done-test";
  setBgJob(jobId, {
    status: "done",
    startedAt: Date.now() - 3_000,
    connectorId: "connector-1",
    method: "POST",
    path: "/upload",
    statusCode: 200,
    responseHeaders: {
      "content-type": "application/pdf",
      "set-cookie": ["a=b"],
      "x-internal-header": "must-not-leak",
    },
    responseBody: Buffer.from("pdf-data"),
  });

  const statusRes = new MockResponse();
  const statusHandled = handleProxyControlRoute({
    req: Object.assign(new MockRequest(), {
      url: `/__bizguard_job/${jobId}/status`,
    }) as unknown as http.IncomingMessage,
    res: statusRes as unknown as http.ServerResponse,
    statusEvents: new EventEmitter(),
  });

  assert.equal(statusHandled, true);
  assert.equal(statusRes.statusCode, 200);
  assert.match(Buffer.concat(statusRes.chunks).toString("utf8"), /"status":"done"/);

  const resultRes = new MockResponse();
  const resultHandled = handleProxyControlRoute({
    req: Object.assign(new MockRequest(), {
      url: `/__bizguard_job/${jobId}/result`,
    }) as unknown as http.IncomingMessage,
    res: resultRes as unknown as http.ServerResponse,
    statusEvents: new EventEmitter(),
  });

  assert.equal(resultHandled, true);
  assert.equal(resultRes.statusCode, 200);
  assert.equal(resultRes.headers?.["content-type"], "application/pdf");
  assert.equal(resultRes.headers?.["content-length"], String(Buffer.byteLength("pdf-data")));
  assert.equal(resultRes.headers?.["x-internal-header"], undefined);
  assert.equal(Buffer.concat(resultRes.chunks).toString("utf8"), "pdf-data");
  assert.equal(getBgJob(jobId), undefined);
  deleteBgJob(jobId);
});

test("proxy control routes devuelve 202 cuando el resultado del job aun no esta listo", () => {
  const jobId = "job-pending-test";
  setBgJob(jobId, {
    status: "pending",
    startedAt: Date.now(),
    connectorId: "connector-1",
    method: "POST",
    path: "/upload",
  });

  const res = new MockResponse();
  const handled = handleProxyControlRoute({
    req: Object.assign(new MockRequest(), {
      url: `/__bizguard_job/${jobId}/result`,
    }) as unknown as http.IncomingMessage,
    res: res as unknown as http.ServerResponse,
    statusEvents: new EventEmitter(),
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 202);
  assert.match(Buffer.concat(res.chunks).toString("utf8"), /"status":"pending"/);
  deleteBgJob(jobId);
});
