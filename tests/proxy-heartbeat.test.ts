import test from "node:test";
import assert from "node:assert/strict";
import {
  activateProxyHeartbeat,
  clearProxyHeartbeatTimers,
  completeHeartbeatJob,
  createProxyHeartbeatState,
  discardHeartbeatJob,
  failHeartbeatJob,
  releaseProxyHeartbeat,
} from "../src/lib/proxy-heartbeat";

test("proxy heartbeat crea estado inicial neutral", () => {
  const state = createProxyHeartbeatState();
  assert.equal(state.jobId, null);
  assert.equal(state.isHeartbeatActive, false);
  assert.equal(state.isHtmlCommentOpen, false);
  assert.equal(state.hbTimer, null);
  assert.equal(state.hbInterval, null);
  assert.equal(state.heartbeatEndEmitted, false);
});

test("proxy heartbeat activa y libera contador sin underflow", () => {
  const state = createProxyHeartbeatState();
  const counter = { heartbeatCount: 0 };

  activateProxyHeartbeat(state, counter);
  assert.equal(state.isHeartbeatActive, true);
  assert.equal(counter.heartbeatCount, 1);

  activateProxyHeartbeat(state, counter);
  assert.equal(counter.heartbeatCount, 1);

  releaseProxyHeartbeat(state, counter);
  assert.equal(state.isHeartbeatActive, false);
  assert.equal(counter.heartbeatCount, 0);

  releaseProxyHeartbeat(state, counter);
  assert.equal(counter.heartbeatCount, 0);
});

test("proxy heartbeat limpia timers dejando el estado reutilizable", () => {
  const state = createProxyHeartbeatState();
  state.hbTimer = setTimeout(() => {}, 1000);
  state.hbInterval = setInterval(() => {}, 1000);

  clearProxyHeartbeatTimers(state);

  assert.equal(state.hbTimer, null);
  assert.equal(state.hbInterval, null);
});

test("proxy heartbeat ignora finalize helpers sin job activo", () => {
  const state = createProxyHeartbeatState();
  discardHeartbeatJob(state);
  failHeartbeatJob(state, "boom");
  completeHeartbeatJob(state, { statusCode: 200, responseHeaders: {}, responseBody: Buffer.alloc(0) });
  assert.equal(state.jobId, null);
});
