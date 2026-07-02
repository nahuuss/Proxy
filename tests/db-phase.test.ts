import test from "node:test";
import assert from "node:assert/strict";
import { isBuildPhase, isTestPhase } from "../src/lib/db";

test("db detecta fase de test bajo node --test", () => {
  assert.equal(isTestPhase(), true);
});

test("db no se considera build phase durante la suite de tests", () => {
  assert.equal(isBuildPhase(), false);
});
