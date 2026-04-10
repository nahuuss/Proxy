# Fix: Worker State + UI Rediseño con Task Sub-Rows V47
**Fecha:** 2026-03-18
**Archivo:** `wrapper-appProxy.js` (V47 — App Proxy Edition)

---

## Problema 1: Worker Siempre en TRABAJANDO

### Síntoma
Dashboard mostraba ambos workers en estado `TRABAJANDO` con elapsed de **107 minutos** incluso sin ninguna request activa del usuario. La columna "ÚLTIMA ACCIÓN" siempre mostraba `/signalr/connect?transport=`.

### Causa raíz
Las conexiones SignalR (`/signalr/connect?transport=serverSentEvents` o `transport=webSockets`) son **long-lived**: una vez abiertas, nunca terminan (no llaman a `res.on('finish')` ni `doneRequest()`). Se almacenaban en `activeRequests` de forma permanente. El timer de status buscaba la request más antigua en todo el Map → siempre encontraba la SSE/WS → worker nunca reportaba IDLE.

---

## Fix: Flag `isLongLived`

### Cambio en `activeRequests.set`

```javascript
activeRequests.set(reqId, {
    startTime,
    url: req.url,
    state: 'TRABAJANDO',
    hbEligible,
    isLongLived: isSignalR || isWsUpgrade,  // SSE/WS = conexiones persistentes
    method: req.method
});
```

### Cambio en `setInterval` (timer de status)

```javascript
setInterval(() => {
    // ... bytes reporting ...

    // Construir array de todas las tasks activas
    const tasks = [];
    for (const [, r] of activeRequests) {
        const sec = Math.floor((now - r.startTime) / 1000);
        tasks.push({ url, method, elapsed, elapsedSec, state, isLongLived, hbEligible });
    }

    // Estado del worker: solo considerar requests NO long-lived
    const relevant = tasks.filter(t => !t.isLongLived);
    if (relevant.length === 0) {
        sendStatus('IDLE', '0s', '-', tasks);  // IDLE aunque haya SSE abiertas
        return;
    }

    const oldest = relevant.reduce((a, b) => b.elapsedSec > a.elapsedSec ? b : a);
    // ... calcular hbStatus basado en oldest ...
    sendStatus(oldest.state, formatTime(maxSec), hbStatus, tasks);
}, 1000);
```

### Cambio en `doneRequest`

```javascript
function doneRequest(_action) {
    activeRequests.delete(reqId);
    const relevant = [...activeRequests.values()].filter(r => !r.isLongLived);
    if (relevant.length === 0) {
        // Pasar las conexiones SSE/WS restantes como tareas visibles
        const remaining = [...activeRequests.values()].map(r => ({
            url: r.url, method: r.method,
            elapsed: formatTime(...),
            state: r.state, isLongLived: r.isLongLived
        }));
        sendStatus('IDLE', '0s', '-', remaining);
    }
}
```

### Cambio en `sendStatus` — nueva firma

```javascript
// Antes
function sendStatus(state, lastAction, elapsed = '0s', hbStatus = '-') { ... }

// Después
function sendStatus(state, elapsed = '0s', hbStatus = '-', tasks = []) {
    process.send({ type: 'status', data: { state, totalReqs, elapsed, hbStatus, tasks } });
}
```

---

## Problema 2: Dashboard Ocultaba Tasks Individuales

### Síntoma
El dashboard solo mostraba la request con **mayor elapsed**. Con múltiples requests concurrentes (p.ej. SSE abierta + request normal), solo se veía una. La columna "ÚLTIMA ACCIÓN" mostraba la URL de la SSE sin contexto.

---

## Fix: UI Redesign con Task Sub-Rows

### Nuevas constantes

```javascript
const MAX_TASKS_PER_WORKER = 3;
const WORKER_SECTION_ROWS = numWorkers * (1 + MAX_TASKS_PER_WORKER); // 2 * 4 = 8 filas
```

### Estructura del dashboard (por worker)

```
┃ PID     ┃ ESTADO  ┃ PETICIONES ┃ TIEMPO PROC ┃ HB AppProxy ┃ ACTIVAS          ┃
┃  ↳ GET  4s    /ABMTramiteMedico.aspx                              [REQ] ┃
┃  ↳ GET  120s  /signalr/connect?transport=webSockets&client...    [WS]  ┃
┃                                                                          ┃
```

- **Fila principal**: muestra PID, ESTADO (solo de relevant tasks), TIEMPO PROCESO, HB
- **Col ACTIVAS**: `LIBRE | 2 sse` o `1 req | 1 sse`
- **Task sub-rows**: una por cada request activa (hasta `MAX_TASKS_PER_WORKER`)
  - Requests normales: color amarillo
  - Conexiones long-lived (SSE/WS): color gris con tag `[SSE]` o `[WS]`
- **Filas vacías**: mostradas cuando hay menos tasks que `MAX_TASKS_PER_WORKER`

### Tag de conexión long-lived

```javascript
const liveTag = (t.url || '').toLowerCase().includes('websocket') ? ' [WS] ' : ' [SSE]';
const tag = t.isLongLived ? liveTag : '      ';
```

### Fórmulas de layout actualizadas

Todas las fórmulas de posicionamiento de secciones reemplazaron `numWorkers` con `WORKER_SECTION_ROWS`:

| Variable | Antes | Después |
|---|---|---|
| `getDynamicMaxLogs` | `rows - (numWorkers + PING_BOX_ROWS + 13)` | `rows - (WORKER_SECTION_ROWS + PING_BOX_ROWS + 13)` |
| `pingStartRow` | `5 + numWorkers` | `5 + WORKER_SECTION_ROWS` |
| `startLine` (logs) | `7 + numWorkers + PING_BOX_ROWS` | `7 + WORKER_SECTION_ROWS + PING_BOX_ROWS` |
| `footerRow` | `9 + numWorkers + PING_BOX_ROWS + MAX_LOGS` | `9 + WORKER_SECTION_ROWS + PING_BOX_ROWS + MAX_LOGS` |

---

## Resultado

- Workers muestran IDLE correctamente cuando solo quedan conexiones SSE/WS abiertas
- Dashboard muestra filas individuales por task con elapsed propio
- Conexiones long-lived se distinguen visualmente (gris + tag `[WS]`/`[SSE]`)
- Con el fix de SignalR negotiate, las conexiones WS dejan de acumularse (SignalR usa longPolling)

---
*Parte del historial de contexto del proyecto Serena ART — App Proxy Wrapper V47.*
