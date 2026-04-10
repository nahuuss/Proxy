import { Activity, Cpu, Gauge, HeartPulse } from "lucide-react";

export function GlobalMetricsSummary({ 
  avgLatency,
  throughput = 0,
  cpuLoad = 0,
  memUsage = 0,
  activeHeartbeats = 0
}: { 
  avgLatency: number,
  throughput?: number,
  cpuLoad?: number,
  memUsage?: number,
  activeHeartbeats?: number
}) {
  const hbColor = activeHeartbeats > 0 ? "text-error" : "text-secondary";
  const hbLabel = activeHeartbeats > 0 ? `${activeHeartbeats} activos` : "Inactivo";
  const hbBarWidth = activeHeartbeats > 0 ? Math.min(100, activeHeartbeats * 25) : 0;

  return (
    <section className="grid grid-cols-1 gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        {/* Throughput Sensor */}
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
        
        {/* CPU Sensor */}
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

        {/* RAM Sensor */}
        <div className="bg-surface-container-low p-2.5 rounded-xl space-y-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] border border-white/5">
          <div className="flex justify-between items-center">
            <p className="font-label text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/70">Memory</p>
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
        
        {/* Heartbeat Shield Sensor */}
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
      </div>
    </section>
  );
}
