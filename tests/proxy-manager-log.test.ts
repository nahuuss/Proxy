import test from "node:test";
import assert from "node:assert/strict";
import {
  applyProxyManagerLog,
  buildProxyLogEntry,
} from "../src/lib/proxy-manager-log";

test("proxy manager log arma entry con timestamp, mensaje y tipo", () => {
  const entry = buildProxyLogEntry({
    message: "hola",
    type: "system",
    now: new Date("2026-07-01T10:20:30"),
  });

  assert.equal(entry.message, "hola");
  assert.equal(entry.type, "system");
  assert.equal(typeof entry.timestamp, "string");
});

test("proxy manager log actualiza buffer, marca pending y construye mensaje de consola", () => {
  const result = applyProxyManagerLog({
    recentLogs: [{ timestamp: "10:00:00", message: "previo", type: "info" }],
    logsPending: false,
    message: "nuevo",
    type: "error",
    now: new Date("2026-07-01T10:20:30"),
  });

  assert.equal(result.entry.message, "nuevo");
  assert.equal(result.entry.type, "error");
  assert.equal(result.nextState.logsPending, true);
  assert.equal(result.nextState.recentLogs.length, 2);
  assert.match(result.consoleMessage, /^\[/);
  assert.match(result.consoleMessage, /nuevo$/);
});
