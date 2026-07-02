import test from "node:test";
import assert from "node:assert/strict";
import { buildProxyDebugEntry, buildProxyTrafficEntry } from "../src/lib/proxy-traffic";

test("proxy traffic arma debug entry con path saneado", () => {
  const entry = buildProxyDebugEntry({
    connectorId: "crm-1",
    username: "ana",
    method: "GET",
    requestUrl: "/main.aspx?id=1",
    tag: "[REQUEST-IN]",
    elapsedMs: 120,
  });

  assert.equal(entry.conn, "crm-1");
  assert.equal(entry.path, "/main.aspx");
  assert.equal(entry.user, "ana");
});

test("proxy traffic arma traffic entry con cookies y headers", () => {
  const entry = buildProxyTrafficEntry({
    startTime: Date.parse("2026-06-30T00:00:00.000Z"),
    connectorId: "core-1",
    username: "serena",
    method: "POST",
    requestUrl: "/LoginExterno.aspx?x=1",
    requestHeaders: { cookie: "a=1; b=2" },
    isAjax: true,
    elapsed: 300,
    ttfb: 40,
    status: 200,
    reqSize: 10,
    resSize: 20,
    resHeaders: { "content-type": "application/json" },
  });

  assert.equal(entry.conn, "core-1");
  assert.equal(entry.url, "/LoginExterno.aspx?x=1");
  assert.deepEqual(entry.cookies, ["a", "b"]);
  assert.equal(entry.ct, "application/json");
  assert.equal(entry.xhr, true);
});
