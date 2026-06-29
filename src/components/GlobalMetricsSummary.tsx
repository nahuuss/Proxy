"use client";

import { useEffect, useState } from "react";
import { Activity, Cpu, Gauge, HeartPulse, Database, RefreshCw } from "lucide-react";

function formatClockTime(ts?: number) {
  if (!ts) return "--:--:--";
  const date = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDuration(ms?: number) {
  if (!ms || ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatNodeMemoryMb(mb: number) {
  return `${mb.toFixed(1)} MB`;
}

function formatNodeMemoryGb(mb: number) {
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatNodeMemoryPercent(percent: number) {
  if (percent <= 0) return "0.00%";
  if (percent < 0.01) return "< 0.01%";
  return `${percent.toFixed(2)}%`;
}

export function GlobalMetricsSummary({ 
  avgLatency,
  throughput = 0,
  cpuLoad = 0,
  memUsage = 0,
  activeHeartbeats = 0,
  nodeMemUsage = 0,
  nodeMemPercent = 0,
  lastMemoryReset = 0,
  nextMemoryReset = 0
}: { 
  avgLatency: number,
  throughput?: number,
  cpuLoad?: number,
  memUsage?: number,
  activeHeartbeats?: number,
  nodeMemUsage?: number,
  nodeMemPercent?: number,
  lastMemoryReset?: number,
  nextMemoryReset?: number
}) {
  const [now, setNow] = useState(Date.now());
  const hbColor = activeHeartbeats > 0 ? "text-error" : "text-secondary";
  const hbLabel = activeHeartbeats > 0 ? `${activeHeartbeats} activos` : "Inactivo";
  const hbBarWidth = activeHeartbeats > 0 ? Math.min(100, activeHeartbeats * 25) : 0;
  const resetRemainingMs = nextMemoryReset > 0 ? Math.max(0, nextMemoryReset - now) : 0;
  const resetProgress = nextMemoryReset > lastMemoryReset && lastMemoryReset > 0
    ? Math.min(100, Math.max(0, (resetRemainingMs / (nextMemoryReset - lastMemoryReset)) * 100))
    : 0;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="grid grid-cols-1 gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-surface-container-low p-2.5 rounded-xl space-y-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] border border-white/5">
          <div className="flex justify-between items-center">
            <p className="font-label text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/70">Throughput</p>
            <Activity className="text-primary w-3 h-3" />
          </div>
          <div className="flex items-baseline gap-1">
            <h4 className="font-headline text-lg font-bold text-on-surface">{throughput.toFixed(1)}</h4>
            <span className="text-[9px] text-on-surface-variant/50">MB/s</span>
          </div>
          <div className="w-full h-1 bg-surface-container-lowest rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, (throughput / 50) * 100)}%` }}></div>
          </div>
        </div>
        
        <div className="bg-surface-container-low p-2.5 rounded-xl space-y-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] border border-white/5">
          <div className="flex justify-between items-center">
            <p className="font-label text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/70">Load</p>
            <Cpu className="text-secondary w-3 h-3" />
          </div>
          <div className="flex items-baseline gap-1">
            <h4 className="font-headline text-lg font-bold text-on-surface">{cpuLoad.toFixed(1)}</h4>
            <span className="text-[9px] text-on-surface-variant/50">% CPU</span>
          </div>
          <div className="w-full h-1 bg-surface-container-lowest rounded-full overflow-hidden">
            <div className="h-full bg-secondary transition-all duration-500" style={{ width: `${cpuLoad}%` }}></div>
          </div>
        </div>

        <div className="bg-surface-container-low p-2.5 rounded-xl space-y-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] border border-white/5">
          <div className="flex justify-between items-center">
            <p className="font-label text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/70">OS RAM</p>
            <Gauge className="text-tertiary w-3 h-3" />
          </div>
          <div className="flex items-baseline gap-1">
            <h4 className="font-headline text-lg font-bold text-on-surface">{memUsage.toFixed(1)}</h4>
            <span className="text-[9px] text-on-surface-variant/50">% RAM</span>
          </div>
          <div className="w-full h-1 bg-surface-container-lowest rounded-full overflow-hidden">
            <div className="h-full bg-tertiary transition-all duration-500" style={{ width: `${memUsage}%` }}></div>
          </div>
        </div>

        <div className="bg-surface-container-low p-2.5 rounded-xl space-y-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] border border-white/5">
          <div className="flex justify-between items-center">
            <p className="font-label text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/70">BizGuard RAM</p>
            <Database className="text-primary w-3 h-3" />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <h4 className="font-headline text-lg font-bold text-on-surface">{formatNodeMemoryMb(nodeMemUsage)}</h4>
              <span className="font-headline text-lg font-bold text-on-surface/60">/</span>
              <h4 className="font-headline text-lg font-bold text-on-surface">{formatNodeMemoryGb(nodeMemUsage)}</h4>
            </div>
            <p className="text-[9px] text-on-surface-variant/60">{formatNodeMemoryPercent(nodeMemPercent)} de la RAM del host</p>
          </div>
          <div className="w-full h-1 bg-surface-container-lowest rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${nodeMemPercent > 0 ? Math.max(1, Math.min(100, nodeMemPercent)) : 0}%` }}></div>
          </div>
        </div>
        
        <div className="bg-surface-container-low p-2.5 rounded-xl space-y-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] border border-white/5">
          <div className="flex justify-between items-center">
            <p className="font-label text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/70">HB Shield</p>
            <HeartPulse className={`w-3 h-3 ${activeHeartbeats > 0 ? 'text-error animate-pulse' : 'text-secondary'}`} />
          </div>
          <div className="flex items-baseline gap-1">
            <h4 className={`font-headline text-lg font-bold ${hbColor}`}>{hbLabel}</h4>
          </div>
          <div className="w-full h-1 bg-surface-container-lowest rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-500 ${activeHeartbeats > 0 ? 'bg-error animate-pulse' : 'bg-secondary'}`} style={{ width: `${hbBarWidth}%` }}></div>
          </div>
        </div>

        <div className="bg-surface-container-low p-2.5 rounded-xl space-y-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] border border-white/5">
          <div className="flex justify-between items-center">
            <p className="font-label text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/70">Reset automatico</p>
            <RefreshCw className="text-secondary w-3 h-3" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h4 className="font-headline text-lg font-bold text-on-surface">{formatDuration(resetRemainingMs)}</h4>
            <p className="text-[9px] text-on-surface-variant/60">Ultimo reset: {formatClockTime(lastMemoryReset)}</p>
          </div>
          <div className="w-full h-1 bg-surface-container-lowest rounded-full overflow-hidden">
            <div className="h-full bg-secondary transition-all duration-500" style={{ width: `${resetProgress}%` }}></div>
          </div>
        </div>
      </div>
    </section>
  );
}
