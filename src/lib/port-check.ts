import net from "net";
import type { Connector } from "./connectors";

export interface PortCheckResult {
  occupied: boolean;
  reason?: "configured" | "system";
}

export function isPortConfigured(connectors: Pick<Connector, "port">[], port: number): boolean {
  return connectors.some((connector) => connector.port === port);
}

export async function checkSystemPortAvailability(port: number): Promise<PortCheckResult> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => {
      resolve({ occupied: true, reason: "system" });
    });
    server.once("listening", () => {
      server.close(() => {
        resolve({ occupied: false });
      });
    });
    server.listen(port, "0.0.0.0");
  });
}
