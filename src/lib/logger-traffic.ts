import fs from "fs";
import path from "path";
import { cleanupTrafficLogDirectories } from "./logger-traffic-cleanup";
import {
  closeTrafficFiles,
  ensureDirectory,
  getOrCreateTrafficFileState,
  rotateTrafficFile,
} from "./logger-traffic-files";
import type {
  ConnectorFileState,
  DebugEntry,
  LogEntry,
  TrafficEntry,
} from "./logger-traffic-types";
import { extractCookieNames, sanitizeFolderName } from "./logger-traffic-utils";

const LOGS_ROOT = path.join(process.cwd(), "logs");
const TRAFFIC_DIR = path.join(LOGS_ROOT, "traffic");
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

class TrafficLogger {
  private connectorFiles = new Map<string, ConnectorFileState>();
  private dirEnsured = false;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  log(entry: LogEntry): void {
    if (!entry.conn) return;

    try {
      this.ensureBaseDir();
      const connectorId = sanitizeFolderName(entry.conn);
      const buffer = Buffer.from(`${JSON.stringify(entry)}\n`, "utf8");

      const state = getOrCreateTrafficFileState({
        connectorFiles: this.connectorFiles,
        connectorId,
        trafficDir: TRAFFIC_DIR,
      });
      if (!state) return;

      if (state.currentSize + buffer.length > MAX_FILE_SIZE) {
        rotateTrafficFile({
          connectorFiles: this.connectorFiles,
          connectorId,
          trafficDir: TRAFFIC_DIR,
          oldState: state,
        });
      }

      const currentState = this.connectorFiles.get(connectorId);
      if (!currentState) return;

      fs.write(currentState.fd, buffer, 0, buffer.length, null, (error) => {
        if (error) {
          console.error(`[TRAFFIC-LOG-ERR] Error escribiendo para conector ${connectorId}:`, error.message);
          try {
            fs.closeSync(currentState.fd);
          } catch {}
          this.connectorFiles.delete(connectorId);
        } else {
          currentState.currentSize += buffer.length;
        }
      });
    } catch (error: any) {
      console.error("[TRAFFIC-LOG-FATAL] Excepcion en log():", error.message);
    }
  }

  private ensureBaseDir(): void {
    if (this.dirEnsured) return;
    ensureDirectory(TRAFFIC_DIR);
    this.dirEnsured = true;
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      void cleanupTrafficLogDirectories({
        logsRoot: LOGS_ROOT,
        connectorFiles: this.connectorFiles,
      });
    }, CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  shutdown(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    closeTrafficFiles(this.connectorFiles);
  }
}

const globalForTraffic = globalThis as typeof globalThis & { _trafficLogger?: TrafficLogger };
if (!globalForTraffic._trafficLogger) {
  globalForTraffic._trafficLogger = new TrafficLogger();
}

export const trafficLogger = globalForTraffic._trafficLogger;
export { extractCookieNames };
export type { DebugEntry, LogEntry, TrafficEntry };
