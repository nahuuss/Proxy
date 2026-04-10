# Fix: URL Rewrite Root-Relative + CSS Coverage V47
**Fecha:** 2026-03-18
**Archivo:** `wrapper-appProxy.js` (V47 — App Proxy Edition)

---

## Contexto

El proxy reescribe referencias al servidor interno `core.serenaart.com.ar` para que apunten al servidor público `core2-serenaseguros.msappproxy.net`. Esto es necesario porque el browser no tiene acceso directo al servidor interno.

---

## Problema 1: Password Image no cargaba en `127.0.0.1:8080`

### Síntoma
En la página de Login, la imagen del ojo (`img#passwordImage`, 23×16px) no cargaba al cargar la página. Solo aparecía después de hacer click (que ejecuta `VerPassword()` y setea un `src` relativo).

### Causa raíz
El HTML del servidor tenía:
```html
<img id="passwordImage" src="https://core.serenaart.com.ar/Images/eye_open.png?v=...">
```

El rewrite anterior transformaba esto a:
```html
<img id="passwordImage" src="https://core2-serenaseguros.msappproxy.net/Images/eye_open.png?v=...">
```

Cuando el browser está en `http://127.0.0.1:8080`, intentaba fetchear la imagen directamente de `core2-serenaseguros.msappproxy.net` — que requiere autenticación Azure AD → fallo.

**`VerPassword()`** usa `src="/Images/eye_open.png"` (relativo) → pasa por el proxy local → funciona. Por eso solo cargaba al hacer click.

### Diagnóstico de entornos

| Entorno | Rewrite anterior | Resultado |
|---|---|---|
| Producción (App Proxy) | `→ https://core2-...` | ✓ Funciona (browser ya está en ese dominio) |
| Local (`127.0.0.1:8080`) | `→ https://core2-...` | ❌ Browser va directo a App Proxy (requiere auth) |

---

## Fix: URLs absolutas → root-relative

### Estrategia
En lugar de reemplazar el hostname con `PUBLIC_HOST`, eliminar el esquema+host completo, dejando solo el path. Funciona en ambos entornos:

```javascript
function sendProcessed(dataBuffer, status, originalHeaders, forceSkipRe = false) {
    if (!forceSkipRe) {
        let text = dataBuffer.toString('utf8');
        if (text.includes(INTERNAL_TARGET)) {
            const escapedInternal = INTERNAL_TARGET.replace(/\./g, '\\.');
            // URLs absolutas → root-relative
            text = text.replace(new RegExp(`https?:\\/\\/${escapedInternal}`, 'g'), '');
            text = text.replace(new RegExp(`\\/\\/${escapedInternal}`, 'g'), '');
            // Hostname bare en strings JS / atributos de dominio → PUBLIC_HOST
            text = text.replace(new RegExp(INTERNAL_TARGET, 'g'), PUBLIC_HOST);
            dataBuffer = Buffer.from(text, 'utf8');
        }
    }
    ...
}
```

### Transformaciones

| Input | Output | Caso |
|---|---|---|
| `https://core.serenaart.com.ar/Images/eye_open.png?v=X` | `/Images/eye_open.png?v=X` | img src en HTML |
| `http://core.serenaart.com.ar/path` | `/path` | URL HTTP |
| `//core.serenaart.com.ar/path` | `/path` | Protocol-relative |
| `core.serenaart.com.ar` (bare) | `core2-serenaseguros.msappproxy.net` | String JS / dominio |

### Por qué funciona en ambos entornos

```
Local (127.0.0.1:8080):
  src="/Images/eye_open.png" → browser fetcha http://127.0.0.1:8080/Images/eye_open.png
  → pasa por el proxy → proxy fetcha de core.serenaart.com.ar → ✓

Producción (App Proxy):
  src="/Images/eye_open.png" → browser fetcha https://core2-.../Images/eye_open.png
  → App Proxy → Connector → proxy en 8080 → ✓
```

---

## Problema 2: Archivos CSS no se reescribían

### Síntoma
CSS puede contener `background-image: url('https://core.serenaart.com.ar/...')`. Estos no eran reescritos porque `.css` no estaba en `isRewritable`.

### Fix: Agregar `text/css` a isRewritable

```javascript
const isRewritable = !isFileDownload && (
    isHeartbeatActive ||
    cType.includes('text/html') ||
    cType.includes('javascript') ||
    cType.includes('text/css') ||     // ← agregado
    urlPart.endsWith('.aspx') ||
    urlPart.endsWith('.axd') ||
    urlPart.endsWith('.ashx')
);
```

---

## Cobertura final del rewrite

| Tipo de respuesta | Cubierto | Mecanismo |
|---|---|---|
| HTML (`text/html`) | ✓ | `cType.includes('text/html')` |
| ASPX pages | ✓ | `urlPart.endsWith('.aspx')` |
| JavaScript (`text/javascript`) | ✓ | `cType.includes('javascript')` |
| CSS (`text/css`) | ✓ | `cType.includes('text/css')` |
| AXD / ASHX handlers | ✓ | `urlPart.endsWith('.axd/.ashx')` |
| Imágenes binarias | — | No necesitan (bytes, no URLs) |
| Archivos Excel/PDF | — | FILE GUARD: bypasa reescritura |

---

## Nota sobre hostname bare

El rewrite final `INTERNAL_TARGET → PUBLIC_HOST` (sin modificar) cubre casos como:
- `location.hostname` comparisons en JavaScript
- Cookie domain attributes
- SignalR hub URL en JavaScript: `$.connection.hub.url = 'https://core.serenaart.com.ar/signalr'`
  → después del primer replace queda `'/signalr'` (root-relative) ← correcto

---
*Parte del historial de contexto del proyecto Serena ART — App Proxy Wrapper V47.*
