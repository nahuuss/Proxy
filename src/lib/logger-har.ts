import fs from "fs";
import path from "path";
import { buildHarEntry } from "./logger-har-entry";
import type { HarEntryParams } from "./logger-har-types";

const LOGS_DIR = path.join(process.cwd(), "logs");

export function logHarEntry(
  connectorId: string,
  harEnabled: boolean | undefined,
  params: HarEntryParams,
) {
  if (!harEnabled) return;

  try {
    const connectorDir = path.join(LOGS_DIR, "har", connectorId);
    if (!fs.existsSync(connectorDir)) {
      fs.mkdirSync(connectorDir, { recursive: true });
    }

    const datePrefix = new Date().toISOString().slice(0, 10);
    const harFile = path.join(connectorDir, `${datePrefix}.jsonl`);
    const line = JSON.stringify(buildHarEntry(params)) + "\n";

    fs.appendFile(harFile, line, "utf8", (error) => {
      if (error) {
        console.error(`[HAR-LOG-ERR] Error escribiendo en ${harFile}:`, error.message);
      }
    });
  } catch (error: any) {
    console.error(`[HAR-LOG-FATAL] Excepcion en logHarEntry para ${connectorId}:`, error.message);
  }
}

export type { HarEntryParams };
