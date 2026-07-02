import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAuthCallbackUrl,
  buildAuthRedirectProxyUrl,
  resolveAuthRedirectTarget,
  resolveCookieDomain,
} from "../src/lib/auth-runtime";

test("auth runtime resuelve cookie domain solo para hosts publicos", () => {
  assert.equal(resolveCookieDomain("core.example.com"), ".example.com");
  assert.equal(resolveCookieDomain("portal.example.com.ar"), ".example.com.ar");
  assert.equal(resolveCookieDomain("localhost:3000"), undefined);
});

test("auth runtime arma urls de callback y proxy con host dinamico", () => {
  assert.equal(
    buildAuthCallbackUrl({ fullHost: "core.example.com", protocol: "https" }),
    "https://core.example.com/api/auth/callback/microsoft-entra-id",
  );
  assert.equal(
    buildAuthRedirectProxyUrl({ fullHost: "core.example.com", protocol: "https" }),
    "https://core.example.com/api/auth",
  );
  assert.equal(
    buildAuthRedirectProxyUrl({ fallbackAuthUrl: "http://localhost:3000" }),
    "http://localhost:3000/api/auth",
  );
});

test("auth runtime reescribe redirects internos hacia el host publico", () => {
  const result = resolveAuthRedirectTarget({
    url: "http://localhost:3000/api/auth/callback/microsoft-entra-id?code=1",
    baseUrl: "http://localhost:3000",
    fullHost: "core.example.com",
    protocol: "https",
    isLocalRequest: false,
  });

  assert.equal(result, "https://core.example.com/api/auth/callback/microsoft-entra-id?code=1");
});

test("auth runtime conserva redirects relativos y locales cuando corresponde", () => {
  assert.equal(
    resolveAuthRedirectTarget({
      url: "/login",
      baseUrl: "http://localhost:3000",
      fullHost: "core.example.com",
      protocol: "https",
      isLocalRequest: false,
    }),
    "https://core.example.com/login",
  );

  assert.equal(
    resolveAuthRedirectTarget({
      url: "http://localhost:3000/panel",
      baseUrl: "http://localhost:3000",
      fullHost: "localhost:3000",
      protocol: "http",
      isLocalRequest: true,
    }),
    "http://localhost:3000/panel",
  );
});
