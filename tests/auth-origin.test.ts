import test from "node:test";
import assert from "node:assert/strict";
import type { Connector } from "../src/lib/connectors";
import { resolveAuthOrigin } from "../src/lib/auth-origin";

const connectors: Connector[] = [
  {
    id: "core-test",
    name: "Core Test",
    description: "",
    port: 8083,
    targetUrl: "https://coretest.serenaart.com.ar",
    publicHost: "coretest.serenaart.com.ar",
    isActive: true,
    connectorType: "core",
  },
  {
    id: "crm-test",
    name: "CRM Test",
    description: "",
    port: 8084,
    targetUrl: "http://crm.internal",
    publicHost: "crmtest.serenaart.com.ar",
    isActive: true,
    connectorType: "dynamics-crm",
  },
];

test("preserva localhost cuando el acceso local es directo", () => {
  const origin = resolveAuthOrigin({
    requestHost: "localhost:8083",
    connectors,
    fallbackAuthUrl: "http://localhost:3000",
  });

  assert.equal(origin.effectiveHost, "localhost:8083");
  assert.equal(origin.effectiveProtocol, "http");
  assert.equal(origin.isLocalRequest, true);
  assert.equal(origin.source, "request-host");
  assert.equal(origin.matchedConnector?.id, "core-test");
});

test("prioriza x-forwarded-host publico sobre el host interno del tunel", () => {
  const origin = resolveAuthOrigin({
    forwardedHost: "coretest.serenaart.com.ar",
    requestHost: "localhost:8083",
    forwardedProto: "https",
    connectors,
    fallbackAuthUrl: "http://localhost:3000",
  });

  assert.equal(origin.effectiveHost, "coretest.serenaart.com.ar");
  assert.equal(origin.effectiveProtocol, "https");
  assert.equal(origin.isLocalRequest, false);
  assert.equal(origin.source, "forwarded-host");
  assert.equal(origin.matchedConnector?.id, "core-test");
});

test("usa host publico del request cuando no hay x-forwarded-host", () => {
  const origin = resolveAuthOrigin({
    requestHost: "crmtest.serenaart.com.ar:8084",
    connectors,
    fallbackAuthUrl: "http://localhost:3000",
  });

  assert.equal(origin.effectiveHost, "crmtest.serenaart.com.ar:8084");
  assert.equal(origin.effectiveProtocol, "https");
  assert.equal(origin.isLocalRequest, false);
  assert.equal(origin.source, "request-host");
  assert.equal(origin.matchedConnector?.id, "crm-test");
});

test("cae al publicHost del conector cuando faltan headers reales", () => {
  const origin = resolveAuthOrigin({
    connectors: [connectors[0]],
    fallbackAuthUrl: "http://localhost:3000",
  });

  assert.equal(origin.effectiveHost, "coretest.serenaart.com.ar");
  assert.equal(origin.effectiveProtocol, "https");
  assert.equal(origin.source, "connector-public-host");
});

test("cae a AUTH_URL cuando no hay headers ni conectores utilizables", () => {
  const origin = resolveAuthOrigin({
    connectors: [],
    fallbackAuthUrl: "http://localhost:3000",
  });

  assert.equal(origin.effectiveHost, "localhost:3000");
  assert.equal(origin.effectiveProtocol, "http");
  assert.equal(origin.source, "auth-url");
});
