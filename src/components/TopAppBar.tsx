import { User } from "lucide-react";

export function TopAppBar({ email }: { email?: string | null }) {
  return (
    <header className="flex justify-between items-center w-full px-5 h-12 sticky top-0 z-40 bg-background border-b border-outline-variant/10">
      <div className="flex items-center gap-4">
        <h1 className="font-headline text-xl font-bold tracking-tighter text-on-surface">BizGuard Platform</h1>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-secondary-container/10 border border-secondary-container/20">
          <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_var(--color-secondary)]"></div>
          <span className="font-label text-[10px] font-bold text-secondary tracking-widest uppercase">ONLINE</span>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 pl-2">
          <div className="text-right">
            <p className="text-xs font-bold text-on-surface leading-none">{email || "Local Admin"}</p>
            <p className="text-[10px] text-on-surface-variant">Session: Active</p>
          </div>
          <div className="w-8 h-8 rounded-full border border-outline-variant/30 bg-gradient-to-br from-surface-container-highest to-surface-container-low flex items-center justify-center text-on-surface shadow-[0_6px_18px_rgba(0,0,0,0.22)] overflow-hidden">
            <User className="w-4 h-4" strokeWidth={2.2} />
          </div>
        </div>
      </div>
    </header>
  );
}
