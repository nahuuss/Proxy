import test from "node:test";
import assert from "node:assert/strict";
import {
  PROXY_SESSION_COOKIE_NAMES,
  hasKnownProxySessionCookie,
  verifyProxySession,
} from "../src/lib/proxy-session";

test("proxy session detecta cookies conocidas aunque haya varias", () => {
  assert.equal(
    hasKnownProxySessionCookie(`foo=1; ${PROXY_SESSION_COOKIE_NAMES[0]}=abc; bar=2`),
    true,
  );
  assert.equal(hasKnownProxySessionCookie("foo=1; bar=2"), false);
});

test("proxy session valida el primer token no expirado", async () => {
  const payload = await verifyProxySession(
    `${PROXY_SESSION_COOKIE_NAMES[0]}=expired; ${PROXY_SESSION_COOKIE_NAMES[1]}=valid`,
    {
      secret: "test-secret",
      nowMs: 1_700_000_000_000,
      decodeToken: async ({ token }) => {
        if (token === "expired") return { exp: 1_699_999_999 };
        if (token === "valid") return { exp: 1_700_000_100, sub: "user-1" };
        return null;
      },
    },
  );

  assert.deepEqual(payload, { exp: 1_700_000_100, sub: "user-1" });
});

test("proxy session ignora errores de decode y retorna null si no encuentra token valido", async () => {
  const payload = await verifyProxySession(
    `${PROXY_SESSION_COOKIE_NAMES[0]}=boom`,
    {
      secret: "test-secret",
      nowMs: 1_700_000_000_000,
      decodeToken: async () => {
        throw new Error("decode failed");
      },
    },
  );

  assert.equal(payload, null);
});
