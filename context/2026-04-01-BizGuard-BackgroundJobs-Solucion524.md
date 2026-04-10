# BizGuard v1.4.0 - Implementación de Background Jobs y Solución 524

Fecha: 2026-04-01
Estado: En curso

## Resumen técnico
Para procesos que exceden los 100 segundos (límite de Cloudflare), el Heartbeat Shield tradicional (envío de espacios/chunks) no siempre es suficiente o compatible con Redirects. 

Se implementa el patrón **Background Job (Polling)**:
1. BizGuard detecta una URL en `hbForceUrls`.
2. Si es una petición pesada, BizGuard responde inmediatamente con una página de polling (`renderBgJobPage`).
3. El proceso con el backend continúa en el servidor BizGuard de forma aislada.
4. BizGuard captura el resultado del backend (status, headers, body) y lo guarda en el mapa `bgJobs`.
5. El cliente (navegador) recupera el resultado final (incluso si es una redirección) a través de la página de polling.

## Cambios en `proxy-server.ts`
- Se activa la entrega inmediata de `renderBgJobPage` para URLs forzadas.
- Se implementa la captura de respuesta (`status`, `headers`, `responseBody`) en el evento `end` de la respuesta del backend.
- Se habilita el soporte para que el sistema de polling maneje redirecciones `302` del backend original.

## Notas sobre 404
Se investigará la reescritura de URLs en el body para asegurar que recursos con caracteres especiales (como espacios) no se vean afectados por el reemplazo del host.
