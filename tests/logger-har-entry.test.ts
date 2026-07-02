import assert from "node:assert/strict";
import http from "http";
import test from "node:test";
import { buildHarEntry } from "../src/lib/logger-har-entry";
import {
  parseHarHeaders,
  parseHarQueryString,
  parseHarRequestCookies,
  parseHarResponseCookies,
} from "../src/lib/logger-har-parsers";

function createRequest(url = "/home?foo=1&bar=2"): http.IncomingMessage {
  return {
    method: "POST",
    url,
    headers: {
      cookie: "sid=123; theme=dark",
      "content-type": "application/json",
      accept: "application/json",
    },
  } as http.IncomingMessage;
}

test("logger har parsers transforman cookies, headers y query string", () => {
  assert.deepEqual(parseHarRequestCookies("sid=123; theme=dark"), [
    { name: "sid", value: "123" },
    { name: "theme", value: "dark" },
  ]);
  assert.deepEqual(parseHarResponseCookies(["token=abc; Path=/", "lang=es; HttpOnly"]), [
    { name: "token", value: "abc" },
    { name: "lang", value: "es" },
  ]);
  assert.deepEqual(parseHarQueryString("/home?foo=1&bar=2"), [
    { name: "foo", value: "1" },
    { name: "bar", value: "2" },
  ]);
  assert.deepEqual(parseHarHeaders({ accept: "application/json", "x-test": ["a", "b"] }), [
    { name: "accept", value: "application/json" },
    { name: "x-test", value: "a" },
    { name: "x-test", value: "b" },
  ]);
});

test("logger har entry arma request y response con cuerpos textuales", () => {
  const entry = buildHarEntry({
    startTime: Date.now() - 20,
    elapsedMs: 20,
    req: createRequest(),
    reqBody: Buffer.from('{"ok":true}'),
    resStatusCode: 200,
    resHeaders: {
      "content-type": "application/json",
      "set-cookie": ["token=abc; Path=/"],
      location: "/next",
    },
    resBody: Buffer.from('{"done":true}'),
    username: "ana",
  });

  assert.equal(entry._username, "ana");
  assert.equal(entry.request.method, "POST");
  assert.equal(entry.request.postData?.mimeType, "application/json");
  assert.equal(entry.request.postData?.text, '{"ok":true}');
  assert.equal(entry.response.status, 200);
  assert.equal(entry.response.content.text, '{"done":true}');
  assert.equal(entry.response.redirectURL, "/next");
  assert.deepEqual(entry.response.cookies, [{ name: "token", value: "abc" }]);
});

test("logger har entry respeta override de tamano binario sin guardar texto", () => {
  const entry = buildHarEntry({
    startTime: Date.now() - 10,
    elapsedMs: 10,
    req: createRequest("/file.pdf"),
    resStatusCode: 200,
    resHeaders: { "content-type": "application/pdf" },
    overrideResBodySize: 2048,
  });

  assert.equal(entry.response.content.size, 2048);
  assert.equal("text" in entry.response.content, false);
  assert.equal(entry.response.bodySize, 2048);
});
