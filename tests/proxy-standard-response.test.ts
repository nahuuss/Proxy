import test from "node:test";
import assert from "node:assert/strict";
import zlib from "zlib";
import type { Connector } from "../src/lib/connectors";
import { prepareStandardProxyBuffer } from "../src/lib/proxy-standard-response";

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
    ...overrides,
  };
}

test("proxy standard response descomprime y reescribe texto", () => {
  const raw = Buffer.from('<a href="https://backend.example.com/home">ok</a>', "utf8");
  const prepared = prepareStandardProxyBuffer({
    connector: createConnector(),
    body: zlib.gzipSync(raw),
    contentEncoding: "gzip",
    contentType: "text/html",
    incomingHost: "proxy.local",
    targetUrl: new URL("https://backend.example.com/home"),
    urlPart: "/home",
    proto: "https",
  });

  assert.equal(prepared.binaryDetection, null);
  assert.equal(prepared.body.toString("utf8").includes("backend.example.com"), false);
});

test("proxy standard response detecta binarios y evita rewrite de texto", () => {
  const pdf = Buffer.concat([Buffer.from("x"), Buffer.from([0x25, 0x50, 0x44, 0x46]), Buffer.from("resto")]);
  const prepared = prepareStandardProxyBuffer({
    connector: createConnector(),
    body: pdf,
    contentEncoding: "",
    contentType: "application/pdf",
    incomingHost: "proxy.local",
    targetUrl: new URL("https://backend.example.com/file"),
    urlPart: "/file",
    proto: "https",
    allowShortPk: true,
  });

  assert.deepEqual(prepared.binaryDetection, { kind: "pdf", offset: 1 });
  assert.deepEqual(prepared.body, pdf);
});
