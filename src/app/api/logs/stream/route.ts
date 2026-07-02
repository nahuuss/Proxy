import { requireAdminRouteAccess } from "@/lib/admin-route";
import { readProxySyncPayload } from "@/lib/proxy-sync-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAdminRouteAccess();
  if (unauthorized) {
    return unauthorized;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": open\n\n"));

      const onLog = (data: any) => {
        try {
          const msg = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(msg));
        } catch {}
      };

      let lastLogsCount = 0;
      const syncInterval = setInterval(() => {
        const payload = readProxySyncPayload();
        if (payload?.logs && Array.isArray(payload.logs)) {
          if (payload.logs.length > lastLogsCount) {
            const newLogs = payload.logs.slice(lastLogsCount);
            newLogs.forEach((entry: any) => onLog(entry));
            lastLogsCount = payload.logs.length;
          } else if (payload.logs.length < lastLogsCount) {
            lastLogsCount = payload.logs.length;
            payload.logs.forEach((entry: any) => onLog(entry));
          }
        }
      }, 500);

      const hbInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {}
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
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
