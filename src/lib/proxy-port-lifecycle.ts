import type http from "http";
import type { Connector } from "./connectors";

export interface RefreshProxyPortBindingInput {
  port: number;
  servers: Map<number, http.Server>;
  connectors: Connector[];
  createServer: () => http.Server;
  log: (message: string, type?: "info" | "error" | "system") => void;
  listenHost?: string;
}

export async function refreshProxyPortBinding(
  input: RefreshProxyPortBindingInput,
): Promise<http.Server | null> {
  if (input.connectors.length === 0) {
    const existingServer = input.servers.get(input.port);
    if (existingServer) {
      existingServer.close();
      input.servers.delete(input.port);
    }
    return null;
  }

  if (input.servers.has(input.port)) {
    input.log(
      `[BIZGUARD] Port ${input.port} refreshed with ${input.connectors.length} services (Server kept alive)`,
      "system",
    );
    return input.servers.get(input.port) || null;
  }

  const server = input.createServer();
  server.on("error", (error: NodeJS.ErrnoException) => {
    input.servers.delete(input.port);
    if (error.code === "EADDRINUSE") {
      input.log(
        `[BIZGUARD] Port ${input.port} is already in use by another process. Skipping bind.`,
        "system",
      );
      return;
    }
    input.log(`[BIZGUARD Error] Port ${input.port}: ${error.message}`, "error");
  });

  input.servers.set(input.port, server);
  server.listen(input.port, input.listenHost || "0.0.0.0", () => {
    input.log(
      `[BIZGUARD] Port ${input.port} listening for ${input.connectors.length} services`,
      "system",
    );
  });

  return server;
}
