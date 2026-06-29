# Monitoreo y Reset Manual de Memoria en Dashboard

* **Fecha**: 2026-06-24
* **Objetivo**: Implementar un panel de control y métricas específicas en la interfaz de BizGuard para monitorear el consumo de memoria del proceso de Node.js, ver el tiempo restante hasta el siguiente ciclo de liberación y compactación de base de datos, y permitir la ejecución manual inmediata de este ciclo.

---

## Archivos Creados/Modificados

* [src/lib/db.ts](file:///e:/Desarrollo/BizGuard/src/lib/db.ts) (Modificado)
* [src/lib/proxy-manager.ts](file:///e:/Desarrollo/BizGuard/src/lib/proxy-manager.ts) (Modificado)
* [src/contexts/StatsContext.tsx](file:///e:/Desarrollo/BizGuard/src/contexts/StatsContext.tsx) (Modificado)
* [src/components/DashboardClient.tsx](file:///e:/Desarrollo/BizGuard/src/components/DashboardClient.tsx) (Modificado)
* [src/components/GlobalMetricsSummary.tsx](file:///e:/Desarrollo/BizGuard/src/components/GlobalMetricsSummary.tsx) (Modificado)
* [src/app/api/memory/reset/route.ts](file:///e:/Desarrollo/BizGuard/src/app/api/memory/reset/route.ts) (Creado)

---

## Decisiones Técnicas

### 1. Reprogramación Dinámica de la Compactación (`db.ts`)
Se reemplazó el intervalo estático de NeDB por una estructura de retardo basada en `setTimeout` con reprogramación activa (`scheduleNextCompaction`). Esto permite que al forzar manualmente la compactación y recolección de basura, la cuenta regresiva de 30 minutos se reinicie desde ese instante, evitando ejecuciones superpuestas. La marca de tiempo de la última compactación se almacena en el objeto `global` para evitar reinicios por recargas en caliente durante el desarrollo.

### 2. Medición Exclusiva de Memoria del Proyecto (`proxy-manager.ts`)
En lugar de mostrar únicamente el porcentaje de memoria RAM global del sistema operativo (que no refleja el estado del microservicio), se expuso la métrica `nodeMemUsage` calculada mediante `process.memoryUsage().rss`. Esta propiedad representa el Resident Set Size (el consumo real del proceso de Node.js en memoria del sistema en MB).

### 3. Exposición de API y Manejo en Contexto (`route.ts` & `StatsContext.tsx`)
Se introdujo el endpoint de tipo `POST` `/api/memory/reset` que dispara el método `forceMemoryReset()`. Las marcas de tiempo de reinicio de memoria y el consumo en MB de Node se inyectaron al flujo de Server-Sent Events (SSE) mapeándolas al estado global del cliente en `StatsContext`.

### 4. Interfaz Premium de Control y Grilla de 6 Canales (`DashboardClient.tsx` & `GlobalMetricsSummary.tsx`)
* **Barra de Control**: Ubicada al lado del título "BizGuard Performance", incluye el tiempo restante en formato `MM:SS` para el próximo reset automático y un botón **"Reset"** interactivo que hace una llamada asíncrona al backend y refresca las métricas inmediatamente.
* **Métricas Simétricas (3x2)**: Se amplió la grilla para acomodar las nuevas tarjetas de **Node.js RAM** (con una barra de progreso que toma como base de escala visual 512 MB de Heap) y **Último Reset** (mostrando el timestamp en formato local `HH:MM:SS`).

---

## Instrucciones de Uso y Verificación

### Proceso de Despliegue
Para empaquetar de forma limpia y generar el build stand-alone con los nuevos módulos:
1. Asegurarse de que no haya procesos de Node bloqueando los archivos de desarrollo.
2. Ejecutar el script de despliegue desde PowerShell:
   ```powershell
   .\preparar-despliegue.ps1
   ```

### Verificación Funcional
1. Acceder al panel de administración de BizGuard.
2. Ubicar la sección **BizGuard Performance** en la parte inferior derecha:
   * Validar que al lado del título se muestre la cuenta regresiva sincronizada (iniciando en `30:00` y descendiendo segundo a segundo).
   * Validar la existencia de la tarjeta **Node.js RAM** mostrando un valor en megabytes (e.g. `264.5 MB`) y la tarjeta **Último Reset** con la hora exacta del último ciclo.
   * Hacer clic en el botón **"Reset"**: el botón cambiará temporalmente a **"Limpiando..."** y al finalizar se actualizará el timestamp de "Último Reset" a la hora actual y la cuenta regresiva volverá a `30:00`.
