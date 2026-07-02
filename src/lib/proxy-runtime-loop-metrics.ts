import type os from 'os';

import type { ProxyGlobalMetrics, ProxyStatsEntry } from './proxy-observability';

export function createInitialProxyGlobalMetrics(input: {
  now: number;
  currentCompactionIntervalMs: number;
}): ProxyGlobalMetrics {
  return {
    throughput: 0,
    cpuLoad: 0,
    memUsage: 0,
    activeHeartbeats: 0,
    nodeMemUsage: 0,
    nodeMemPercent: 0,
    lastMemoryReset: input.now,
    nextMemoryReset: input.now + input.currentCompactionIntervalMs,
  };
}

export function computeCpuLoad(prevCpus: os.CpuInfo[], currentCpus: os.CpuInfo[]): number {
  let totalDiff = 0;
  let idleDiff = 0;

  for (let i = 0; i < currentCpus.length; i++) {
    const prev = prevCpus[i]?.times || { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 };
    const curr = currentCpus[i].times;

    const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
    const currTotal = curr.user + curr.nice + curr.sys + curr.idle + curr.irq;

    totalDiff += currTotal - prevTotal;
    idleDiff += curr.idle - prev.idle;
  }

  if (totalDiff <= 0) return 0;
  return Math.min(100, Math.max(0, 100 * (1 - idleDiff / totalDiff)));
}

export function computeTotalBytes(stats: Map<string, ProxyStatsEntry>): number {
  return Array.from(stats.values()).reduce((acc, stat) => acc + stat.bytes, 0);
}

export function computeProxyGlobalMetrics(input: {
  previousMetrics: ProxyGlobalMetrics;
  prevCpus: os.CpuInfo[];
  currentCpus: os.CpuInfo[];
  currentTotalBytes: number;
  lastTotalBytes: number;
  elapsedSec: number;
  totalMem: number;
  freeMem: number;
  rssBytes: number;
  heartbeatCount: number;
  lastCompactionTime: number;
  currentCompactionIntervalMs: number;
}): ProxyGlobalMetrics {
  const deltaBytes = input.currentTotalBytes - input.lastTotalBytes;

  return {
    ...input.previousMetrics,
    throughput: deltaBytes / (1024 * 1024) / (input.elapsedSec || 1),
    cpuLoad: computeCpuLoad(input.prevCpus, input.currentCpus),
    memUsage: input.totalMem > 0 ? ((input.totalMem - input.freeMem) / input.totalMem) * 100 : 0,
    activeHeartbeats: input.heartbeatCount,
    nodeMemUsage: input.rssBytes / 1024 / 1024,
    nodeMemPercent: input.totalMem > 0 ? (input.rssBytes / input.totalMem) * 100 : 0,
    lastMemoryReset: input.lastCompactionTime,
    nextMemoryReset: input.lastCompactionTime + input.currentCompactionIntervalMs,
  };
}
