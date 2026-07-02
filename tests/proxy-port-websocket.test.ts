import test from "node:test";
import assert from "node:assert/strict";
import type http from "http";
import type { Connector } from "../src/lib/connectors";
import type { GlobalSettings } from "../src/lib/settings";
import {
  createProxyPortWebSocketUpgradeHandler,
  type ProxyPortWebSocketLikeSocket,
} from "../src/lib/proxy-port-websocket";

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

function createMockSocket() {
  const listeners = new Map<string, Array<(...args: any[]) => void>>();

  const socket: ProxyPortWebSocketLikeSocket & {
    writes: Array<string | Buffer>;
    emitEvent: (event: string, ...args: any[]) => void;
  } = {
    destroyed: false,
    writes: [],
    write(data) {
      socket.writes.push(data);
    },
    destroy() {
      socket.destroyed = true;
    },
    pipe() {
      return socket;
    },
    on(event, listener) {
      const current = listeners.get(event) || [];
      current.push(listener);
      listeners.set(event, current);
      return socket;
    },
    once(event, listener) {
      const wrapped = (...args: any[]) => {
        const current = listeners.get(event) || [];
        listeners.set(
          event,
          current.filter((entry) => entry !== wrapped),
        );
        listener(...args);
      };
      return socket.on(event, wrapped);
    },
    emitEvent(event, ...args) {
      for (const listener of listeners.get(event) || []) {
        listener(...args);
      }
    },
  };

  return socket;
}

function createMockRequest(input?: {
  url?: string;
  host?: string;
  cookie?: string;
}) {
  return {
    url: input?.url || "/",
    method: "GET",
    headers: {
      host: input?.host || "app.example.com",
      cookie: input?.cookie || "",
    },
    socket: {
      remoteAddress: "10.0.0.1",
    },
  } as unknown as http.IncomingMessage;
}

test("proxy port websocket responde 502 si no encuentra conector activo", async () => {
  const handler = createProxyPortWebSocketUpgradeHandler({
    loadContext: async () => ({ connectors: [], settings: makeSettings() }),
    verifySession: async () => null,
    connectBackendSocket: () => {
      throw new Error("no deberia conectar backend");
    },
    log: () => {},
  });

  const socket = createMockSocket();
  await handler(createMockRequest(), socket, Buffer.alloc(0));

  assert.equal(socket.destroyed, true);
  assert.equal(
    socket.writes[0],
    "HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n",
  );
});

test("proxy port websocket responde 401 si la sesion no cumple el contrato", async () => {
  const connector = makeConnector();
  const handler = createProxyPortWebSocketUpgradeHandler({
    loadContext: async () => ({
      connectors: [connector],
      settings: makeSettings(),
    }),
    verifySession: async () => null,
    connectBackendSocket: () => {
      throw new Error("no deberia conectar backend");
    },
    log: () => {},
  });

  const socket = createMockSocket();
  await handler(createMockRequest(), socket, Buffer.alloc(0));

  assert.equal(socket.destroyed, true);
  assert.equal(
    socket.writes[0],
    "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n",
  );
});

test("proxy port websocket conecta backend, escribe payload y loguea al abrir", async () => {
  const connector = makeConnector({ bypassAuth: true });
  const logs: string[] = [];
  const backendSocket = createMockSocket();
  const clientSocket = createMockSocket();

  const handler = createProxyPortWebSocketUpgradeHandler({
    loadContext: async () => ({
      connectors: [connector],
      settings: makeSettings(),
    }),
    verifySession: async () => null,
    connectBackendSocket: ({ targetHost, targetPort, isHttps }) => {
      assert.equal(targetHost, "backend.example.com");
      assert.equal(targetPort, 443);
      assert.equal(isHttps, true);
      return backendSocket;
    },
    log: (message) => {
      logs.push(message);
    },
  });

  const head = Buffer.from("HEAD");
  await handler(
    createMockRequest({ url: "/ORG/main.aspx?id=1", host: "app.example.com" }),
    clientSocket,
    head,
  );

  backendSocket.emitEvent("secureConnect");

  assert.match(String(backendSocket.writes[0]), /^GET \/ORG\/main\.aspx\?id=1 HTTP\/1\.1\r\n/);
  assert.equal(backendSocket.writes[1], head);
  assert.ok(logs.some((entry) => entry.includes("Conectado")));
});

test("proxy port websocket destruye cliente y loguea solo errores no esperados", async () => {
  const connector = makeConnector({ bypassAuth: true });
  const logs: string[] = [];
  const backendSocket = createMockSocket();
  const clientSocket = createMockSocket();

  const handler = createProxyPortWebSocketUpgradeHandler({
    loadContext: async () => ({
      connectors: [connector],
      settings: makeSettings(),
    }),
    verifySession: async () => null,
    connectBackendSocket: () => backendSocket,
    log: (message, type) => {
      logs.push(`${type}:${message}`);
    },
  });

  await handler(createMockRequest(), clientSocket, Buffer.alloc(0));
  backendSocket.emitEvent("error", Object.assign(new Error("boom"), { code: "OTHER" }));

  assert.equal(clientSocket.destroyed, true);
  assert.ok(logs.some((entry) => entry.includes("error:[WS-PROXY] Error backend: boom")));
});
