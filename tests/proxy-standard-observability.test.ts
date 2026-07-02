import test from "node:test";
import assert from "node:assert/strict";
import type http from "http";
import type { Connector } from "../src/lib/connectors";
import { logProxyOutcome } from "../src/lib/proxy-standard-observability";

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

test("proxy standard observability tolera conectores sin logs activos", () => {
  let trafficCalls = 0;
  logProxyOutcome({
    connector: createConnector(),
    req: createRequest(),
    startTime: Date.now() - 5,
    requestBody: Buffer.from("req"),
    responseStatusCode: 200,
    responseHeaders: { "content-type": "text/plain" },
    responseBody: Buffer.from("ok"),
    username: "ana",
    elapsedMs: 5,
    buildTrafficEntry: () => {
      trafficCalls += 1;
      return null;
    },
  });

  assert.equal(trafficCalls, 0);
});

test("proxy standard observability construye trafico cuando esta activo", () => {
  let payload: unknown = null;
  logProxyOutcome({
    connector: createConnector({ trafficLog: true }),
    req: createRequest(),
    startTime: Date.now() - 5,
    requestBody: Buffer.from("req"),
    responseStatusCode: 302,
    responseHeaders: { location: "/next" },
    responseBody: "",
    username: "ana",
    elapsedMs: 5,
    ttfbMs: 2,
    buildTrafficEntry: (input) => {
      payload = input;
      return null;
    },
  });

  assert.deepEqual(payload, {
    elapsed: 5,
    ttfb: 2,
    status: 302,
    reqSize: 3,
    resSize: 0,
    resHeaders: { location: "/next" },
  });
});
