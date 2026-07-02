import test from "node:test";
import assert from "node:assert/strict";
import { renderPassiveHeartbeatShell } from "../src/lib/proxy-heartbeat-view";

test("proxy heartbeat view renderiza shell HTML con tiempo inicial y comentario abierto", () => {
  const html = renderPassiveHeartbeatShell({ elapsedSeconds: 125 });

  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(html.includes("Procesando archivo"));
  assert.ok(html.includes(">02:05<"));
  assert.ok(html.includes("var _s=125"));
  assert.ok(html.endsWith("<!--"));
});
