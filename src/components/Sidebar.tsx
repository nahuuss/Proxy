import Link from "next/link";
import { Terminal, Plus, LayoutDashboard, LogOut } from "lucide-react";

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full flex flex-col py-6 border-r border-outline-variant/15 bg-background w-48 z-50">
      <div className="px-4 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-container flex items-center justify-center">
            <Terminal className="text-on-primary w-4 h-4" />
          </div>
          <div>
            <h2 className="font-headline text-sm font-bold tracking-tight text-on-surface">BizGuard</h2>
            <p className="font-body text-[10px] text-on-surface-variant uppercase tracking-widest">Active BizGuards</p>
          </div>
        </div>
        <Link href="/?action=add" className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-xs uppercase tracking-widest transition-transform active:scale-95 shadow-lg shadow-on-primary/20 hover:brightness-110">
          <Plus className="w-4 h-4" />
          Nuevo Conector
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        <Link href="/" className="flex items-center gap-4 px-4 py-3 text-[#2970FF] bg-surface-container-highest/50 border-r-4 border-[#2970FF] group transition-all duration-300">
          <LayoutDashboard className="w-5 h-5" />
          <span className="font-label text-xs font-medium uppercase tracking-widest">Dashboard</span>
        </Link>
      </nav>

      <div className="px-4 pt-8 border-t border-outline-variant/15">
        <Link href="/api/auth/signout" className="flex items-center gap-4 px-4 py-3 text-on-surface-variant hover:text-on-surface transition-all duration-300">
          <LogOut className="w-5 h-5" />
          <span className="font-label text-xs font-medium uppercase tracking-widest">Logout</span>
        </Link>
      </div>
    </aside>
  );
}
