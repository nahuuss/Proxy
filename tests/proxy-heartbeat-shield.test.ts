import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "events";
import type http from "http";
import {
  createProxyHeartbeatShieldController,
} from "../src/lib/proxy-heartbeat-shield";
import { createProxyHeartbeatState } from "../src/lib/proxy-heartbeat";

class MockResponse extends EventEmitter {
  headersSent = false;
  writableEnded = false;
  destroyed = false;
  socket = {
    setKeepAliveCalled: [] as Array<{ enabled: boolean; delay: number }>,
    setKeepAlive(enabled: boolean, delay: number) {
      this.setKeepAliveCalled.push({ enabled, delay });
    },
  };
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

function createRequest(overrides: Partial<http.IncomingMessage> = {}): http.IncomingMessage {
  return {
    method: "GET",
    url: "/home",
    headers: {},
    complete: true,
    ...overrides,
  } as http.IncomingMessage;
}

test("proxy heartbeat shield inicia modo passive-html y abre comentario html", () => {
  const state = createProxyHeartbeatState();
  const res = new MockResponse();
  const events: Array<Record<string, unknown>> = [];
  let timeoutCallback: (() => void) | undefined;
  let intervalCallback: (() => void) | undefined;
  const controller = createProxyHeartbeatShieldController({
    hbEligible: true,
    hbFirstPulseMs: 20_000,
    executionMode: "passive-html",
    isPostLike: false,
    state,
    req: createRequest(),
    res: res as unknown as http.ServerResponse,
    connectorId: "generic-1",
    incomingHost: "proxy.local",
    path: "/home",
    startTime: 1_000,
    emitStatus: (event) => {
      events.push(event);
    },
    logHB: () => {},
    logDebugEntry: () => {},
    now: () => 21_000,
    setTimeoutFn: ((callback: () => void) => {
      timeoutCallback = callback;
      return {} as any;
    }) as typeof setTimeout,
    setIntervalFn: ((callback: () => void) => {
      intervalCallback = callback;
      return {} as any;
    }) as typeof setInterval,
  });

  controller.start();
  timeoutCallback?.();
  intervalCallback?.();

  assert.equal(state.isHeartbeatActive, true);
  assert.equal(state.isHtmlCommentOpen, true);
  assert.equal(res.statusCode, 200);
  assert.equal(events[0]?.type, "heartbeat-start");
  assert.ok(Buffer.concat(res.chunks).toString("utf8").includes("BizGuard"));
});

test("proxy heartbeat shield usa keepalive para xhr y emite cierre una sola vez", () => {
  const state = createProxyHeartbeatState();
  const res = new MockResponse();
  const events: Array<Record<string, unknown>> = [];
  let timeoutCallback: (() => void) | undefined;
  let intervalCallback: (() => void) | undefined;
  const controller = createProxyHeartbeatShieldController({
    hbEligible: true,
    hbFirstPulseMs: 20_000,
    executionMode: "xhr-keepalive",
    isPostLike: true,
    state,
    req: createRequest({ method: "POST", complete: true }),
    res: res as unknown as http.ServerResponse,
    connectorId: "core-1",
    incomingHost: "core.local",
    path: "/api/report",
    startTime: 1_000,
    emitStatus: (event) => {
      events.push(event);
    },
    logHB: () => {},
    logDebugEntry: () => {},
    now: () => 21_000,
    setTimeoutFn: ((callback: () => void) => {
      timeoutCallback = callback;
      return {} as any;
    }) as typeof setTimeout,
    setIntervalFn: ((callback: () => void) => {
      intervalCallback = callback;
      return {} as any;
    }) as typeof setInterval,
  });

  controller.start();
  timeoutCallback?.();
  intervalCallback?.();
  controller.emitHeartbeatEnd(200, false);
  controller.emitHeartbeatEnd(200, false);

  assert.equal(state.isHeartbeatActive, true);
  assert.deepEqual(res.socket.setKeepAliveCalled, [{ enabled: true, delay: 15000 }]);
  assert.equal(events.filter((event) => event.type === "heartbeat-end").length, 1);
});

test("proxy heartbeat shield responde pagina de background job", () => {
  const state = createProxyHeartbeatState();
  const res = new MockResponse();
  let timeoutCallback: (() => void) | undefined;
  const controller = createProxyHeartbeatShieldController({
    hbEligible: true,
    hbFirstPulseMs: 20_000,
    executionMode: "background-job",
    isPostLike: true,
    state,
    req: createRequest({ method: "POST", url: "/upload", headers: { referer: "https://proxy.local/form" } }),
    res: res as unknown as http.ServerResponse,
    connectorId: "bank-1",
    incomingHost: "bank.local",
    path: "/upload",
    startTime: 1_000,
    emitStatus: () => {},
    logHB: () => {},
    logDebugEntry: () => {},
    now: () => 21_000,
    setTimeoutFn: ((callback: () => void) => {
      timeoutCallback = callback;
      return {} as any;
    }) as typeof setTimeout,
  });

  controller.start();
  timeoutCallback?.();

  assert.equal(res.statusCode, 200);
  const html = Buffer.concat(res.chunks).toString("utf8");
  assert.ok(html.includes("Procesando archivo"));
  assert.ok(html.includes("/__bizguard_job/"));
});

test("proxy heartbeat shield posterga el inicio si el upload post sigue incompleto", () => {
  const state = createProxyHeartbeatState();
  const res = new MockResponse();
  const scheduledCallbacks: Array<() => void> = [];
  const logMessages: string[] = [];

  const controller = createProxyHeartbeatShieldController({
    hbEligible: true,
    hbFirstPulseMs: 20_000,
    executionMode: "xhr-keepalive",
    isPostLike: true,
    state,
    req: createRequest({ method: "POST", complete: false }),
    res: res as unknown as http.ServerResponse,
    connectorId: "core-1",
    incomingHost: "core.local",
    path: "/upload",
    startTime: 1_000,
    emitStatus: () => {},
    logHB: (message) => {
      logMessages.push(message);
    },
    logDebugEntry: () => {},
    now: () => 21_000,
    setTimeoutFn: ((callback: () => void) => {
      scheduledCallbacks.push(callback);
      return {} as any;
    }) as typeof setTimeout,
  });

  controller.start();
  scheduledCallbacks[0]?.();

  assert.equal(state.isHeartbeatActive, false);
  assert.equal(scheduledCallbacks.length, 2);
  assert.ok(logMessages.some((message) => message.includes("[HB-WAIT]")));
});
