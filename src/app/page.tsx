import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getConnectors } from "@/lib/connectors";
import { AddConnectorForm } from "@/components/AddConnectorForm";
import { DashboardClient } from "@/components/DashboardClient";
import { PingPanel } from "@/components/PingPanel";
import { X } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { getSettings } from "@/lib/settings";

// BizGuard V1.2.1 - Core Refresh
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const params = await searchParams;
  const isAdding = params?.action === "add";
  
  const settings = await getSettings();
  let isBypass = settings.bypassAuth;
  
  const headersList = await headers();
  const host = headersList.get("host") || "";
  if (host.includes(":3000")) {
    isBypass = true;
  }

  const session = isBypass ? null : await auth();
  
  if (!isBypass && !session) {
    redirect("/api/auth/signin");
  }

  const rawConnectors = await getConnectors();

  return (
    <div className="p-5 space-y-6">
      
      {/* Modal Overlay para Nuevo Conector */}
      {isAdding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-4xl relative">
             <Link href="/" className="absolute top-6 right-6 text-on-surface-variant hover:text-on-surface bg-surface-container-highest p-2 rounded-full z-10 transition-colors">
               <X className="w-5 h-5" />
             </Link>
             <AddConnectorForm />
          </div>
        </div>
      )}

      {/* Ping Panel */}
      <section className="bg-surface-container-low rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative p-6">
        <h2 className="font-headline text-lg font-bold text-on-surface tracking-tight mb-4 tracking-tighter uppercase">Cloudflare Network Status</h2>
        <PingPanel />
      </section>

      {/* Main Interactive Dashboard Area */}
      <DashboardClient initialConnectors={rawConnectors} />
      
    </div>
  );
}
