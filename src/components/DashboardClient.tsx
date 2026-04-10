"use client"

// BizGuard Dashboard Client v1.2.1 - Cache Force Refresh
import { useState } from "react";
import { Connector } from "@/lib/connectors";
import { ConnectorRow } from "@/components/ConnectorRow";
import { GlobalConsole } from "@/components/GlobalConsole";
import { GlobalMetricsSummary } from "@/components/GlobalMetricsSummary";
import { useStats } from "@/contexts/StatsContext";
import { LayoutGrid, List } from "lucide-react";

export function DashboardClient({ initialConnectors }: { initialConnectors: Connector[] }) {
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const { connectors, metrics } = useStats();

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
              <ConnectorRow connector={connector} isSelected={selectedConnectorId === connector.id} />
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
          <div className="px-1">
            <h2 className="font-headline text-[13px] font-bold text-on-surface uppercase tracking-tighter text-secondary">BizGuard Performance</h2>
            <p className="font-body text-[9px] text-on-surface-variant/60">Real-time health & load metrics</p>
          </div>
          <GlobalMetricsSummary 
            avgLatency={avgLatency}
            throughput={metrics.throughput}
            cpuLoad={metrics.cpuLoad}
            memUsage={metrics.memUsage}
            activeHeartbeats={metrics.activeHeartbeats}
          />
        </section>
      </div>
    </div>
  );
}
