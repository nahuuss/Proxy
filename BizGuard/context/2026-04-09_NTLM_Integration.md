# BizGuard — Integración NTLM (2026-04-09)

## Contexto

CRM 2013 instalado en `arbuewvcrmapp01:5555` (Windows Server 2012) usa **Windows Authentication (NTLM)** con Active Directory on-premise. El dominio es `SERENASEGUROS`.

Sin proxy, el browser hace el handshake NTLM directo con el servidor y muestra el diálogo nativo de Windows Security. Con BizGuard como intermediario, el proxy debe hacer ese handshake en nombre del usuario.

---

## Arquitectura del flujo NTLM

```
1. Usuario → GET crm.bzld.click/
2. proxy-manager: sin sesión + conector isNtlm=true
   → redirect /login/ntlm?callbackUrl=https://crm.bzld.click/

3. Usuario ingresa user/pass/domain en formulario

4. ntlmSignIn (Server Action) → authorize() en auth.ts
   → httpntlm.get() contra arbuewvcrmapp01:5555
   → CRM responde 401: credenciales incorrectas → return null → error
   → CRM responde 200: credenciales correctas → crea JWT con crmUser/crmPass/crmDomain

5. redirect a callbackUrl (window.location.href — evita que Auth.js use AUTH_URL)

6. proxy-manager: verifySession() descifra JWT → (req as any).session = { crmUser, crmPass, crmDomain }

7. proxy-server: isNtlm + session.crmUser → httpntlm.get/post/... 3 pasos:
   Type1 → Type2 challenge → Type3 authenticate
   CRM responde 200 → proxy reenvía al browser
```

---

## Archivos modificados

### `src/auth.ts`
- Provider `ntlm-login` (Credentials) valida contra CRM real vía `httpntlm.get()` antes de crear sesión
- JWT almacena `crmUser`, `crmPass`, `crmDomain`
- Callbacks `jwt` y `session` propagan las credenciales

### `src/lib/connectors.ts`
- Interface `Connector` extendida con `isNtlm?: boolean` y `ntlmDomain?: string`

### `src/lib/proxy-server.ts`
- Variables HB (`hbTimer`, `hbInterval`, etc.) declaradas antes del bloque NTLM (fix TDZ/Turbopack)
- Bloque NTLM usa `httpntlm[method]()` para handshake completo 3 pasos
- Retorna response del CRM directamente, skipeando flujo normal del proxy

### `src/lib/proxy-manager.ts`
- `needsSessionForNtlm`: verifica sesión aunque `bypassAuth=true`
- Redirect a `/login/ntlm` cuando conector es NTLM sin sesión
- `/api/stats` y `/api/stats/stream` interceptados como rutas internas (no proxeadas al CRM)
- `SIGINT`/`SIGTERM` handlers para cierre limpio con Ctrl+C
- Fix: `servers.delete(port)` en handler de error para permitir reintento

### `src/app/login/ntlm/page.tsx`
- Formulario user/pass/domain estilo SSO (fondo azul #0072c6, card blanco)
- Usa Server Action `ntlmSignIn` — evita que fetch del cliente use AUTH_URL
- Redirect manual via `window.location.href = callbackUrl` post-login

### `src/app/login/ntlm/actions.ts`
- Server Action `ntlmSignIn(username, password, domain)`
- Llama `signIn("ntlm-login", { redirect: false })`

### `src/app/login/ntlm/layout.tsx`
- Layout propio para evitar que root layout muestre sidebar/overlay azul

### `src/app/actions.ts`
- `updateConnectorAction` parsea `isNtlm` y `ntlmDomain` del FormData

### `src/components/ConnectorRow.tsx`
- Componente `NtlmSection`: toggle NTLM + campo Dominio AD (aparece condicionalmente)

### `next.config.ts`
- `serverExternalPackages: ['httpntlm']` — evita que Turbopack bundlee httpntlm (causa TDZ crash)

### `types/httpntlm.d.ts`
- Declaración de módulo para httpntlm (sin tipos oficiales)

---

## Decisiones de diseño

**¿Por qué validar en `authorize()` y no solo en el proxy?**
Sin validación en authorize, cualquier user/pass crea una sesión válida. El 401 del CRM llega después, pero el JWT ya existe → el dashboard de BizGuard queda expuesto.

**¿Por qué `window.location.href` en el redirect post-login?**
`signIn("ntlm-login", { callbackUrl })` usa `AUTH_URL` (`bank.bzld.click`) como base. Si el usuario está en `crm.bzld.click`, Auth.js rechaza el callbackUrl como cross-origin. El redirect manual bypasea esta validación.

**¿Por qué `needsSessionForNtlm` aunque `bypassAuth=true`?**
`bypassAuth` omite el SSO de Microsoft, pero el NTLM necesita credenciales del usuario. Sin sesión, el proxy no sabe con qué usuario autenticarse contra el CRM.

**¿Por qué no "bypass NTLM" (relay transparente)?**
NTLM es per-conexión TCP. El proxy crea nuevas conexiones por request — las 3 fases del handshake (Type1→2→3) no pueden hacerse en conexiones separadas hacia el backend. `httpntlm` resuelve esto haciendo los 3 pasos en una sola `http.request()` interna.

---

## Configuración del conector

En la UI de BizGuard, al editar un conector:
- **Autenticación NTLM**: toggle ON
- **Dominio AD**: ej. `SERENASEGUROS` (sin el backslash)
- **Bypass SSO**: puede estar ON u OFF — el formulario NTLM se muestra igual

En `data/connectors.db` el registro queda:
```json
{
  "isNtlm": true,
  "ntlmDomain": "serenaseguros",
  "bypassAuth": true
}
```

---

## Logs esperados en operación normal

```
# Arranque
[BIZGUARD] Port 8082 listening for 1 services

# Primera visita sin sesión
[BIZGUARD-Auth] No session for /. Redirecting to: /login/ntlm?callbackUrl=...

# Login exitoso (servidor Action valida contra CRM)
# No hay log explícito — Auth.js crea JWT internamente

# Request proxeada con NTLM
[NTLM-OK] GET /CRMWeb/ → 200

# Request con credenciales incorrectas
[NTLM-OK] GET / → 401   (httpntlm completó el handshake pero CRM rechazó)

# Ping periódico al CRM (normal, sin auth)
[PING-RESULT] test | URL: http://arbuewvcrmapp01:5555 | Online: true | status=401
```

---

## Issues conocidos / pendientes

- `[NTLM-OK] → 401`: cuando las credenciales en el JWT son incorrectas, httpntlm completa el handshake pero el CRM retorna 401. El browser ve ese 401 directamente. No hay reintento de login automático.
- Múltiples POST `/login/ntlm` en el log: el Server Action puede ser llamado múltiples veces si el browser reintenta. Normal con credenciales incorrectas.

> **Fixes aplicados el 2026-04-10** — ver [2026-04-10_NTLM_Fixes.md](2026-04-10_NTLM_Fixes.md):
> - OOM por acumulación de `http.Agent` → proxy servers cacheados por conector
> - Imágenes/popups CRM rotos → reescritura de Location/Set-Cookie/body en respuestas NTLM
> - Usuario debía escribir `/SERENAART/` manual → campo `entryPath` en conector
> - HB-Shield activándose en rutas internas → `internal-dashboard` excluido del Heartbeat
