import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { getProxySyncPayloadPath, readProxySyncPayload, writeProxySyncPayload } from "../src/lib/proxy-sync-store";

test("proxy sync store resuelve la ruta canonica dentro de data/sync.json", () => {
  const baseDir = path.join("C:", "bizguard-demo");
  assert.equal(getProxySyncPayloadPath(baseDir), path.join(baseDir, "data", "sync.json"));
});

test("proxy sync store lee payload valido y tolera archivos faltantes o invalidos", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bizguard-sync-read-"));
  const syncPath = getProxySyncPayloadPath(tempDir);

  assert.equal(readProxySyncPayload(syncPath), null);

  fs.mkdirSync(path.dirname(syncPath), { recursive: true });
  fs.writeFileSync(syncPath, "{invalid", "utf8");
  assert.equal(readProxySyncPayload(syncPath), null);

  fs.writeFileSync(syncPath, JSON.stringify({ stats: { a: 1 }, logs: [{ timestamp: "t", message: "m", type: "info" }] }), "utf8");
  assert.deepEqual(readProxySyncPayload(syncPath), {
    stats: { a: 1 },
    logs: [{ timestamp: "t", message: "m", type: "info" }],
  });
});

test("proxy sync store escribe payload atomico reutilizable por rutas y runtime", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bizguard-sync-write-"));
  const syncPath = getProxySyncPayloadPath(tempDir);
  const payload = {
    stats: { connector: { requests: 2, bytes: 10 } },
    logs: [{ timestamp: "2026-06-30T00:00:00.000Z", message: "ok", type: "system" as const }],
  };

  await writeProxySyncPayload(payload, syncPath);

  assert.deepEqual(readProxySyncPayload(syncPath), payload);
  assert.equal(fs.existsSync(`${syncPath}.tmp`), false);
});
