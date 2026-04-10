# BizGuard — Fixes post-NTLM (2026-04-10)

## Issues resueltos

---

### 1. Node.js heap Out of Memory (OOM)

**Síntoma:**
```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
Mark-Compact 2041.4 (2051.7) -> 2036.6 (2050.7) MB
```

**Causa raíz:**
`handleRequest()` en `proxy-manager.ts` llamaba `createProxyServer()` en cada request individual.
Cada llamada creaba un `http.Agent({ keepAlive: true })` nuevo con sockets abiertos que nunca eran liberados por GC.
Con tráfico normal del CRM (50-100 req/página), el heap crecía indefinidamente hasta el crash.

El mismo problema existía para el `internal-dashboard`: cada request a `/api/stats`, `/login`, `_next` creaba otro agente.

**Fix — `src/lib/proxy-manager.ts`:**
- Agregado `proxyServers: Map<string, ReturnType<typeof createProxyServer>>` en la clase `ProxyManager`
- `handleRequest()` reutiliza el proxy server cacheado por `connector.id`
- `internal-dashboard` también se cachea bajo `"internal-dashboard"` key
- `startConnector()` y `stopConnector()` invalidan el cache (`proxyServers.delete(id)`) para que cambios de config surtan efecto inmediato

**Fix — `package.json`:**
- Script `start` cambiado a `node --max-old-space-size=4096 node_modules/.bin/next start`
- Node puede usar hasta 4 GB de heap antes de crashear (útil para picos de tráfico)

---

### 2. Imágenes e iconos rotos en popups del CRM

**Síntoma:**
Popup "Microsoft Dynamics CRM" aparecía vacío — sin imágenes, sin contenido visible. La barra de título se cargaba pero el body estaba en blanco.

**Causa raíz:**
El bloque NTLM en `proxy-server.ts` reenviaba las respuestas del CRM sin ninguna reescritura.
El CRM genera HTML con URLs absolutas apuntando al servidor interno:
```html
<img src="http://arbuewvcrmapp01:5555/_imgs/NavBar/NavBarLogo.png">
```
El browser intentaba cargar esas URLs directamente (no accesibles desde Internet) → broken images.

Lo mismo para `Location` headers en redirects y `Set-Cookie` con domain interno.

**Fix — `src/lib/proxy-server.ts` (bloque NTLM):**
- **`Location` header**: reemplaza `arbuewvcrmapp01:5555` → host público (`crm.serenaart.com.ar`)
- **`Set-Cookie`**: reescribe `domain=`, elimina flag `Secure`, convierte `SameSite=None` → `SameSite=Lax`
- **Body HTML/JS/CSS**: para respuestas de texto, reemplaza todas las ocurrencias del host interno por el host público (mismo algoritmo que el proxy normal)
- Contenido binario (imágenes, GIFs, etc.) pasa sin modificar

```typescript
// Pseudo-código del fix
if (isText) {
  body = body.replace(`https?://${targetHost}`, '');   // URLs absolutas → root-relative
  body = body.replace(`//${targetHost}`, '');
  body = body.replace(targetHost, incomingHost);       // bare hostname → host público
}
```

---

### 3. Usuario debía escribir `/SERENAART/` manualmente después del login

**Síntoma:**
Al visitar `https://crm.serenaart.com.ar/`, el proxy redirigía al formulario NTLM con `callbackUrl=/`.
Después del login, el browser iba a `/` (raíz), que en CRM 2013 no tiene contenido — el usuario tenía que agregar `/SERENAART/` manualmente en la URL.

**Causa raíz:**
El proxy usaba la URL visitada (siempre `/` en la primera visita) como `callbackUrl` sin considerar que CRM requiere una ruta base específica.

**Fix — nuevo campo `entryPath` en Connector:**

`src/lib/connectors.ts`:
```typescript
entryPath?: string;  // ej: "/SERENAART/"
```

`src/lib/proxy-manager.ts`:
- Si `url === '/'` y el conector tiene `entryPath`: usar `entryPath` como `callbackUrl` en el redirect al login
- Si el usuario llega a `/` ya autenticado: redirect 302 directo a `entryPath`

`src/components/ConnectorRow.tsx`:
- Campo "Ruta de entrada" aparece en la sección NTLM (toggle activado) debajo de "Dominio AD"
- Placeholder: `SERENAART/`

`src/app/actions.ts`:
- `updateConnectorAction` parsea y persiste `entryPath` en NeDB

**Configuración:**
En la UI de BizGuard, editar el conector → activar NTLM → campo **Ruta de entrada** → `/SERENAART/` → Guardar.

---

### 4. Heartbeat Shield activándose en rutas internas

