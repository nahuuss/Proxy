import test from "node:test";
import assert from "node:assert/strict";
import zlib from "zlib";
import {
  decodeProxyResponseBody,
  detectBinaryPayload,
  isFileDownloadResponse,
  isTextResponse,
  trimBinaryPayload,
} from "../src/lib/proxy-response";

test("proxy response clasifica descargas y respuestas de texto", () => {
  assert.equal(isFileDownloadResponse("application/pdf", ""), true);
  assert.equal(isFileDownloadResponse("text/html", "attachment; filename=x"), true);
  assert.equal(isFileDownloadResponse("text/html", ""), false);
  assert.equal(isTextResponse("text/html", "/home"), true);
  assert.equal(isTextResponse("application/json", "/api/data"), true);
  assert.equal(isTextResponse("text/plain", "/logo.svg"), false);
});

test("proxy response descomprime gzip y deflate", () => {
  const body = Buffer.from("hola mundo", "utf8");
  assert.deepEqual(decodeProxyResponseBody(zlib.gzipSync(body), "gzip"), body);
  assert.deepEqual(decodeProxyResponseBody(zlib.deflateSync(body), "deflate"), body);
});

test("proxy response detecta y recorta firmas binarias", () => {
  const pdf = Buffer.concat([Buffer.from("noise"), Buffer.from([0x25, 0x50, 0x44, 0x46]), Buffer.from("resto")]);
  const detection = detectBinaryPayload(pdf);
  assert.deepEqual(detection, { kind: "pdf", offset: 5 });
  assert.deepEqual(trimBinaryPayload(pdf, detection), Buffer.from([0x25, 0x50, 0x44, 0x46, 0x72, 0x65, 0x73, 0x74, 0x6f]));
});

test("proxy response soporta firma PK corta para flujo NTLM", () => {
  const pk = Buffer.concat([Buffer.from("x"), Buffer.from([0x50, 0x4B]), Buffer.from("zip")]);
  assert.deepEqual(detectBinaryPayload(pk, true), { kind: "pk", offset: 1 });
});
