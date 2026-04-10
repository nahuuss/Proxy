# Fix: SignalR — Forzar longPolling via Negotiate Intercept V47
**Fecha:** 2026-03-18
**Archivo:** `wrapper-appProxy.js` (V47 — App Proxy Edition)

---

## Contexto

El componente `EDSASecurity.js` de la aplicación interna usa SignalR para recibir los permisos del usuario vía Hub. Estos permisos controlan qué botones de acción (editar, eliminar, etc.) son visibles en las grillas de la aplicación.

En el túnel **Cloudflare** los botones aparecían correctamente. En el túnel **App Proxy** solo aparecían 2 de 5 botones.

---

## Diagnóstico — Etapa 1: HB corrompe WebSocket de SignalR

### Síntoma
```
19:40:15  GET /signalr/connect?transport=webSockets
19:41:10  [HB] Shield Active p/ /signalr/connect?transport=webSockets
          → Proxy inyecta: HTTP 200 chunked + HTML
          → Esto CORROMPE el hub SignalR activo
```

### Fix Etapa 1 (aplicado en sesión anterior)
Excluir SignalR y WebSocket upgrades del sistema de Heartbeat:

```javascript
const isSignalR = urlPart.includes('/signalr/');
const isWsUpgrade = (req.headers['upgrade'] || '').toLowerCase() === 'websocket';
const hbEligible = !isStatic && !req.headers['x-requested-with']
                 && !isGeneration && !isSignalR && !isWsUpgrade;
```

### Resultado Etapa 1
El HB dejó de corromper el WebSocket. Pero los botones **seguían sin aparecer**.

---

## Diagnóstico — Etapa 2: App Proxy bufferiza el stream SSE

### Síntoma (nuevo)
Después de aplicar Fix Etapa 1, SignalR caía a `serverSentEvents` (SSE) como fallback. El negotiate devolvía un `ConnectionToken` válido. La conexión SSE respondía 200 OK. Pero los eventos del hub NUNCA llegaban al browser.

### Causa raíz
App Proxy (Microsoft Azure AD Application Proxy) bufferiza las respuestas SSE antes de entregarlas al browser — **igual que bufferiza el HTML chunked del HB**. El hub de SignalR envía los permisos como eventos SSE, pero App Proxy los retiene en buffer. El browser nunca los recibe → `EDSASecurity.js` no carga permisos → botones no se renderizan.

Cloudflare NO bufferiza (streaming nativo) → por eso funciona allá.

### Comparación de transportes SignalR

| Transporte | App Proxy | Resultado |
|---|---|---|
| WebSocket | ❌ Rechaza upgrade | Conexión queda abierta sin datos |
| Server-Sent Events (SSE) | ❌ Bufferiza stream | Eventos nunca llegan al browser |
| longPolling | ✓ Requests discretos | Cada poll completa normalmente |

---

## Fix Etapa 2: Intercept de `/signalr/negotiate`

### Estrategia
Interceptar la respuesta JSON de `/signalr/negotiate` y modificarla para que el cliente SignalR **nunca intente WebSocket ni SSE**, usando solo longPolling.

```javascript
// En makeRequest → handler de respuesta (antes de FILE GUARD)
if (urlPart.startsWith('/signalr/negotiate')) {
    const nChunks = [];
    pRes.on('data', c => nChunks.push(c));
    pRes.on('end', () => {
        try {
            const raw = Buffer.concat(nChunks).toString('utf8');
            const obj = JSON.parse(raw);
            obj.TryWebSockets = false;         // evita intento WebSocket
            obj.TransportConnectTimeout = 5;   // timeout rápido si intenta SSE
            const modified = JSON.stringify(obj);
            const rh = { ...pRes.headers };
            delete rh['content-encoding'];
            delete rh['content-length'];
            if (!res.headersSent) res.writeHead(sCode, rh);
            res.end(modified);
            log('[SIGNALR] Negotiate interceptado → TryWebSockets=false (longPolling)');
        } catch (e) {
            // fallback: pasar respuesta original
            pRes.pipe(res);
        }
        doneRequest('negotiate');
    });
    return; // no continuar con flujo normal
}
```

### Negotiate JSON — Antes vs Después

```json
// Original del servidor
{
  "Url": "/signalr",
  "ConnectionToken": "abc123...",
  "TryWebSockets": true,
  "ProtocolVersion": "1.5"
}

// Modificado por proxy
{
  "Url": "/signalr",
  "ConnectionToken": "abc123...",
  "TryWebSockets": false,         ← modificado
  "TransportConnectTimeout": 5,   ← agregado
  "ProtocolVersion": "1.5"
}
```

### Flujo SignalR post-fix

```
Browser → negotiate → proxy modifica → TryWebSockets=false
Browser → intenta SSE → TransportConnectTimeout=5s → timeout rápido
Browser → cae a longPolling automáticamente
Browser → GET /signalr/poll → request discreta → completa normalmente
Servidor → responde con eventos de permisos en el body del poll
Browser → EDSASecurity.js recibe permisos → botones se renderizan
```

---

## Resultado

- `/signalr/negotiate` en Network Tab muestra `TryWebSockets: false`
- Siguientes requests son `/signalr/poll` (longPolling) en lugar de `/signalr/connect?transport=serverSentEvents`
- Cada poll completa normalmente (no queda abierta indefinidamente)
- `EDSASecurity.js` recibe los eventos de permisos
- Los 5 botones de acción aparecen correctamente en grillas

---
*Parte del historial de contexto del proyecto Serena ART — App Proxy Wrapper V47.*
