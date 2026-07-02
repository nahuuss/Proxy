import test from "node:test";
import assert from "node:assert/strict";
import type http from "http";
import type { Connector } from "../src/lib/connectors";
import type { GlobalSettings } from "../src/lib/settings";
import { createProxyPortServer } from "../src/lib/proxy-port-server";

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

function makeSettings(overrides: Partial<GlobalSettings> = {}): GlobalSettings {
  return {
    id: "global_settings",
    internalTarget: "http://127.0.0.1:3000",
    publicHost: "app.example.com",
    bypassAuth: false,
    authUrl: "https://auth.example.com",
    hbFirstPulse: 20,
    memoryResetIntervalMinutes: 30,
    ...overrides,
  };
}

test("proxy port server crea http handler y registra upgrade handler", async () => {
  let capturedHttpHandler:
    | ((req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>)
    | undefined;
  const listeners = new Map<string, Array<(...args: any[]) => void>>();
  const server = {
    on(event: string, listener: (...args: any[]) => void) {
      const current = listeners.get(event) || [];
      current.push(listener);
      listeners.set(event, current);
      return server;
    },
  } as unknown as http.Server;

  const created = createProxyPortServer({
    port: 8080,
    rateLimiter: { check: () => true },
    loadContext: async () => ({
      connectors: [makeConnector()],
      settings: makeSettings(),
    }),
    verifySession: async () => null,
    forwardToInternalDashboard: () => {},
    handleConnectorRequest: () => {},
    webSocketBackend: {
      connectBackendSocket: () =>
        ({
          destroyed: false,
          write() {},
          destroy() {},
          pipe() {},
          on() {
            return this;
          },
          once() {
            return this;
          },
        }) as any,
    },
    log: () => {},
    createHttpServer: (handler) => {
      capturedHttpHandler = handler;
      return server;
    },
  });

  assert.equal(created, server);
  assert.ok(capturedHttpHandler);
  assert.equal((listeners.get("upgrade") || []).length, 1);
});
