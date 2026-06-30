import test from "node:test";
import assert from "node:assert/strict";

import { rewriteDynamicsCrmClientConfig } from "../src/lib/dynamics-crm.ts";

test("dynamics crm reescribe variables cliente e inyecta shim de lookup", () => {
  const html = [
    "<html><body>",
    "<script>",
    "var SERVER_URL = 'http\\x3a\\x2f\\x2finterno\\x3a5555\\x2fARTTesting';",
    "var WEB_SERVER_HOST = 'interno';",
    "var WEB_SERVER_PORT = 5555;",
    "</script>",
    "<a class=\"ms-crm-List-Link\" onclick=\"handleLookupAnchorClick(new Sys.UI.DomEvent(event))\">",
    "<span class=\"gridLui\" oid=\"{ABC}\" otype=\"1\"></span>",
    "</a>",
    "</body></html>",
  ].join("");

  const rewritten = rewriteDynamicsCrmClientConfig(html, "localhost:8083", "http", "/ARTTesting");

  assert.match(rewritten, /var SERVER_URL = 'http\\x3a\\x2f\\x2flocalhost\\x3a8083\\x2fARTTesting';/);
  assert.match(rewritten, /var WEB_SERVER_HOST = 'localhost';/);
  assert.match(rewritten, /var WEB_SERVER_PORT = 8083;/);
  assert.match(rewritten, /bizguard-dynamics-crm-lookup-shim/);
  assert.match(rewritten, /\/main\.aspx\?etc=/);
});

test("dynamics crm no inyecta shim dentro de assets javascript", () => {
  const scriptBody = [
    "var SERVER_URL = 'http\\x3a\\x2f\\x2finterno\\x3a5555\\x2fARTTesting';",
    "var WEB_SERVER_HOST = 'interno';",
    "var WEB_SERVER_PORT = 5555;",
    "Type.registerNamespace('Mscrm');",
  ].join("\n");

  const rewritten = rewriteDynamicsCrmClientConfig(scriptBody, "localhost:8083", "http", "/ARTTesting");

  assert.match(rewritten, /var SERVER_URL = 'http\\x3a\\x2f\\x2flocalhost\\x3a8083\\x2fARTTesting';/);
  assert.doesNotMatch(rewritten, /bizguard-dynamics-crm-lookup-shim/);
  assert.doesNotMatch(rewritten, /<script id="bizguard-dynamics-crm-lookup-shim">/);
});

test("dynamics crm no inyecta shim en html sin lookup grid", () => {
  const html = [
    "<html><body>",
    "<script>",
    "var SERVER_URL = 'http\\x3a\\x2f\\x2finterno\\x3a5555\\x2fARTTesting';",
    "var WEB_SERVER_HOST = 'interno';",
    "var WEB_SERVER_PORT = 5555;",
    "</script>",
    "<div>Dashboard shell</div>",
    "</body></html>",
  ].join("");

  const rewritten = rewriteDynamicsCrmClientConfig(html, "localhost:8083", "http", "/ARTTesting");

  assert.doesNotMatch(rewritten, /bizguard-dynamics-crm-lookup-shim/);
});
