# Documento de Implementación: BizGuard
**Fecha:** 2026-03-20
**Plataforma:** BizGuard (Anteriormente Proxy Platform Engine)

## Resumen de Cambios

### 1. Renombrado y Rebranding a BizGuard
- **Metadatos y UI:** Se actualizó `layout.tsx` y `page.tsx` para reflejar el nuevo nombre: *BizGuard | Enterprise Proxy*.
- **Configuración Básica:** Actualizaciones en `package.json` (`"name": "bizguard"`) y `README.md` detallando las nuevas especificaciones del proyecto.
- **Empaquetado:** El script `preparar-despliegue.ps1` fue modificado para generar el binario precompilado en el directorio `dist-bizguard`, reemplazando el antiguo `dist-proxy-engine`.

### 2. Estabilización para Next.js Standalone (Modo Multi-Worker)
Al levantar el paquete en producción con `server.js`, Next.js ejecuta workers secundarios para el renderizado, lo cual causaba colisiones graves con nuestra arquitectura que corre en el mismo proceso:
- **Solución EADDRINUSE:** Se capturó y silenció el log de colisión de puertos en `proxy-manager.ts` para que, cuando un worker secundario intente levantar el Proxy TCP en puertos ya escuchados (8080, 8081), este aborte silenciosamente y deje al Worker Principal hacerse cargo del tráfico.
- **Solución Dificultad Concurrente (NeDB ENOENT):** Al guardar o cargar configuraciones y conectores, múltiples workers querían escribir el archivo `.db` simultáneamente. Implementé una función de reintento (`loadWithRetry`) y eliminé el `autoload` estricto en `.db.ts`, logrando que la aplicación maneje gracefully bloqueos de archivo durante 3 intentos con 500ms de espera.

### 3. Sincronización Inter-Proceso (IPC) para Métricas y Logs SSE
- **El Problema:** El Worker Principal maneja el tráfico del Proxy TCP (actualizando la memoria), pero el Dashboard UI que lee las métricas en streaming pedía datos directamente al Worker Secundario (el cual veía 0 tráfico y 0 logs).
- **La Solución (sync.json):** El Worker Principal guarda un snapshot dinámico (`stats` y últimos 200 `logs`) en `data/sync.json` atómicamente cada 500ms. Las rutas de Edge API de Next.js (`/api/stats/stream` y `/api/logs/stream`) implementan "polling" (lectura recurrente sin candado) sobre `sync.json` emitiendo estos datos por red sin problemas de candados Multi-Worker. 

### 4. Bypass SSO para Puerto de Administración Local
Se ha desarrollado un Bypass en el flujo OAuth (Microsoft Entra ID) exclusivo para los hosts locales:
- Si el origen es `localhost:3000` o `127.0.0.1:3000` (`auth.ts` / `page.tsx`), la validación de Entra ID se salta y se ingresa en modo de consola administrativa directamente.
- Si se ingresa desde el subdominio público (ej: `https://core.bizguard...`), se fuerza obligatoriamente el Microsoft Entra ID SSO para la validación End-to-End Zero-Trust.
