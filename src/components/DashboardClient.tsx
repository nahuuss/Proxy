"use client";

import { useState, useEffect } from "react";
import { Connector } from "@/lib/connectors";
import { ConnectorRow } from "@/components/ConnectorRow";
import { GlobalConsole } from "@/components/GlobalConsole";
import { GlobalMetricsSummary } from "@/components/GlobalMetricsSummary";
import { useStats } from "@/contexts/StatsContext";
import { LayoutGrid, List, RefreshCw } from "lucide-react";

export function DashboardClient({
  initialConnectors,
  dashboardHost,
  dashboardProtocol,
}: {
  initialConnectors: Connector[];
  dashboardHost: string;
  dashboardProtocol: "http" | "https";
}) {
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const { connectors, metrics } = useStats();
  const [timeRemaining, setTimeRemaining] = useState<string>("--:--");
  const [isResetting, setIsResetting] = useState(false);

  const displayConnectors = initialConnectors.map(c => ({
    ...c,
    stats: connectors[c.id] || c.stats || { requests: 0, bytes: 0, latency: 0 }
  }));

  const activePings = Object.values(connectors)
    .map(s => s.activePing)
    .filter(p => p !== undefined && p > 0) as number[];
  const avgLatency = activePings.length > 0 
    ? Math.round(activePings.reduce((a, b) => a + b, 0) / activePings.length) 
    : 0;

  const nextReset = metrics.nextMemoryReset || 0;

  useEffect(() => {
    const updateTimer = () => {
      if (!nextReset) {
        setTimeRemaining("--:--");
        return;
      }
      const diff = nextReset - Date.now();
      if (diff <= 0) {
        setTimeRemaining("00:00");
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(`${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
      }
    };
    updateTimer();
    const iv = setInterval(updateTimer, 1000);
    return () => clearInterval(iv);
  }, [nextReset]);

  const handleManualReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      const res = await fetch("/api/memory/reset", { method: "POST" });
      if (res.ok) {
        // Forzar actualización inmediata llamando a stats
        await fetch("/api/stats");
      }
    } catch (e) {
      console.error("Error al forzar reset de memoria:", e);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* BizGuard Connectors List */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="font-headline text-lg font-bold text-on-surface tracking-tight uppercase tracking-tighter">Active BizGuard Connectors</h2>
            <p className="font-body text-[10px] text-on-surface-variant/70">Real-time performance monitoring and BizGuard health</p>
          </div>
          <div className="flex bg-surface-container-low p-1 rounded-lg border border-white/5 shadow-inner">
            <button className="p-1.5 text-on-surface-variant hover:text-primary transition-colors">
              <LayoutGrid size={14}/>
            </button>
            <button className="p-1.5 text-primary bg-surface-container-highest rounded-md shadow-sm">
              <List size={14}/>
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          {displayConnectors.map((connector) => (
            <div 
              key={connector.id} 
              onClick={() => setSelectedConnectorId(connector.id === selectedConnectorId ? null : connector.id)}
              className={`cursor-pointer transition-all duration-300 ${selectedConnectorId === connector.id ? 'ring-2 ring-primary/30 rounded-lg translate-x-1' : ''}`}
            >
              <ConnectorRow
                connector={connector}
                isSelected={selectedConnectorId === connector.id}
                dashboardHost={dashboardHost}
                dashboardProtocol={dashboardProtocol}
              />
            </div>
          ))}
          {displayConnectors.length === 0 && (
            <div className="p-10 text-center border border-dashed border-outline-variant/30 rounded-xl text-on-surface-variant/50">
              <p className="text-sm font-medium">No hay servicios BizGuard activos. Despliega un nuevo nodo arriba.</p>
            </div>
          )}
        </div>
      </section>

      {/* Grid 50/50: BizGuard Console and Stacked Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <div>
              <h2 className="font-headline text-[13px] font-bold text-on-surface flex items-center gap-2 uppercase tracking-tighter text-primary">
                BizGuard Operations Console 
                {selectedConnectorId && (
                  <span className="text-[9px] bg-primary/20 text-primary px-2 py-0.5 rounded-full border border-primary/20 animate-pulse uppercase font-bold tracking-widest">
                    Trace: {selectedConnectorId}
                  </span>
                )}
              </h2>
              <p className="font-body text-[9px] text-on-surface-variant/60">Live streaming trace and BizGuard telemetry</p>
            </div>
          </div>
          <div className="glass-panel rounded-xl overflow-hidden border border-outline-variant/20 shadow-[0_20px_40px_rgba(0,0,0,0.4)] bg-surface-container-lowest/30">
            <GlobalConsole filterId={selectedConnectorId} />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <div>
              <h2 className="font-headline text-[13px] font-bold text-on-surface uppercase tracking-tighter text-secondary">BizGuard Performance</h2>
              <p className="font-body text-[9px] text-on-surface-variant/60">Real-time health & load metrics</p>
            </div>
            
            {/* GC Rescheduling controls */}
            <div className="flex items-center gap-2.5 bg-surface-container-low/75 border border-white/5 rounded-lg px-2.5 py-1.5 shadow-inner text-[10px] text-on-surface-variant">
              <div className="flex flex-col text-right">
                <span className="font-semibold text-secondary font-mono text-[11px] leading-tight">{timeRemaining}</span>
                <span className="text-[7px] uppercase tracking-wider text-on-surface-variant/50">Próx. Reset</span>
              </div>
              <div className="h-5 w-[1px] bg-white/10"></div>
              <button 
                onClick={handleManualReset}
                disabled={isResetting}
                className={`flex items-center gap-1 px-2 py-1 rounded bg-secondary/10 hover:bg-secondary/20 disabled:opacity-50 active:scale-95 transition-all text-secondary font-semibold text-[8px] uppercase tracking-wider ${isResetting ? 'cursor-not-allowed' : ''}`}
                title="Forzar liberación de memoria y compactación"
              >
                <RefreshCw size={10} className={isResetting ? "animate-spin" : ""} />
                {isResetting ? "Limpiando..." : "Reset"}
              </button>
            </div>
          </div>
          <GlobalMetricsSummary 
            avgLatency={avgLatency}
            throughput={metrics.throughput}
            cpuLoad={metrics.cpuLoad}
            memUsage={metrics.memUsage}
            activeHeartbeats={metrics.activeHeartbeats}
            nodeMemUsage={metrics.nodeMemUsage}
            nodeMemPercent={metrics.nodeMemPercent}
            lastMemoryReset={metrics.lastMemoryReset}
            nextMemoryReset={metrics.nextMemoryReset}
          />
        </section>
      </div>
    </div>
  );
}
