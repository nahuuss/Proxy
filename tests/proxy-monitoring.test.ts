import test from "node:test";
import assert from "node:assert/strict";
import {
  applyConnectorPingToStats,
  buildConnectorPingCandidates,
  probeConnectorTarget,
} from "../src/lib/proxy-monitoring";

test("proxy monitoring arma candidatos correctos para target con y sin protocolo", () => {
  assert.deepEqual(buildConnectorPingCandidates("https://core.example.com"), ["https://core.example.com"]);
  assert.deepEqual(buildConnectorPingCandidates("core.example.com"), [
    "https://core.example.com",
    "http://core.example.com",
  ]);
});

test("proxy monitoring conserva fallback http cuando https falla", async () => {
  const calls: string[] = [];
  const result = await probeConnectorTarget("core.example.com", async (url) => {
    calls.push(url);
    if (url.startsWith("https://")) {
      return { online: false, detail: "timeout" };
    }
    return { online: true, detail: "status=200" };
  });

  assert.deepEqual(calls, ["https://core.example.com", "http://core.example.com"]);
  assert.equal(result.online, true);
  assert.match(result.detail, /https:timeout/);
  assert.match(result.detail, /http:status=200/);
});

test("proxy monitoring aplica resultado de ping al snapshot del conector", () => {
  const nextStats = applyConnectorPingToStats(
    { requests: 10, bytes: 1000, latency: 50 },
    { online: false, latency: 1234 },
  );

  assert.deepEqual(nextStats, {
    requests: 10,
    bytes: 1000,
    latency: 50,
    activePing: -1,
    isOnline: false,
  });
});
