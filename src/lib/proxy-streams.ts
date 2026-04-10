import { NextRequest, NextResponse } from "next/server";

export function createHeartbeatStream(originalStream: ReadableStream | null, onFinish?: () => void) {
  const encoder = new TextEncoder();
  let heartbeatInterval: NodeJS.Timeout;
  
  return new ReadableStream({
    async start(controller) {
      // 1. Enviar preámbulo HTML para visualización inmediata si es una navegación
      controller.enqueue(encoder.encode('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="loader" style="font-family: sans-serif; padding: 20px;"><h3>⌛ Procesando solicitud...</h3><p>El servidor está generando los datos, por favor espere.</p></div><!-- '));

      // 2. Iniciar latidos (espacios en blanco ocultos en el comentario HTML)
      heartbeatInterval = setInterval(() => {
        controller.enqueue(encoder.encode(" "));
      }, 15000);

      if (originalStream) {
        const reader = originalStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            // Cuando llegan datos reales, podríamos cerrar el comentario y enviar el contenido
            // Pero en el sistema del original, el latido se usa para DESCARGAS que luego activan un Blob
            // Para navegación normal, el latido suele ser un compromiso entre UX y timeouts.
            controller.enqueue(value);
          }
        } finally {
          reader.releaseLock();
        }
      }
    },
    cancel() {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (onFinish) onFinish();
    }
  });
}
