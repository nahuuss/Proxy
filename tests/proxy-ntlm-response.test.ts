import test from "node:test";
import assert from "node:assert/strict";
import zlib from "zlib";
import { prepareNtlmForwardResponse } from "../src/lib/proxy-ntlm-response";
import type { Connector } from "../src/lib/connectors";

function createConnector(overrides: Partial<Connector> = {}): Connector {
  return {
    id: "generic-1",
    name: "Generic",
    description: "",
    port: 3001,
    targetUrl: "https://backend.example.com",
    publicHost: "localhost:3001",
    isActive: true,
    connectorType: "generic",
    productConfig: { generic: {} },
    ...overrides,
  };
}

test("proxy ntlm response descomprime y limpia headers de transporte", () => {
  const body = zlib.gzipSync(Buffer.from("<html>ok</html>", "utf8"));
  const prepared = prepareNtlmForwardResponse({
    connector: createConnector(),
    responseHeaders: {
      "content-type": "text/html; charset=utf-8",
      "content-encoding": "gzip",
      "content-length": String(body.length),
      "transfer-encoding": "chunked",
    },
    responseBody: body,
    targetUrl: new URL("https://backend.example.com/app"),
    incomingHost: "proxy.local",
    urlPart: "/app",
    proto: "https",
  });

  assert.equal(prepared.body.toString("utf8"), "<html>ok</html>");
  assert.equal(prepared.headers["content-encoding"], undefined);
  assert.equal(prepared.headers["content-length"], undefined);
  assert.equal(prepared.headers["transfer-encoding"], undefined);
});

test("proxy ntlm response detecta descargas por content-disposition", () => {
  const prepared = prepareNtlmForwardResponse({
    connector: createConnector(),
    responseHeaders: {
      "content-type": "text/html",
      "content-disposition": "attachment; filename=reporte.xls",
    },
    responseBody: Buffer.from("bin", "utf8"),
    targetUrl: new URL("https://backend.example.com/app"),
    incomingHost: "proxy.local",
    urlPart: "/app",
    proto: "https",
  });

  assert.equal(prepared.isFileDownload, true);
});
