import os from 'os';

import { getConnectors } from './connectors';
import { getCurrentCompactionIntervalMs, getLastCompactionTime } from './db';
import {
  executeProxyManagerRuntimeTick,
  type ExecuteProxyManagerRuntimeTickResult,
} from './proxy-manager-runtime-driver';
import { runProxyMonitoringCycle } from './proxy-monitoring-loop';
import { writeProxySyncPayload } from './proxy-sync-store';

import type { CreateProxyManagerRuntimeControllerInput } from './proxy-manager-runtime-controller';

export type ProxyManagerRuntimeResolvedDeps = {
  loadConnectors: typeof getConnectors;
  monitoringCycleRunner: typeof runProxyMonitoringCycle;
  executeRuntimeTick: (
    input: Parameters<typeof executeProxyManagerRuntimeTick>[0],
  ) => ExecuteProxyManagerRuntimeTickResult;
  writeSyncPayload: typeof writeProxySyncPayload;
  getCurrentCpus: () => os.CpuInfo[];
  getTotalMem: () => number;
  getFreeMem: () => number;
  getRssBytes: () => number;
  getNow: () => number;
  readLastCompactionTime: () => number;
  readCurrentCompactionIntervalMs: () => number;
  logInfo: (message: string) => void;
  logError: (message: string) => void;
};

export function resolveProxyManagerRuntimeDeps(
  input: CreateProxyManagerRuntimeControllerInput,
): ProxyManagerRuntimeResolvedDeps {
  return {
    loadConnectors: input.loadConnectors || getConnectors,
    monitoringCycleRunner: input.monitoringCycleRunner || runProxyMonitoringCycle,
    executeRuntimeTick: input.executeRuntimeTick || executeProxyManagerRuntimeTick,
    writeSyncPayload: input.writeSyncPayload || writeProxySyncPayload,
    getCurrentCpus: input.getCurrentCpus || os.cpus,
    getTotalMem: input.getTotalMem || os.totalmem,
    getFreeMem: input.getFreeMem || os.freemem,
    getRssBytes: input.getRssBytes || (() => process.memoryUsage().rss),
    getNow: input.getNow || Date.now,
    readLastCompactionTime: input.getLastCompactionTime || getLastCompactionTime,
    readCurrentCompactionIntervalMs:
      input.getCurrentCompactionIntervalMs || getCurrentCompactionIntervalMs,
    logInfo: input.logInfo || console.log,
    logError: input.logError || console.log,
  };
}
