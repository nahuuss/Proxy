# Diagnóstico: linkAction-cell inconsistente en App Proxy V47
**Fecha:** 2026-03-19
**Archivo:** `wrapper-appProxy.js` (V47 — App Proxy Edition)

---

## Problema

Los botones de acción en grillas (`linkAction-cell`) se muestran diferente según el entorno:

| Entorno | Botones visibles |
|---|---|
| localhost:8081 | Editar, Cancelar, Eliminar (editor) |
| App Proxy | VerDetalle/zoom (viewer) — o vacío |

Inconsistencia adicional: **algunos siniestros** muestran botones correctos en App Proxy, otros no.

---

## Fixes aplicados (sesión 2026-03-19)

### Fix 1 — SSE reject 503 (EFECTIVO)

App Proxy bufferiza SSE igual que chunked HTML. El wrapper rechaza `/signalr/connect?transport=serverSentEvents` con HTTP 503, forzando a SignalR a caer directamente a longPolling sin esperar el timeout de 5 segundos.

**Resultado:** pasó de "ningún siniestro funciona" a "algunos funcionan, otros no".

### Fix 2 — Strip x-ms-* + Rewrite Referer/Origin (REVERTIDO — regresión)

**Hipótesis original:** App Proxy inyectaba headers de identidad Azure AD (`X-MS-Client-Principal-Name`, etc.) como request headers al backend. El backend EDSA los leía y aplicaba permisos diferentes.

**Lo que realmente ocurre:**
- Los headers `X-MS-Proxy-*` visibles en DevTools son **RESPONSE headers** — App Proxy los agrega al responder al browser, no al forwardear al backend.
- El único header `x-ms-*` que App Proxy envía al backend como **REQUEST header** es `x-ms-proxy`.
- El backend EDSA **necesita** `x-ms-proxy` para funcionar correctamente.

**Impacto del strip:** Pasar de "algunos funcionan" a "ninguno funciona" — regresión confirmada.

**Revertido en la misma sesión.** Estado actual del código:

```javascript
const headers = { ...req.headers, 'host': INTERNAL_TARGET, 'accept-encoding': 'identity' };
// Strip solo Cloudflare headers (cf-*)
// NOTA: x-ms-proxy es el único header x-ms-* que App Proxy envía al backend como request header
// y el backend EDSA lo necesita para funcionar — NO stripear x-ms-*
Object.keys(headers).forEach(h => {
    if (h.startsWith('cf-')) delete headers[h];
});
// Reescribir Referer y Origin (no-op cuando PUBLIC_HOST == INTERNAL_TARGET)
if (headers['referer']) {
    headers['referer'] = headers['referer'].replace(/https?:\/\/[^/]*/i, `https://${INTERNAL_TARGET}`);
}
if (headers['origin']) {
    headers['origin'] = `https://${INTERNAL_TARGET}`;
}
```

---

## Diagnóstico del transporte SignalR (logs DIAG-SR)

Se agregó logging diagnóstico que captura el body de todas las respuestas `/signalr/poll` y `/signalr/connect`.

### Flujo SignalR confirmado (funciona correctamente)

```
negotiate → TryWebSockets=false ✓
SSE connect → 503 inmediato ✓
longPolling connect → {"C":"d-2E25E87C-...","S":1,"M":[]} ✓  (S:1 = conexión OK)
start → {"Response":"started"} ✓
poll → {"C":"...","M":[]}  (cicla cada ~30s)
```

### Hallazgo crítico: M:[] siempre vacío

**Todos los polls, durante toda la sesión, en AMBAS conexiones (App Proxy y localhost), devuelven `"M":[]`.**

```
[DIAG-SR] poll 200 → {"C":"d-2E25E87C-Cc,0|EL,0|EM,1","M":[]}
[DIAG-SR] poll 200 → {"C":"d-2E25E87C-Cc,0|D:,0|EA,1","M":[]}
[DIAG-SR] poll 200 → {"C":"d-2E25E87C-Cc,0|EL,0|EM,2","M":[]}
... (nunca hay mensajes)
```

**Conclusión: el hub SignalR nunca pushea mensajes de permisos.** Esto aplica a ambos entornos, por lo que **los botones NO vienen de SignalR**.

---

## Hipótesis revisada del mecanismo de permisos

Dado que M:[] es siempre vacío y localhost funciona, los botones probablemente vienen del **HTML renderizado server-side** en las respuestas del UpdatePanel (`POST /SIN/TramiteMedico/ABMTramiteMedico.aspx`).

El backend ASP.NET genera el contenido de `linkAction-cell` en el servidor según los permisos del usuario **al momento de cada partial postback**. La diferencia entre entornos sería que el backend devuelve HTML diferente dependiendo de algún aspecto del request.

### Timing observado

```
15:28:04-06 → POST ABMTramiteMedico.aspx (x8 en paralelo) — grid carga datos
15:28:07    → negotiate SignalR (¡DESPUÉS de que el grid ya cargó!)
15:28:07.9  → longPolling connect establecido
15:28:08    → primer poll (pendiente)
```

El grid carga 2-3 segundos ANTES de que SignalR empiece a negociar.

---

## Estado al cierre de sesión

| Fix | Estado | Resultado |
|---|---|---|
| Excluir SignalR de hbEligible | ✅ Permanente | HB no corrompe hub |
| Negotiate intercept TryWebSockets=false | ✅ Permanente | No intenta WS |
| SSE reject 503 | ✅ Permanente | longPolling inmediato |
| Strip x-ms-* | ❌ Revertido | Causó regresión total |
| Referer/Origin rewrite | ✅ Código presente (no-op con config actual) | Sin efecto con PUBLIC_HOST=INTERNAL_TARGET |

### Problema pendiente

La inconsistencia entre siniestros en App Proxy permanece sin resolver.
- Siniestro **158666**: funciona en App Proxy (con SSE fix)
- Siniestro **154967**: no funciona en App Proxy

**Próxima línea de investigación:** comparar el HTML del `linkAction-cell` en la respuesta de `POST ABMTramiteMedico.aspx` para ambos siniestros. Verificar si el backend devuelve HTML diferente o si hay algún request que falla (4xx/5xx) en el siniestro que no funciona.

---

## Configuración App Proxy recomendada

| Setting | Valor recomendado | Motivo |
|---|---|---|
| Backend Application Timeout | **Long (180s)** | longPolling puede durar hasta 30s |
| Translate URLs in headers | No | El wrapper maneja reescritura |
| Translate URLs in application body | No | El wrapper maneja reescritura |

---

## Código de diagnóstico activo

El wrapper tiene activo el intercept `[DIAG-SR]` que logguea los primeros 200 chars de cada poll/connect response. Útil para debugging futuro pero puede eliminarse si genera ruido.

---
*Parte del historial de contexto del proyecto Serena ART — App Proxy Wrapper V47.*
