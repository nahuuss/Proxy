import test from "node:test";
import assert from "node:assert/strict";
import {
  RateLimiter,
  RATE_LIMIT_WINDOW_MS,
  resolveRequestClientIp,
} from "../src/lib/proxy-rate-limit";

test("proxy rate limit bloquea cuando supera la ventana configurada", () => {
  let now = 1_000;
  const limiter = new RateLimiter(2, {
    getNow: () => now,
    cleanupIntervalMs: RATE_LIMIT_WINDOW_MS * 10,
  });

  assert.equal(limiter.check("1.1.1.1"), true);
  assert.equal(limiter.check("1.1.1.1"), true);
  assert.equal(limiter.check("1.1.1.1"), false);

  now += RATE_LIMIT_WINDOW_MS + 1;
  assert.equal(limiter.check("1.1.1.1"), true);
});

test("proxy rate limit prioriza cf-connecting-ip y luego x-forwarded-for", () => {
  assert.equal(
    resolveRequestClientIp(
      {
        "cf-connecting-ip": "203.0.113.10",
        "x-forwarded-for": "198.51.100.2, 10.0.0.1",
      },
      "127.0.0.1",
    ),
    "203.0.113.10",
  );

  assert.equal(
    resolveRequestClientIp(
      {
        "x-forwarded-for": "198.51.100.2, 10.0.0.1",
      },
      "127.0.0.1",
    ),
    "198.51.100.2",
  );

  assert.equal(resolveRequestClientIp({}, "127.0.0.1"), "127.0.0.1");
});
