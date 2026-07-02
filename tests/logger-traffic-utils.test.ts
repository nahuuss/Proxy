import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTrafficDatePrefix,
  calculateTrafficRetentionMs,
  extractCookieNames,
  sanitizeFolderName,
} from "../src/lib/logger-traffic-utils";

test("logger traffic utils extrae nombres de cookies", () => {
  assert.deepEqual(
    extractCookieNames("sid=123; csrftoken=abc; theme=dark"),
    ["sid", "csrftoken", "theme"],
  );
});

test("logger traffic utils sanea nombre de carpeta", () => {
  assert.equal(
    sanitizeFolderName("CRM/Serena Art@prod:8080"),
    "crm_serena_art_prod_8080",
  );
});

test("logger traffic utils calcula retencion y usa default ante unidad invalida", () => {
  assert.equal(calculateTrafficRetentionMs(2, "hours"), 2 * 60 * 60 * 1000);
  assert.equal(calculateTrafficRetentionMs(1, "invalid"), 5 * 60 * 60 * 1000);
});

test("logger traffic utils arma date prefix estable", () => {
  const prefix = buildTrafficDatePrefix(new Date(2026, 6, 1, 9, 5, 0));
  assert.equal(prefix, "2026-07-01_0905");
});
