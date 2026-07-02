import test from "node:test";
import assert from "node:assert/strict";
import type http from "http";
import type { Connector } from "../src/lib/connectors";
import { refreshProxyPortBinding } from "../src/lib/proxy-port-lifecycle";

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return {
    id: "connector-1",
    name: "Connector 1",
    description: "",
    port: 8080,
    targetUrl: "https://backend.example.com",
    publicHost: "app.example.com",
    isActive: true,
    connectorType: "generic",
    productConfig: {},
    ...overrides,
  };
}

function createMockServer() {
  const listeners = new Map<string, Array<(...args: any[]) => void>>();
  const server = {
    closeCalls: 0,
    listenCalls: [] as Array<{ port: number; host?: string }>,
    on(event: string, listener: (...args: any[]) => void) {
      const current = listeners.get(event) || [];
      current.push(listener);
      listeners.set(event, current);
      return server;
    },
    listen(port: number, host?: string, callback?: () => void) {
      server.listenCalls.push({ port, host });
      callback?.();
      return server;
    },
    close() {
      server.closeCalls++;
      return server;
    },
    emit(event: string, ...args: any[]) {
      for (const listener of listeners.get(event) || []) {
        listener(...args);
      }
    },
  };

  return server as unknown as http.Server & {
    closeCalls: number;
    listenCalls: Array<{ port: number; host?: string }>;
    emit(event: string, ...args: any[]): void;
  };
}

test("proxy port lifecycle cierra y elimina el server cuando ya no hay conectores", async () => {
  const servers = new Map<number, http.Server>();
  const server = createMockServer();
  servers.set(8080, server);

  const result = await refreshProxyPortBinding({
    port: 8080,
    servers,
    connectors: [],
    createServer: () => {
      throw new Error("no deberia crear server");
    },
    log: () => {},
  });

  assert.equal(result, null);
  assert.equal(server.closeCalls, 1);
  assert.equal(servers.has(8080), false);
});

test("proxy port lifecycle conserva server existente y solo loguea refresh", async () => {
  const servers = new Map<number, http.Server>();
  const server = createMockServer();
  const logs: string[] = [];
  servers.set(8080, server);

  const result = await refreshProxyPortBinding({
    port: 8080,
    servers,
    connectors: [makeConnector()],
    createServer: () => {
      throw new Error("no deberia recrear server");
    },
    log: (message) => {
      logs.push(message);
    },
  });

  assert.equal(result, server);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Server kept alive/);
});

test("proxy port lifecycle crea server nuevo, lo registra y hace listen", async () => {
  const servers = new Map<number, http.Server>();
  const server = createMockServer();
  const logs: string[] = [];

  const result = await refreshProxyPortBinding({
    port: 8080,
    servers,
    connectors: [makeConnector()],
    createServer: () => server,
    log: (message) => {
      logs.push(message);
    },
  });

  assert.equal(result, server);
  assert.equal(servers.get(8080), server);
  assert.deepEqual(server.listenCalls, [{ port: 8080, host: "0.0.0.0" }]);
  assert.ok(logs.some((entry) => entry.includes("listening for 1 services")));
});

test("proxy port lifecycle libera el registro y loguea EADDRINUSE", async () => {
  const servers = new Map<number, http.Server>();
  const server = createMockServer();
  const logs: string[] = [];

  await refreshProxyPortBinding({
    port: 8080,
    servers,
    connectors: [makeConnector()],
    createServer: () => server,
    log: (message) => {
      logs.push(message);
    },
  });

  server.emit("error", Object.assign(new Error("busy"), { code: "EADDRINUSE" }));

  assert.equal(servers.has(8080), false);
  assert.ok(logs.some((entry) => entry.includes("already in use")));
});