**Síntoma:**
El log mostraba constantemente:
```
[BG-CHECK] GET /api/stats | Static: false | XHR: false | Eligible: true
[BG-TRACK] ID: xxx | Target: internal-dashboard | HB-Timer: 45000ms
[HB-SHIELD] Pasivo (Spaces) /api/stats/stream | XHR: false (internal-dashboard)
```
Cada poll de `/api/stats` (cada ~2s por el dashboard) y cada conexión SSE de `/api/stats/stream` creaban un BG-TRACK job y un timer de 45s. Con múltiples tabs abiertas, se acumulaban decenas de timers activos innecesariamente → contribuía al OOM.

**Causa raíz:**
El Heartbeat Shield evaluaba elegibilidad basándose solo en si la URL era estática (extensión de archivo) o XHR. `/api/stats` es una ruta dinámica sin `x-requested-with` → eligible = true. El código no distinguía entre requests al backend real y requests internas al dashboard de Next.js.

**Fix — `src/lib/proxy-server.ts`:**
```typescript
const isInternalConnector = connector.id === "internal-dashboard";
const hbEligible = !isInternalConnector && !isStatic && (isPostLike || !isXhrExcluded);
```
- El conector `internal-dashboard` (localhost:3000) nunca activa HB — no pasa por Cloudflare
- Log `[BG-CHECK]` suprimido para rutas internas (eliminaba ruido en consola)
- Log `[Proxy Debug]` reducido: solo se emite cuando la URL contiene `/api/auth` (era `isInternalAuth || /api/auth`, ahora solo `/api/auth`)

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/lib/proxy-manager.ts` | Cache de proxy servers por conector (`proxyServers` Map); `entryPath` redirect logic |
| `src/lib/proxy-server.ts` | NTLM: reescritura de Location/Set-Cookie/body; HB-Shield excluye internal-dashboard; logs reducidos |
| `src/lib/connectors.ts` | Interface Connector: `entryPath?: string` |
| `src/components/ConnectorRow.tsx` | Campo "Ruta de entrada" en NtlmSection |
| `src/app/actions.ts` | Parseo y persistencia de `entryPath` |
| `package.json` | `start` con `--max-old-space-size=4096` |

---

## Configuración completa de un conector CRM NTLM

En la UI de BizGuard, editar el conector:

| Campo | Valor ejemplo |
|---|---|
| Target URL | `http://arbuewvcrmapp01:5555` |
| Autenticación NTLM | ON |
| Dominio AD | `SERENASEGUROS` |
| Ruta de entrada | `/SERENAART/` |
| Bypass SSO | ON (no necesita Microsoft SSO) |

En `data/connectors.db`:
```json
{
  "isNtlm": true,
  "ntlmDomain": "SERENASEGUROS",
  "entryPath": "/SERENAART/",
  "bypassAuth": true
}
```

---

## Flujo completo post-fixes

```
1. Usuario → GET https://crm.serenaart.com.ar/

2. proxy-manager: sin sesión + isNtlm=true + entryPath=/SERENAART/
   → callbackUrl = https://crm.serenaart.com.ar/SERENAART/
   → redirect /login/ntlm?callbackUrl=https://crm.serenaart.com.ar/SERENAART/

3. Usuario ingresa user/pass/domain

4. ntlmSignIn → authorize() valida contra CRM real vía httpntlm.get()
   → CRM 401: return null → error en formulario
   → CRM 200: crea JWT con crmUser/crmPass/crmDomain

5. window.location.href = https://crm.serenaart.com.ar/SERENAART/
   (redirect manual, evita cross-origin de Auth.js)

6. proxy-manager: verifySession() → session = { crmUser, crmPass, crmDomain }
   url = /SERENAART/ (no es /, no hay redirect adicional)

7. proxy-server: isNtlm + session.crmUser → httpntlm.get/post (3 pasos NTLM)
   CRM responde 200 con HTML → proxy reescribe URLs internas → browser recibe HTML limpio

8. Browser carga imágenes/CSS/JS → cada request pasa por proxy-server NTLM
   Todas las URLs en el HTML ya son root-relative → no hay broken images
```

---

## Logs esperados (limpio, sin ruido)

```
# Arranque
[BIZGUARD] Port 8082 listening for 1 services

# Primera visita
[BIZGUARD-Auth] No session for /. Redirecting to: /login/ntlm?callbackUrl=...

# Login + navegación CRM
[BIZGUARD-IN] GET /SERENAART/main.aspx -> test
[NTLM-OK] GET /SERENAART/main.aspx → 200
[BIZGUARD-IN] GET /_imgs/NavBar/NavBarLogo.png -> test
[NTLM-OK] GET /_imgs/NavBar/NavBarLogo.png → 200

# Ping periódico (normal)
[PING-RESULT] test | URL: http://arbuewvcrmapp01:5555 | Online: true | status=401

# YA NO APARECE:
# [BG-CHECK] GET /api/stats ...
# [BG-TRACK] ID: xxx | Target: internal-dashboard ...
# [HB-SHIELD] Pasivo ... /api/stats/stream ...
# [Proxy Debug] ConnectorID="internal-dashboard" ...
```
