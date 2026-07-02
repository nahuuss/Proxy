import test from "node:test";
import assert from "node:assert/strict";
import { isLocalAdminHost, shouldBypassAdminAuth } from "../src/lib/admin-access-rules";

test("admin access considera localhost y puerto interno como bypass local", () => {
  assert.equal(isLocalAdminHost("localhost:3000"), true);
  assert.equal(isLocalAdminHost("127.0.0.1:8080"), true);
  assert.equal(isLocalAdminHost("dashboard.example.com"), false);
});

test("admin access centraliza bypass global y bypass local", () => {
  assert.equal(shouldBypassAdminAuth({ host: "dashboard.example.com", settingsBypass: true }), true);
  assert.equal(shouldBypassAdminAuth({ host: "localhost:3000", settingsBypass: false }), true);
  assert.equal(shouldBypassAdminAuth({ host: "dashboard.example.com", settingsBypass: false }), false);
});
