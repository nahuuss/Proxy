import fs from "fs";
import path from "path";
import type { ConnectorFileState } from "./logger-traffic-types";
import { buildTrafficDatePrefix } from "./logger-traffic-utils";

export function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function getOrCreateTrafficFileState(input: {
  connectorFiles: Map<string, ConnectorFileState>;
  connectorId: string;
  trafficDir: string;
}): ConnectorFileState | null {
  const existing = input.connectorFiles.get(input.connectorId);
  if (existing) return existing;

  try {
    const connectorDir = path.join(input.trafficDir, input.connectorId);
    ensureDirectory(connectorDir);

    const datePrefix = buildTrafficDatePrefix();
    const filePath = path.join(connectorDir, `${datePrefix}-1.jsonl`);
    const fd = fs.openSync(filePath, "a");
    let currentSize = 0;
    try {
      currentSize = fs.fstatSync(fd).size;
    } catch {}

    const state: ConnectorFileState = {
      fd,
      filePath,
      currentSize,
      chunkNumber: 1,
      datePrefix,
    };
    input.connectorFiles.set(input.connectorId, state);
    return state;
  } catch (error: any) {
    console.error(
      `[TRAFFIC-LOG-ERR] No se pudo abrir archivo para conector ${input.connectorId}:`,
      error.message,
    );
    return null;
  }
}

export function rotateTrafficFile(input: {
  connectorFiles: Map<string, ConnectorFileState>;
  connectorId: string;
  trafficDir: string;
  oldState: ConnectorFileState;
}) {
  try {
    fs.closeSync(input.oldState.fd);
  } catch {}

  const connectorDir = path.join(input.trafficDir, input.connectorId);
  const datePrefix = buildTrafficDatePrefix();
  const chunkNumber = input.oldState.datePrefix === datePrefix
    ? input.oldState.chunkNumber + 1
    : 1;
  const filePath = path.join(connectorDir, `${datePrefix}-${chunkNumber}.jsonl`);

  try {
    const fd = fs.openSync(filePath, "a");
    input.connectorFiles.set(input.connectorId, {
      fd,
      filePath,
      currentSize: 0,
      chunkNumber,
      datePrefix,
    });
  } catch (error: any) {
    console.error(
      `[TRAFFIC-LOG-ERR] Error al rotar archivo para conector ${input.connectorId}:`,
      error.message,
    );
    input.connectorFiles.delete(input.connectorId);
  }
}

export function closeTrafficFiles(connectorFiles: Map<string, ConnectorFileState>) {
  for (const [, state] of connectorFiles) {
    try {
      fs.closeSync(state.fd);
    } catch {}
  }
  connectorFiles.clear();
}
