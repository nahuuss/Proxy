import test from "node:test";
import assert from "node:assert/strict";
import { isPortConfigured } from "../src/lib/port-check";

test("port check detecta puertos ya configurados", () => {
  assert.equal(isPortConfigured([{ port: 3000 }, { port: 3100 }], 3100), true);
  assert.equal(isPortConfigured([{ port: 3000 }, { port: 3100 }], 3200), false);
});
