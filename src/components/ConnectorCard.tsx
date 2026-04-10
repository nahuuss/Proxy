"use client"

import { useState } from "react";
import { Connector } from "@/lib/connectors";
import { updateConnectorAction } from "@/app/actions";
import { Edit2, Save, X, ExternalLink, ArrowUpRight } from "lucide-react";
import { useStats } from "@/contexts/StatsContext";

export function ConnectorCard({ connector }: { connector: Connector }) {
  const [isEditing, setIsEditing] = useState(false);
  const { connectors } = useStats();
  const stats = connectors[connector.id] || connector.stats || { requests: 0, bytes: 0, latency: 0 };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (isEditing) {
    return (
      <section className="bg-neutral-900 border-2 border-blue-500 rounded-2xl p-6 shadow-2xl shadow-blue-900/10">
        <form action={async (formData) => {
          await updateConnectorAction(connector.id, formData);
          setIsEditing(false);
        }} className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-blue-400">Editando Conector</h3>
            <button onClick={() => setIsEditing(false)} type="button" className="text-neutral-500 hover:text-white">
              <X size={18} />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] text-neutral-500 uppercase ml-1 font-bold">Nombre</label>
              <input name="name" defaultValue={connector.name} className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-neutral-500 uppercase ml-1 font-bold">Descripción Breve</label>
              <input name="description" defaultValue={connector.description} className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none" placeholder="Para qué sirve este proxy..." />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 uppercase ml-1 font-bold">Puerto</label>
              <input name="port" type="number" defaultValue={connector.port} className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 uppercase ml-1 font-bold">Host Público</label>
              <input name="publicHost" defaultValue={connector.publicHost} className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-neutral-500 uppercase ml-1 font-bold">URL Interna</label>
              <input name="targetUrl" defaultValue={connector.targetUrl} className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none" />
            </div>
          </div>

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2 font-bold flex items-center justify-center gap-2 mt-2">
            <Save size={16} /> Guardar Cambios
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-blue-500/50 transition-all group relative overflow-hidden flex flex-col h-full">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[100px] -z-10" />
      
      <div className="flex justify-between items-start mb-2">
        <div>
          <h2 className="text-xl font-bold">{connector.name}</h2>
          <p className="text-neutral-500 text-xs mt-1 line-clamp-1 italic">{connector.description || "Sin descripción"}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsEditing(true)} className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-white transition-colors">
            <Edit2 size={14} />
          </button>
          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] uppercase tracking-wider rounded-full border border-emerald-500/20 font-bold">Live</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mt-4">
      <div className="bg-black/40 p-3 rounded-xl border border-neutral-800/50 mt-4">
        <div className="flex gap-4 text-xs font-mono text-neutral-500 uppercase tracking-widest">
          <div className="flex flex-col">
            <span>Requests</span>
            <span className="text-blue-400 text-lg font-bold">{stats.requests}</span>
          </div>
          <div className="flex flex-col">
            <span>Traffic</span>
            <span className="text-emerald-400 text-lg font-bold">{formatBytes(stats.bytes)}</span>
          </div>
          <div className="flex flex-col">
            <span>Latency</span>
            <span className="text-yellow-400 text-lg font-bold">{stats.latency ? `${stats.latency}ms` : "-"}</span>
          </div>
        </div>
      </div>
    </div>

      <div className="space-y-2 text-[11px] mt-4 flex-grow">
        <div className="flex justify-between items-center p-2 bg-neutral-800/20 rounded-lg">
          <span className="text-neutral-500 flex items-center gap-1"><ArrowUpRight size={10}/> Target</span>
          <span className="font-mono truncate ml-4 text-blue-200" title={connector.targetUrl}>{connector.targetUrl}</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-blue-500/5 rounded-lg border border-blue-500/10">
          <span className="text-neutral-500 font-bold uppercase text-[9px]">Puerto Activo</span>
          <span className="font-mono text-blue-400 font-bold text-sm tracking-widest">{connector.port}</span>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-neutral-800">
        <a href={`http://localhost:${connector.port}/`} target="_blank" className="w-full text-center py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20">
          <ExternalLink size={14} /> Acceder al Proxy
        </a>
      </div>
    </section>
  );
}
