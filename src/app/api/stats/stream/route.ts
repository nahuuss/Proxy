import { proxyManager } from "@/lib/proxy-manager";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Enviar pre-mensaje para forzar apertura del stream en algunos navegadores/proxies
      controller.enqueue(encoder.encode(": open\n\n"));

      const onStats = (data: any) => {
        try {
          const msg = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(msg));
        } catch (e) { }
      };

      // Heartbeat para mantener conexión abierta cada 8 segundos
      const hbInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch (e) { }
      }, 8000);

      // Enviar estado inicial
      try {
        onStats(proxyManager.getStats());
      } catch(e) {}

      // Poll sync.json para soportar multi-worker
      let lastStatsStr = "";
      const syncInterval = setInterval(() => {
        try {
          const fp = path.join(process.cwd(), 'data', 'sync.json');
          if (fs.existsSync(fp)) {
            const payload = JSON.parse(fs.readFileSync(fp, 'utf8'));
            if (payload.stats) {
              const currentStr = JSON.stringify(payload.stats);
              if (currentStr !== lastStatsStr) {
                onStats(payload.stats);
                lastStatsStr = currentStr;
              }
            }
          }
        } catch(e) {}
      }, 500);

      (controller as any)._cleanup = () => {
        clearInterval(hbInterval);
        clearInterval(syncInterval);
      };
    },
    cancel(controller) {
      if ((controller as any)._cleanup) {
        (controller as any)._cleanup();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
