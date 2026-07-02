import test from "node:test";
import assert from "node:assert/strict";
import { getAuthAuthorizedDecision, isProxyProtectedPath } from "../src/lib/auth-access-rules";

test("auth access identifica rutas proxy protegidas", () => {
  assert.equal(isProxyProtectedPath("/"), true);
  assert.equal(isProxyProtectedPath("/proxy/test"), true);
  assert.equal(isProxyProtectedPath("/login"), false);
});

test("auth access prioriza bypasses explicitos", () => {
  assert.deepEqual(
    getAuthAuthorizedDecision({
      host: "localhost:3000",
      pathname: "/",
      isLoggedIn: false,
      settingsBypass: false,
      connectorBypass: false,
    }),
    { allow: true, reason: "localhost-bypass" },
  );

  assert.deepEqual(
    getAuthAuthorizedDecision({
      host: "proxy.example.com",
      pathname: "/",
      isLoggedIn: false,
      settingsBypass: false,
      connectorBypass: true,
    }),
    { allow: true, reason: "connector-bypass" },
  );
});

test("auth access exige login solo en rutas proxy cuando no hay bypass", () => {
  assert.deepEqual(
    getAuthAuthorizedDecision({
      host: "proxy.example.com",
      pathname: "/",
      isLoggedIn: false,
      settingsBypass: false,
      connectorBypass: false,
    }),
    { allow: false, reason: "proxy-route-deny" },
  );

  assert.deepEqual(
    getAuthAuthorizedDecision({
      host: "proxy.example.com",
      pathname: "/config",
      isLoggedIn: false,
      settingsBypass: false,
      connectorBypass: false,
    }),
    { allow: true, reason: "non-proxy-route-allow" },
  );
});
