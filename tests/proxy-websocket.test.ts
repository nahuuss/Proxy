import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWebSocketProxyRequest,
  buildWebSocketUpgradeFailureResponse,
  describeWebSocketProxyConnection,
  describeWebSocketProxyError,
  isExpectedWebSocketBackendClose,
  resolveWebSocketBackendTarget,
} from "../src/lib/proxy-websocket";

test("proxy websocket resuelve host y puerto backend segun protocolo", () => {
  assert.deepEqual(
    resolveWebSocketBackendTarget(new URL("https://backend.example.com")),
    { isHttps: true, targetHost: "backend.example.com", targetPort: 443 },
  );

  assert.deepEqual(
    resolveWebSocketBackendTarget(new URL("http://backend.example.com:8081")),
    { isHttps: false, targetHost: "backend.example.com", targetPort: 8081 },
  );
});

test("proxy websocket arma headers forward y payload de upgrade", () => {
  const request = buildWebSocketProxyRequest({
    method: "GET",
    normalizedRequestUrl: "/ORG/main.aspx?id=1",
    requestHeaders: {
      host: "crm.example.com",
      upgrade: "websocket",
      connection: "Upgrade",
      "cf-ray": "ignored",
      "x-forwarded-for": "198.51.100.2, 10.0.0.1",
    },
    hostHeader: "crm.example.com",
    remoteAddress: "127.0.0.1",
    targetUrl: new URL("https://backend.example.com"),
    isLocalHost: false,
  });

  assert.equal(request.forwardedHeaders.host, "backend.example.com");
  assert.equal(request.forwardedHeaders["x-forwarded-host"], "crm.example.com");
  assert.equal(request.forwardedHeaders["x-forwarded-proto"], "https");
  assert.equal(request.forwardedHeaders["x-forwarded-for"], "198.51.100.2");
  assert.equal(request.forwardedHeaders["cf-ray"], undefined);
  assert.match(request.requestPayload, /^GET \/ORG\/main\.aspx\?id=1 HTTP\/1\.1\r\n/m);
  assert.match(request.requestPayload, /host: backend\.example\.com\r\n/i);
});

test("proxy websocket expone respuestas de fallo y cierres esperados", () => {
  assert.equal(
    buildWebSocketUpgradeFailureResponse(401),
    "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n",
  );
  assert.equal(
    buildWebSocketUpgradeFailureResponse(502),
    "HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n",
  );
  assert.equal(isExpectedWebSocketBackendClose("ECONNRESET"), true);
  assert.equal(isExpectedWebSocketBackendClose("SOMETHING_ELSE"), false);
});

test("proxy websocket formatea logs de conexion y error", () => {
  assert.equal(
    describeWebSocketProxyConnection({ id: "crm-1" }, "/ORG/main.aspx"),
    "[WS-PROXY] Conectado: /ORG/main.aspx -> crm-1",
  );
  assert.equal(
    describeWebSocketProxyError({ id: "crm-1" }, "boom"),
    "[WS-PROXY] Error backend: boom (crm-1)",
  );
});
