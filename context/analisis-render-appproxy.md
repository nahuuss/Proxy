# Análisis: Botones de Edición No Visibles en App Proxy

**Fecha:** 2026-03-18
**Síntoma:** En el túnel Cloudflare (`core.nathium.com.ar`) se muestran 5 botones de acción en grillas (email, editar, flag, eliminar, otro). En el túnel App Proxy (`core2-serenaseguros.msappproxy.net`) solo aparecen 2 (email, lupa).

---

## Causa Raíz Identificada — Heartbeat sobre WebSocket de SignalR

### Flujo normal esperado (SignalR WebSocket)
```
Browser → App Proxy Cloud → Connector → Wrapper(8080) → App Interna(443)
  GET /signalr/connect?transport=webSockets
  → HTTP Upgrade: websocket
  → App Proxy RECHAZA el upgrade (App Proxy no soporta WebSocket nativo)
  → SignalR cae back a Server-Sent Events (SSE) → funciona
```

### Lo que pasaba en el wrapper (BUG)
```
19:40:15  GET /signalr/connect?transport=webSockets  ← conexión abierta
19:40:17  SignalR ya usó SSE como fallback (exitoso)
          PERO la conexión WebSocket sigue abierta en el wrapper
19:41:10  [HB] Shield Active p/ /signalr/connect?transport=webSockets
          ← 55 segundos después, el HB dispara y envía:
          HTTP/1.1 200 OK
          Content-Type: text/html
          Transfer-Encoding: chunked
          <!-- Anti-Timeout Pulse -->
```

Esto corrompe la conexión TCP que el App Proxy Connector tenía reservada para el WebSocket. El Connector puede reaccionar cerrando el canal o enviando la respuesta HTML al cliente como si fuera datos de la conexión SignalR.

### Consecuencia en la aplicación
El script `EDSASecurity.js` (cargado en la página) usa el hub SignalR para:
1. Autenticar/verificar permisos del usuario en tiempo real post-carga
2. Enviar al cliente qué botones debe mostrar según rol

Si SignalR falla/se corrompe → el módulo de seguridad no recibe los permisos → los botones de editar/eliminar NO se renderizan (quedan ocultos por seguridad por defecto).

---

## Por qué NO afecta a Cloudflare

Cloudflare Tunnel **sí soporta WebSocket**. La conexión WebSocket se upgradeea exitosamente en 1-2 segundos, y el evento `res.on('close', ...)` del wrapper limpia el timer HB antes de que llegue a los 55s. Por eso los botones siempre se muestran en Cloudflare.

---

## Fix Aplicado

En `wrapper-appProxy.js`, se excluyen SignalR y WebSocket de la elegibilidad de HB:

```js
// Antes:
const hbEligible = !isStatic && !req.headers['x-requested-with'] && !isGeneration;

// Después:
const isSignalR = urlPart.includes('/signalr/');
const isWsUpgrade = (req.headers['upgrade'] || '').toLowerCase() === 'websocket';
const hbEligible = !isStatic && !req.headers['x-requested-with'] && !isGeneration && !isSignalR && !isWsUpgrade;
```

Con este cambio:
- Las conexiones `/signalr/*` pasan directo al backend sin HB
- Cualquier intento de WebSocket Upgrade también queda excluido
- App Proxy rechazará el WebSocket naturalmente → SignalR hace fallback a SSE → hub funciona → permisos llegan → botones se renderizan

---

## Otros hallazgos del log (no críticos)

| Recurso | Status | Observación |
|---|---|---|
| `GET /` (repetido) | 200 | Health check del App Proxy Connector, esperado |
| `/css/uikit.min.css` | 404 | Recurso de la página de login de App Proxy, no de la app |
| `/Images/loading2` | 404 | Ídem, spinner del portal de App Proxy |
| `/App_Themes/OmintTheme/Web/Menu.css` | 404 | Theme CSS de otro skin no activo, no causa el problema |
| `/signalr/negotiate` | 200 ✓ | Negociación SSE exitosa |
| `/signalr/start?transport=serverSentEvents` | 200 ✓ | SSE conectado |
| `/signalr/connect?transport=webSockets` | Sin respuesta | WS bloqueado por App Proxy (esperado) |

---

## Latencia del túnel

La latencia del App Proxy (tráfico vía Microsoft cloud) agrega ~20-50ms por request, visible en los timestamps del log:

```
GET /RYF/Recupero/GestionRecuperos.aspx   → 300ms (19:40:07.233 → 19:40:07.533)
POST /RYF/Recupero/GestionRecuperos.aspx  → 320ms (19:40:11.541 → 19:40:11.861)
```

La latencia NO es la causa directa del problema de render. La causa es el HB sobre SignalR.

---

## Estado actual post-fix

- `isSignalR` excluye todos los endpoints `/signalr/*` del HB
- `isWsUpgrade` excluye cualquier WebSocket Upgrade genérico
- SignalR debe conectar via SSE sin interferencia y entregar permisos
- Los botones de edición/eliminar deben renderizarse correctamente
