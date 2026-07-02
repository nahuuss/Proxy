import test from "node:test";
import assert from "node:assert/strict";
import type http from "http";
import type { Connector } from "../src/lib/connectors";
import { handleHeartbeatBinaryDownload } from "../src/lib/proxy-standard-download";

class MockResponse {
  headersSent = false;
  writableEnded = false;
  destroyed = false;
  chunks: Buffer[] = [];

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

function createRequest(): http.IncomingMessage {
  return {
    method: "GET",
    url: "/file",
    headers: {},
  } as http.IncomingMessage;
}

test("proxy standard download recorta binario y devuelve el buffer final", () => {
  const res = new MockResponse();
  const pdf = Buffer.concat([Buffer.from("xx"), Buffer.from([0x25, 0x50, 0x44, 0x46]), Buffer.from("resto")]);

  const finalBuffer = handleHeartbeatBinaryDownload({
    connector: createConnector(),
    req: createRequest(),
    res: res as unknown as http.ServerResponse,
    buffer: pdf,
    binaryDetection: { kind: "pdf", offset: 2 },
    incomingHost: "proxy.local",
    originalHeaders: { "content-type": "application/pdf" },
    isHtmlCommentOpen: false,
    logHB: () => {},
  });

  assert.deepEqual(finalBuffer, Buffer.from([0x25, 0x50, 0x44, 0x46, 0x72, 0x65, 0x73, 0x74, 0x6f]));
  assert.equal(res.writableEnded, true);
});
