import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });

export const metadata: Metadata = {
  title: "BizGuard Platform",
  description: "BizGuard Observational Engine",
};

import { StatsProvider } from "@/contexts/StatsContext";
import { Sidebar } from "@/components/Sidebar";
import { TopAppBar } from "@/components/TopAppBar";
import { auth } from "@/auth";
import { getSettings } from "@/lib/settings";
import { headers } from "next/headers";
import { CheckCircle2 } from "lucide-react";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSettings();
  let isBypass = settings.bypassAuth;
  
  const headersList = await headers();
  const host = headersList.get("host") || "";
  if (host.includes(":3000")) {
    isBypass = true;
  }

  const session = isBypass ? null : await auth();
  const showAdminUI = isBypass || !!session;

  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${spaceGrotesk.variable} antialiased flex min-h-screen bg-background text-on-surface`}>
        <StatsProvider>
          {showAdminUI ? (
            <>
              {/* Sidebar Global */}
              <Sidebar />
              
              {/* Área principal desplazada a la derecha por el Sidebar fijo (w-48 = 12rem) */}
              <main className="ml-48 flex-1 flex flex-col">
                <TopAppBar email={session?.user?.email} />
                
                {/* Contenido (Page) */}
                <div className="flex-1 overflow-auto">
                  {children}
                </div>
                
                <footer className="mt-auto px-5 py-2 border-t border-outline-variant/10 flex justify-between items-center bg-surface-container-low/30 backdrop-blur-sm">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Version:</span>
                      <span className="text-[10px] font-mono text-on-surface">v1.3.0-Enterprise</span>
                    </div>
                    <div className="flex items-center gap-2 text-secondary">
                      <CheckCircle2 className="w-[14px] h-[14px]" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">BizGuard Synced</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-on-surface-variant/50 italic">BizGuard Observational Engine • Operational Intelligence Layer</p>
                </footer>
              </main>
            </>
          ) : (
            <>{children}</>
          )}
        </StatsProvider>
      </body>
    </html>
  );
}
