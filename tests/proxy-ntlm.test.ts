import test from "node:test";
import assert from "node:assert/strict";
import { buildCrmNtlmRequestHeaders, createCoreNtlmRequestOptions, createCrmNtlmAgent, createCrmNtlmRequestOptions, resolveNtlmMethod } from "../src/lib/proxy-ntlm";

test("proxy ntlm resuelve el metodo correcto con fallback a get", () => {
  const get = () => {};
  const post = () => {};
  assert.equal(resolveNtlmMethod({ get, post }, "POST"), post);
  assert.equal(resolveNtlmMethod({ get }, "PATCH"), get);
});

test("proxy ntlm arma request options canonicas para core y crm", () => {
  const agent = createCrmNtlmAgent({ strictTls: true }, "https:");
  const core = createCoreNtlmRequestOptions({
    username: "ana",
    password: "secret",
    domain: "SERENA",
    validationUrl: "https://core.example.com/LoginExterno.aspx",
    body: Buffer.from("x"),
    headers: { accept: "text/html" },
    agent,
  });
  const crm = createCrmNtlmRequestOptions({
    username: "ana",
    password: "secret",
    domain: "SERENA",
    targetUrl: "https://crm.example.com/main.aspx",
    body: Buffer.from("y"),
    headers: { accept: "text/html" },
    agent,
  });

  assert.equal(core.url.includes("LoginExterno.aspx"), true);
  assert.equal(crm.url.includes("main.aspx"), true);
  assert.equal(core.binary, true);
  assert.equal(crm.binary, true);
});

test("proxy ntlm normaliza headers serializables para httpntlm", () => {
  const headers = buildCrmNtlmRequestHeaders({
    accept: "text/html",
    cookie: ["a=1", "b=2"],
  }, 25);

  assert.deepEqual(headers, {
    accept: "text/html",
    cookie: "a=1, b=2",
    "content-length": "25",
  });
});
