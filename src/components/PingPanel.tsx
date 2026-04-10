"use client";

import { Zap } from "lucide-react";
import { useStats } from "@/contexts/StatsContext";

interface PingData {
  [key: string]: number;
}

export function PingPanel() {
  const { pings } = useStats();

  const getStatusColor = (ms: number) => {
    if (ms === -1) return "bg-error shadow-[0_0_10px_var(--color-error)]";
    if (ms < 50) return "bg-secondary shadow-[0_0_10px_var(--color-secondary)]";
    if (ms < 150) return "bg-tertiary shadow-[0_0_10px_var(--color-tertiary)]";
    return "bg-[#f59e0b] shadow-[0_0_10px_rgba(245,158,11,0.5)]";
  };

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-4 gap-4">
      {Object.entries(pings).map(([label, ms]) => (
        <div 
          key={label}
          className="bg-surface-container-highest/50 backdrop-blur-md border border-outline-variant/20 rounded-lg p-2 flex items-center justify-between hover:bg-surface-container-highest transition-all duration-300 group"
        >
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(ms)} animate-pulse`} />
            <div className="flex flex-col">
              <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold leading-none mb-1">
                {label.split('.')[0]}
              </span>
              <span className="font-body text-xs text-on-surface/80 font-medium truncate max-w-[120px]">
                {label}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Zap className={`w-2 h-2 ${ms === -1 ? 'text-error' : 'text-secondary'} opacity-50`} />
            <span className={`text-xs font-headline font-bold ${ms === -1 ? 'text-error' : 'text-secondary'}`}>
              {ms === -1 ? 'TIMEOUT' : `${ms}ms`}
            </span>
          </div>
        </div>
      ))}
      
      {Object.keys(pings).length === 0 && (
        <div className="col-span-full py-4 text-center text-on-surface-variant/50 font-body text-xs italic animate-pulse">
          Iniciando monitoreo de red Cloudflare Tunnel...
        </div>
      )}
    </div>
  );
}
