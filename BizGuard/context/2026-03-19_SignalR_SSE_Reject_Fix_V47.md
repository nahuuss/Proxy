# Fix: SignalR SSE Reject — Fallback inmediato a longPolling V47
**Fecha:** 2026-03-19
**Archivo:** `wrapper-appProxy.js` (V47 — App Proxy Edition)

---

## Contexto

Después del fix anterior (negotiate intercept `TryWebSockets: false`), los botones de acción en las grillas (`linkAction-cell`) seguían sin renderizarse en App Proxy. En localhost:8081 y Cloudflare sí aparecían.

---

## Diagnóstico

### Por qué el negotiate fix no fue suficiente

Con `TryWebSockets: false`, el cliente SignalR (ASP.NET SignalR 1.x) aún intenta **SSE como primer transporte** antes de caer a longPolling. El flujo:

```
negotiate → TryWebSockets: false (✓ wrapper modifica)
→ SignalR intenta SSE: GET /signalr/connect?transport=serverSentEvents
  → App Proxy BUFFERIZA la respuesta SSE
  → Browser nunca recibe el mensaje "init" de SignalR
  → Espera hasta TransportConnectTimeout: 5s
  → Agota timeout → intenta longPolling
→ SignalR intenta longPolling: GET /signalr/connect?transport=longPolling
  → Debería funcionar... pero la demora de 5s puede causar race conditions
```

El problema: la espera de 5s en SSE (timeout del cliente) + posibles issues con el connect de longPolling.

### Por qué los elementos no se renderizan

`EDSASecurity.js` inserta dinámicamente el contenido de `<td class="linkAction-cell">` **después de recibir los permisos del usuario vía SignalR hub**. Si los permisos nunca llegan → `<td>` vacío.

Confirmado por la documentación de Microsoft App Proxy:
> *"Link translation isn't supported for hard-coded internal URLs generated through JavaScript"*

App Proxy NO strippea el HTML — simplemente EDSASecurity.js nunca recibe los permisos.

### Investigación: Configuración App Proxy

Desde la configuración mostrada en screenshots:
- **Backend Application Timeout: Long** (180s) — OK para longPolling de ~30s
- **Translate URLs in headers/body: UNCHECKED** — App Proxy no modifica HTML (el wrapper lo hace)
- App Proxy bufferiza SSE igual que chunked HTML → eso es un comportamiento inherente, no configurable

Documentación oficial App Proxy:
- **URL Translation**: Solo aplica a `a href`, `img src`, etc. en HTML/CSS estáticos. NO a JavaScript dinámico.
- **CORS**: Si las XHR requests (como `/signalr/poll`) reciben 302 redirect a `login.microsoftonline.com` cuando el token expira → CORS falla → SignalR no recibe permisos.

---

## Fix: Rechazar SSE inmediatamente con HTTP 503

### Estrategia

En lugar de esperar 5s para que expire `TransportConnectTimeout`, el wrapper **rechaza el SSE con un 503** de inmediato. App Proxy entrega los errores HTTP completos sin buffering (solo bufferiza respuestas streaming). SignalR ve el 503 y cae directamente a longPolling.

```javascript
const makeRequest = (path) => {
    // FIX SSE: App Proxy bufferiza server-sent events igual que chunked HTML →
    // el cliente SignalR nunca recibe el mensaje "init" y espera hasta TransportConnectTimeout.
    // Rechazar SSE con 503 inmediatamente: App Proxy entrega errores HTTP completos sin buffering.
    // SignalR ve el 503 y cae directo a longPolling (requests HTTP discretos que completan normalmente).
    if (path.toLowerCase().includes('/signalr/connect') && path.toLowerCase().includes('transport=serversentevents')) {
        if (!res.headersSent) res.writeHead(503, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-cache' });
        res.end('SSE transport not supported via this proxy');
        log(`[SIGNALR] SSE rechazado (503) → SignalR debe caer a longPolling`);
        doneRequest('sse-reject');
        return;
    }
    // ... continúa con la request normal
```

### Flujo post-fix

```
Browser → negotiate → wrapper modifica → TryWebSockets: false
Browser → GET /signalr/connect?transport=serverSentEvents
  → Wrapper devuelve 503 INMEDIATAMENTE (completo, sin streaming)
  → App Proxy entrega el 503 al browser de inmediato
  → SignalR: "SSE falló" → siguiente transporte
Browser → GET /signalr/connect?transport=longPolling (o /signalr/poll)
  → Wrapper proxy → backend → responde con JSON de permisos
  → App Proxy entrega respuesta completa sin buffering
  → EDSASecurity.js recibe permisos → renderiza botones ✓
```

### Dashboard log

```
[SIGNALR] SSE rechazado (503) → SignalR debe caer a longPolling
```

---

## Comportamiento en otros entornos

| Entorno | Antes del fix | Después del fix |
|---|---|---|
| App Proxy | SSE abierta 5s sin datos → timeout → longPolling (tardío) | SSE falla 503 instantáneo → longPolling inmediato ✓ |
| Cloudflare | SSE funciona directo (Cloudflare no bufferiza) | SSE falla 503 → longPolling (funcional, pero menos eficiente) |
| localhost:8081 | SSE funciona directo | SSE falla 503 → longPolling (funcional) |

**Nota:** En Cloudflare y localhost el impacto es mínimo — SignalR funcionará bien con longPolling en cualquier entorno.

---

## Stack de fixes SignalR (orden de aplicación)

1. **V47 sesión anterior**: Excluir SignalR/WS de `hbEligible` → HB no corrompe el hub
2. **V47 sesión anterior**: Intercept `/signalr/negotiate` → `TryWebSockets: false` → evita WS
3. **V47 esta sesión**: Rechazar `/signalr/connect?transport=serverSentEvents` con 503 → longPolling inmediato
4. **Resultado**: Los 5 botones de acción deben renderizarse correctamente vía App Proxy

---

## Configuración App Proxy recomendada

| Setting | Valor recomendado | Motivo |
|---|---|---|
| Backend Application Timeout | Long (180s) | LongPolling puede tener polls de hasta 30s |
| Translate URLs in headers | No | El wrapper maneja reescritura |
| Translate URLs in application body | No | El wrapper maneja reescritura |
| Use Http-Only Cookie | No cambia | No afecta XHR same-origin |

---
*Parte del historial de contexto del proyecto Serena ART — App Proxy Wrapper V47.*
