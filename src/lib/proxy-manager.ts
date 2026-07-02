import { Connector } from "./connectors";
import type http from "http";
import { EventEmitter } from "events";
import { type ProxyServerCacheEntry } from "./proxy-lifecycle";
import { scheduleProxyManagerLoops } from "./proxy-manager-runtime-driver";
import {
  createProxyManagerLogger,
} from "./proxy-manager-adapters";
import { type ProxyStatsEntry } from "./proxy-observability";
import { RateLimiter } from "./proxy-rate-limit";
import { createProxyManagerPortController } from "./proxy-manager-port-controller";
import { createProxyManagerRuntimeController } from "./proxy-manager-runtime-controller";

declare global {
  var proxyManager: ProxyManager | undefined;
}

// Helpers desacoplados de sesion y rate limiting del proxy.
const rateLimiter = new RateLimiter(parseInt(process.env.RATE_LIMIT_RPM || "300"));

class ProxyManager extends EventEmitter {
  private servers: Map<number, http.Server> = new Map();
  private proxyServers: Map<string, ProxyServerCacheEntry> = new Map();
  private stats: Map<string, ProxyStatsEntry> = new Map();
  private pingStats: Record<string, number> = {};

  public heartbeatCount = 0;
  private readonly relayLog = createProxyManagerLogger({
    log: (message, type) => {
      this.log(message, type);
    },
  });
  private readonly runtimeController = createProxyManagerRuntimeController({
    stats: this.stats,
    pingStats: this.pingStats,
    getHeartbeatCount: () => this.heartbeatCount,
    emitStats: (snapshot) => {
      this.emit("stats", snapshot);
    },
  });
  private readonly portController = createProxyManagerPortController({
    servers: this.servers,
    proxyServers: this.proxyServers,
    stats: this.stats,
    markStatsPending: this.runtimeController.markStatsPending,
    log: this.relayLog,
    rateLimiter,
  });

  constructor() {
    super();
    this.setMaxListeners(100);
    scheduleProxyManagerLoops({
      runRuntimeTick: () => {
        this.runRuntimeTick();
      },
      runMonitoringCycle: () => this.runMonitoringCycle(),
    });
  }

  private runRuntimeTick() {
    this.runtimeController.runRuntimeTick();
  }

  private async runMonitoringCycle() {
    await this.runtimeController.runMonitoringCycle();
  }

  async init() {
    await this.portController.init();
  }

  getStats(id?: string) {
    if (id) return this.stats.get(id);
    return Object.fromEntries(this.stats);
  }

  log(message: string, type: "info" | "error" | "system" = "info") {
    const result = this.runtimeController.applyLog(message, type);
    this.emit("log", result.entry);
    console.log(result.consoleMessage);
  }

  async startConnector(connector: Connector) {
    await this.portController.startConnector(connector);
  }

  stopConnector(id: string) {
    this.portController.stopConnector(id);
  }
}

export const proxyManager = global.proxyManager || new ProxyManager();
global.proxyManager = proxyManager;

export default proxyManager;
