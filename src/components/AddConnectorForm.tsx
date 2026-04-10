"use client";

import { createConnectorAction } from "@/app/actions";
import { useActionState } from "react";
import { Rocket, Loader2, Zap } from "lucide-react";

export function AddConnectorForm() {
  const [state, formAction, isPending] = useActionState(createConnectorAction, {
    message: "",
    success: false
  });

  return (
    <section className="bg-surface-container-low rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative">
      <div className="px-8 py-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
        <div>
          <h2 className="font-headline text-lg font-bold text-on-surface tracking-tight">Dar de Alta Nuevo BizGuard</h2>
          <p className="font-body text-xs text-on-surface-variant mt-1">Provision new BizGuard infrastructure in seconds</p>
        </div>
        <Rocket className="text-primary/50 w-8 h-8" />
      </div>
      
      <form action={formAction} className="p-8 grid grid-cols-1 md:grid-cols-6 gap-6 items-end relative">
        <div className="space-y-2 col-span-1 md:col-span-2">
          <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">BizGuard Name</label>
          <input 
            name="name"
            required
            className="w-full bg-surface-container-lowest border border-transparent text-on-surface text-sm py-3 px-4 rounded-lg focus:border-primary/50 focus:ring-0 focus:shadow-[0_0_12px_rgba(179,197,255,0.15)] placeholder-outline-variant transition-all outline-none" 
            placeholder="e.g. Edge BizGuard Primary" 
            type="text"
          />
        </div>
        <div className="space-y-2">
          <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Port</label>
          <input 
            name="port"
            required
            type="number"
            className="w-full bg-surface-container-lowest border border-transparent text-on-surface font-mono text-sm py-3 px-4 rounded-lg focus:border-primary/50 focus:ring-0 focus:shadow-[0_0_12px_rgba(179,197,255,0.15)] placeholder-outline-variant transition-all outline-none" 
            placeholder="e.g. 8080"
          />
        </div>
        <div className="space-y-2 col-span-1 md:col-span-2">
          <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Target URL & Public Host</label>
          <div className="flex bg-surface-container-lowest rounded-lg border border-transparent focus-within:border-primary/50 focus-within:shadow-[0_0_12px_rgba(179,197,255,0.15)] transition-all overflow-hidden">
             <input 
              name="targetUrl"
              required
              className="w-1/2 bg-transparent border-none text-on-surface text-sm py-3 px-4 outline-none focus:ring-0 placeholder-outline-variant border-r border-outline-variant/15" 
              placeholder="http://10.0.0.1:80" 
              type="text"
            />
            <input 
              name="publicHost"
              required
              className="w-1/2 bg-transparent border-none text-on-surface text-sm py-3 px-4 outline-none focus:ring-0 placeholder-outline-variant" 
              placeholder="app.dominio.com" 
              type="text"
            />
          </div>
        </div>
        <input type="hidden" name="description" value="" />
        
        <button 
          type="submit"
          disabled={isPending}
          className="bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 text-xs uppercase tracking-widest transition-transform active:scale-95 hover:brightness-110 shadow-lg shadow-primary-container/20 md:col-span-1 disabled:opacity-50 disabled:cursor-not-allowed h-[44px]"
        >
          {isPending ? (
             <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Deploy
            </>
          )}
        </button>
      </form>
      
      {state?.message && (
        <div className={`px-8 py-3 text-sm font-medium border-t ${state.success ? 'bg-secondary-container/20 text-secondary border-secondary/20' : 'bg-error-container/20 text-error border-error/20'}`}>
          {state.message}
        </div>
      )}
    </section>
  );
}
