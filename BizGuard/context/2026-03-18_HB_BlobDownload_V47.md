# Fix: Heartbeat Blob Download — serveAsBlobDownload V47
**Fecha:** 2026-03-18
**Archivo:** `wrapper-appProxy.js` (V47 — App Proxy Edition)

---

## Contexto

El Heartbeat (HB) fue diseñado para evitar que App Proxy o IIS corten conexiones largas (>55s). Cuando el HB dispara, envía una página HTML chunked con un spinner "Procesando..." al browser. El problema era que cuando el backend eventualmente respondía con un archivo descargable, el proxy no sabía cómo entregarlo porque ya había enviado cabeceras chunked al browser.

La función `serveAsBlobDownload` resuelve esto: inyecta un script inline que reconstruye el archivo desde base64 y lo descarga via JS Blob API, sin necesidad de una segunda request.

---

## Problema Anterior

La versión anterior de `serveAsBlobDownload` usaba `history.back()` para retornar al origen, lo que:
1. Creaba una entrada vacía en el historial del browser
2. Si el usuario navegaba "atrás" nuevamente, podía llegar a la página de spinner en vez de la original
3. No cerraba correctamente el comentario HTML `<!--` abierto por el HB

---

## Solución Implementada

### Flujo completo del HB + Blob Download

```
1. Request llega (ej: /ABMGenerarReporte.aspx?tipo=excel)
2. HB_FIRST_PULSE_MS = 55s → [HB] Shield Active
3. Proxy envía al browser:
   HTTP 200 chunked
   <!DOCTYPE html>...spinner..."Procesando..."...<!--
   (comentario HTML abierto — los pulsos van adentro)
4. Cada 15s: proxy envía " " (espacio) adentro del comentario
5. Backend responde con Excel/PDF (Content-Disposition: attachment)
6. Proxy detecta binario → llama serveAsBlobDownload()
7. serveAsBlobDownload envía al browser:
   --><script>(function(){
     // Cierra el comentario HTML
     // Decodifica base64 → Blob → <a>.click()
     // Actualiza spinner a ✓ "Descarga iniciada"
     // setTimeout 3s → window.location.replace(referer)
   })()</script>
```

### Cambios clave vs versión anterior

| Aspecto | Antes | Después |
|---|---|---|
| Cierre comentario HTML | ❌ no cerraba | ✓ `-->` al inicio del script |
| Retorno al origen | `history.back()` (agrega entrada) | `window.location.replace(referer)` (sin entrada) |
| Feedback visual | Spinner permanece | ✓ spinner → "✓ Descarga iniciada" |
| URL de retorno | Siempre `back()` | Usa `Referer` header si disponible; fallback a `/` |

### Código de la función

```javascript
function serveAsBlobDownload(dataBuffer, originalHeaders) {
    let mimeType = (originalHeaders['content-type'] || '').split(';')[0].trim() || 'application/octet-stream';
    // Detección por magic bytes: PK (Excel/Zip) y %PDF
    if (mimeType === 'application/octet-stream') {
        if (dataBuffer[0] === 0x50 && dataBuffer[1] === 0x4B)
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        else if (dataBuffer[0] === 0x25 && dataBuffer[1] === 0x50)
            mimeType = 'application/pdf';
    }
    const filename = ...extracted from Content-Disposition...
    const b64 = dataBuffer.toString('base64');
    const referer = req.headers['referer'] || '';
    const backUrl = JSON.stringify(referer.includes(PUBLIC_HOST) ? referer : '/');
    const script = `--><script>(function(){
        // decode base64 → Uint8Array → Blob → <a>.click()
        // update .c innerHTML to ✓ success message
        // setTimeout(3000) → window.location.replace(backUrl)
    })()</script>`;
    res.write(script); res.end();
}
```

---

## Resultado

- El archivo se descarga correctamente via Blob API
- El spinner muestra "✓ Descarga iniciada" con el nombre del archivo
- Después de 3 segundos, el browser navega a la página original sin agregar entrada al historial
- No se produce página en blanco post-descarga

---
*Parte del historial de contexto del proyecto Serena ART — App Proxy Wrapper V47.*
