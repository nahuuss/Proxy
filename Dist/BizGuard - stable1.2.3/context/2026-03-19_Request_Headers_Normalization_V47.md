# Fix: Normalización de Headers de Request V47
**Fecha:** 2026-03-19
**Archivo:** `wrapper-appProxy.js` (V47 — App Proxy Edition)

---

## Problema

Los botones de acción en grillas (`linkAction-cell`) aparecían **inconsistentemente** en App Proxy:
- Algunos siniestros: botones correctos (Editar, Cancelar, Eliminar)
- Otros siniestros: solo botones de solo lectura (VerDetalle/zoom)
- localhost: siempre correctos

### Análisis del HTML

Comparando el DOM post-JavaScript (DevTools inspector) para el mismo siniestro/registro:

| Entorno | Col 12 | Col 13 | Col 14 | Col 15 |
|---|---|---|---|---|
| App Proxy | VerDetalle (zoom) ✓ | EMPTY | EMPTY | EMPTY |
| localhost | EMPTY | Editar ✓ | Cancelar ✓ | Eliminar ✓ |

`EDSASecurity.js` recibe permisos via SignalR hub y **reemplaza dinámicamente** el contenido de las celdas:
- Permisos viewer → muestra VerDetalle
- Permisos editor → muestra Editar/Cancelar/Eliminar (oculta VerDetalle)

### Causas identificadas

**Causa A: Headers `X-MS-*` inyectados por App Proxy**

App Proxy agrega headers a cada request:
```
X-MS-Client-Principal-Name: blanco@example.com
X-MS-Client-Principal-Id: {objectId}
X-MS-Forwarded-Url: https://coretest.serenaart.com.ar/...
```

Si el módulo EDSA o IIS lee estos headers para evaluar el rol del usuario, puede aplicar permisos diferentes a los que la sesión ASP.NET indica.

**Causa B: Headers `Referer` y `Origin` con dominio público**

Cuando el browser está en `https://coretest.serenaart.com.ar`:
```
Referer: https://coretest.serenaart.com.ar/SIN/TramiteMedico/...
Origin:  https://coretest.serenaart.com.ar
```

El wrapper los reenvía tal cual al backend `core.serenaart.com.ar`. Si el módulo de seguridad EDSA valida el origen y aplica permisos reducidos para el dominio público → permisos viewer en lugar de editor.

**Consistencia del bug:** La inconsistencia entre siniestros se debe al timing: si SignalR entrega los permisos ANTES de que el EDSA grid cargue sus datos AJAX, el grid se renderiza correctamente. Si el AJAX del grid termina primero (siniestros con muchos datos), se usa el permiso reducido del Referer/Origin.

---

## Fix aplicado

```javascript
const headers = { ...req.headers, 'host': INTERNAL_TARGET, 'accept-encoding': 'identity' };
// Strip cf-* (Cloudflare) y x-ms-* (Azure AD App Proxy identity headers)
Object.keys(headers).forEach(h => {
    if (h.startsWith('cf-') || h.startsWith('x-ms-')) delete headers[h];
});
// Reescribir Referer y Origin: dominio público → dominio interno
if (headers['referer']) {
    headers['referer'] = headers['referer'].replace(/https?:\/\/[^/]*/i, `https://${INTERNAL_TARGET}`);
}
if (headers['origin']) {
    headers['origin'] = `https://${INTERNAL_TARGET}`;
}
```

### Transformaciones de ejemplo

| Header | Antes (App Proxy) | Después |
|---|---|---|
| `x-ms-client-principal-name` | `blanco@example.com` | **eliminado** |
| `x-ms-forwarded-url` | `https://coretest.../...` | **eliminado** |
| `referer` | `https://coretest.serenaart.com.ar/SIN/...` | `https://core.serenaart.com.ar/SIN/...` |
| `origin` | `https://coretest.serenaart.com.ar` | `https://core.serenaart.com.ar` |
| `host` | `coretest.serenaart.com.ar` | `core.serenaart.com.ar` (ya existente) |

### Backward compatibility

- **localhost (127.0.0.1:8081)**: No manda headers `x-ms-*` ni Referer con dominio externo conocido → sin cambios
- **Cloudflare**: No manda `x-ms-*` headers → sin cambios (solo se filtraban los `cf-*`)
- **App Proxy**: El backend ve requests como si vinieran del dominio interno → mismos permisos que localhost

---

## Resultado esperado

- Todos los siniestros mostrarán los mismos botones en App Proxy que en localhost
- La inconsistencia timing-dependent desaparece porque los permisos ya no dependen del Referer/Origin

---
*Parte del historial de contexto del proyecto Serena ART — App Proxy Wrapper V47.*
