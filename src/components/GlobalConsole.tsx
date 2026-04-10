"use client"

import { useState, useEffect, useRef } from "react";
import { Terminal, Activity } from "lucide-react";

interface LogEntry {
  timestamp: string;
  message: string;
  type: "info" | "error" | "system";
}

export function GlobalConsole({ filterId }: { filterId?: string | null }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogs([]);
  }, [filterId]);

  useEffect(() => {
    const eventSource = new EventSource("/api/logs/stream");
    
    eventSource.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        if (filterId && !entry.message.includes(`-> ${filterId}`)) {
          return;
        }
        setLogs(prev => [...prev, entry].slice(-50));
      } catch (e) { }
    };

    return () => eventSource.close();
  }, [filterId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="p-4 font-mono text-[10px] h-[400px] overflow-hidden relative">
      <div 
        ref={scrollRef}
        className="h-full overflow-y-auto space-y-1 pr-2"
      >
        {logs.length === 0 && (
          <div className="text-on-surface-variant/50 mt-4 flex items-center gap-2 animate-pulse pl-2">
            <Activity className="w-3 h-3" /> BizGuard esperando peticiones entrantes...
          </div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex gap-3 p-1 hover:bg-surface-container-highest/30 rounded transition-colors items-start">
            <span className="text-[9px] text-on-surface-variant/50 shrink-0 font-medium whitespace-nowrap pt-0.5">
              {log.timestamp}
            </span>
            <span className={`leading-relaxed break-all ${
              log.type === "error" ? "text-error" : 
              log.type === "system" ? "text-secondary" : 
              "text-primary"
            }`}>
              <span className="opacity-40 mr-1.5">[{log.type.toUpperCase()}]</span>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
