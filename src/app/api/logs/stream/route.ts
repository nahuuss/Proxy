import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": open\n\n"));

      const onLog = (data: any) => {
        try {
          const msg = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(msg));
        } catch (e) { }
      };

      // Poll sync.json para soportar multi-worker
      let lastLogsCount = 0;
      const syncInterval = setInterval(() => {
        try {
          const fp = path.join(process.cwd(), 'data', 'sync.json');
          if (fs.existsSync(fp)) {
            const payload = JSON.parse(fs.readFileSync(fp, 'utf8'));
            if (payload.logs && Array.isArray(payload.logs)) {
              if (payload.logs.length > lastLogsCount) {
                // Emitir nuevos logs
                const newLogs = payload.logs.slice(lastLogsCount);
                newLogs.forEach((l: any) => onLog(l));
                lastLogsCount = payload.logs.length;
              } else if (payload.logs.length < lastLogsCount) {
                // El buffer rotó
                lastLogsCount = payload.logs.length;
                // Emitir todos para resincronizar rápido
                payload.logs.forEach((l: any) => onLog(l));
              }
            }
          }
        } catch(e) {}
      }, 500);

      const hbInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch (e) { }
      }, 15000);

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
