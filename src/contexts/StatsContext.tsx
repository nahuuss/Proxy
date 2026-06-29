"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";

interface StatsData {
  [key: string]: {
    requests: number;
    bytes: number;
    latency?: number;
    activePing?: number;
    isOnline?: boolean;
  };
}

interface PingsData {
  [key: string]: number;
}

interface SystemMetrics {
  throughput: number;
  cpuLoad: number;
  memUsage: number;
  activeHeartbeats: number;
  nodeMemUsage?: number;
  nodeMemPercent?: number;
  lastMemoryReset?: number;
  nextMemoryReset?: number;
}

interface CombinedStats {
  connectors: StatsData;
  pings: PingsData;
  metrics: SystemMetrics;
}

const StatsContext = createContext<CombinedStats>({ 
  connectors: {}, 
  pings: {},
  metrics: { throughput: 0, cpuLoad: 0, memUsage: 0, activeHeartbeats: 0, nodeMemUsage: 0, nodeMemPercent: 0, lastMemoryReset: 0, nextMemoryReset: 0 }
});

export function StatsProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<CombinedStats>({ 
    connectors: {}, 
    pings: {},
    metrics: { throughput: 0, cpuLoad: 0, memUsage: 0, activeHeartbeats: 0, nodeMemUsage: 0, nodeMemPercent: 0, lastMemoryReset: 0, nextMemoryReset: 0 }
  });
  
  const lastUpdateRef = useRef<number>(Date.now());
  const eventSourceRef = useRef<EventSource | null>(null);

  const processData = (data: any) => {
    try {
      const pings = data.__pings || {};
      const metrics = data.__metrics || { throughput: 0, cpuLoad: 0, memUsage: 0 };
      const connectors = { ...data };
      delete connectors.__pings;
      delete connectors.__metrics;

      setStats({ connectors, pings, metrics });
      lastUpdateRef.current = Date.now();
    } catch (e) { }
  };

  const fetchManualStats = async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json();
        processData(data);
      }
    } catch (e) { }
  };

  useEffect(() => {
    const connect = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource("/api/stats/stream");
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          processData(data);
        } catch (e) { }
      };

      es.onerror = () => {
        // Simple error handling, will retry on next poll if disconnected
        es.close();
      };
    };

    connect();

    // Polling de respaldo cada 5 segundos
    const pollInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateRef.current;

      // Si han pasado más de 6 segundos sin datos del stream, forzar un fetch
      if (timeSinceLastUpdate > 6000) {
        fetchManualStats();
        
        // Si el stream parece muerto (más de 30s), intentar reconectar
        if (timeSinceLastUpdate > 30000 || !eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
            connect();
        }
      }
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  return (
    <StatsContext.Provider value={stats}>
      {children}
    </StatsContext.Provider>
  );
}

export const useStats = () => useContext(StatsContext);
