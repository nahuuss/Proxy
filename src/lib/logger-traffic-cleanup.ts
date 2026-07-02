import fs from "fs";
import path from "path";
import type { ConnectorFileState } from "./logger-traffic-types";
import { calculateTrafficRetentionMs } from "./logger-traffic-utils";

export async function cleanupTrafficLogDirectories(input: {
  logsRoot: string;
  connectorFiles: Map<string, ConnectorFileState>;
}) {
  try {
    const { getConnectors } = await import("./connectors");
    const connectors = await getConnectors();
    const connectorMap = new Map(connectors.map((connector) => [connector.id, connector]));
    const logTypes = ["traffic", "har", "hb", "sso"];

    for (const logType of logTypes) {
      const logTypeDir = path.join(input.logsRoot, logType);
      if (!fs.existsSync(logTypeDir)) continue;

      const connectorDirs = fs.readdirSync(logTypeDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory());

      for (const dirent of connectorDirs) {
        const connectorId = dirent.name;
        const connectorDirPath = path.join(logTypeDir, connectorId);
        const connector = connectorMap.get(connectorId);
        const retentionMs = calculateTrafficRetentionMs(
          connector?.trafficRetentionValue,
          connector?.trafficRetentionUnit,
        );
        const cutoff = Date.now() - retentionMs;
        const files = fs.readdirSync(connectorDirPath);

        for (const file of files) {
          const filePath = path.join(connectorDirPath, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.mtimeMs < cutoff) {
              if (logType === "traffic") {
                const state = input.connectorFiles.get(connectorId);
                if (state && state.filePath === filePath) {
                  try {
                    fs.closeSync(state.fd);
                  } catch {}
                  input.connectorFiles.delete(connectorId);
                }
              }
              fs.unlinkSync(filePath);
            }
          } catch {}
        }

        try {
          const remaining = fs.readdirSync(connectorDirPath);
          if (remaining.length === 0) {
            fs.rmdirSync(connectorDirPath);
          }
        } catch {}
      }
    }
  } catch (error: any) {
    console.error("[LOG-CLEANUP] Error durante la limpieza de logs:", error.message);
  }
}
