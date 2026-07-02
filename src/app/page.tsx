import { redirect } from "next/navigation";
import { getConnectors } from "@/lib/connectors";
import { AddConnectorForm } from "@/components/AddConnectorForm";
import { DashboardClient } from "@/components/DashboardClient";
import { PingPanel } from "@/components/PingPanel";
import { X } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { getAdminAccessState } from "@/lib/admin-access";

// BizGuard V1.2.1 - Core Refresh
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const params = await searchParams;
  const isAdding = params?.action === "add";
  
  const { hasAccess } = await getAdminAccessState();
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const forwardedProto = headersList.get("x-forwarded-proto") || "";
  const dashboardProtocol = host.includes("localhost") || host.includes("127.0.0.1")
    ? "http"
    : ((forwardedProto === "http" || forwardedProto === "https") ? forwardedProto : "https");

  if (!hasAccess) {
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
      <DashboardClient
        initialConnectors={rawConnectors}
        dashboardHost={host}
        dashboardProtocol={dashboardProtocol}
      />
      
    </div>
  );
}
