import fs from "fs";
import { promises as fsPromises } from "fs";
import path from "path";
import type { ProxySyncPayload } from "./proxy-observability";

export function getProxySyncPayloadPath(baseDir = process.cwd()): string {
  return path.join(baseDir, "data", "sync.json");
}

export function readProxySyncPayload(filePath = getProxySyncPayloadPath()): ProxySyncPayload | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== "object") {
      return null;
    }

    return payload as ProxySyncPayload;
  } catch {
    return null;
  }
}

export async function writeProxySyncPayload(
  payload: ProxySyncPayload,
  filePath = getProxySyncPayloadPath(),
): Promise<void> {
  const directory = path.dirname(filePath);
  const tempPath = `${filePath}.tmp`;

  await fsPromises.mkdir(directory, { recursive: true });
  await fsPromises.writeFile(tempPath, JSON.stringify(payload), "utf8");
  await fsPromises.rename(tempPath, filePath);
}
