# Traffic Log por Usuario — Sistema de Diagnóstico de Tráfico HTTP

**Fecha**: 2026-06-10  
**Objetivo**: Implementar un sistema de log de tráfico HTTP separado por usuario con rotación por tamaño y retención temporal automática.

---

## Descripción

Se implementó un sistema de logging de tráfico que captura cada request HTTP que pasa por los conectores del proxy, organizado en archivos separados por usuario detectado (NTLM o SSO). El sistema incluye:

- **Separación por usuario**: Cada usuario tiene su propia carpeta en `logsdebug/traffic/{username}/`
- **Rotación por tamaño**: Archivos de máximo 100 MB por chunk
- **Retención automática**: Archivos con más de 5 horas de antigüedad se eliminan automáticamente (cleanup cada 10 minutos)
- **TTFB en flujo estándar**: Campo `ttfb` que indica el tiempo hasta el primer byte del backend. Ausente en conexiones NTLM.
- **Cookies incluidas**: Los headers completos (incluyendo cookies) se graban para facilitar diagnóstico de errores de sesión
- **Usuarios anónimos excluidos**: Requests sin sesión detectada no se loguean (evita ruido de recursos estáticos pre-login)

---

## Archivos creados

### `src/lib/logger-traffic.ts`
Módulo principal del sistema de traffic logging.

- **Clase `TrafficLogger`**: Singleton global con escritura asíncrona via file descriptors abiertos (`fs.open` + `fs.write`)
- **`TrafficEntry`**: Interfaz que define la estructura de cada entrada NDJSON
- **`extractCookieNames()`**: Función auxiliar que extrae solo los nombres de cookies del header Cookie
- **`sanitizeUsername()`**: Sanitiza el nombre de usuario para uso como nombre de carpeta
- **Rotación**: Se verifica el tamaño del archivo actual antes de cada escritura. Si supera 100 MB, se cierra y se abre el siguiente chunk.
- **Limpieza**: Timer con `.unref()` que corre cada 10 minutos. Elimina archivos con `mtime > 5h` y carpetas de usuario vacías.

---

## Archivos modificados

### `src/lib/connectors.ts`
- Agregada propiedad `trafficLog?: boolean` a la interfaz `Connector`

### `src/app/actions.ts`
- Lectura de `formData.get("trafficLog") === "on"` en `updateConnectorAction`
- Campo persistido en la base de datos NeDB junto al resto de la configuración

### `src/lib/proxy-server.ts`
- Import de `trafficLogger`, `extractCookieNames` y `TrafficEntry`
- **Flujo estándar**: Captura de TTFB (`const ttfbMs = Date.now() - startTime`) en la primera línea del callback de `proxyRes`
- **Helper `buildTrafficEntry()`**: Función local que construye la entrada, retorna `null` si no hay sesión (usuario anónimo)
- **7 puntos de integración**: Se llama a `trafficLogger.log()` después de cada `logHarEntry()`:
  1. Redirect post-HB (línea ~510)
  2. Detección de binario (línea ~570)
  3. Buffer end (needsRewrite) (línea ~625)
  4. Direct streaming end (línea ~655)
  5. Error de proxy (línea ~675)
  6. NTLM error (línea ~365)
  7. NTLM éxito (línea ~450)
- **Flujo NTLM**: Sin TTFB (no disponible), sin cambios estructurales al flujo

### `src/components/ConnectorRow.tsx`
- Estado `trafficLog` con `useState`
- Switch "Traffic Log" con ícono de usuarios y descripción en la sección Diagnóstico
- Badge `TRF` en el tab General cuando traffic log está activo
- **Fix UI Host/Puerto**: 
  - Grid cambiado de `grid-cols-[1fr_auto] gap-3` a `grid-cols-[1fr_148px] gap-5`
  - Label del puerto cambiado de "Puerto" a "Puerto Proxy" con color `text-primary/80`
  - Input del puerto con `font-mono` y borde `border-primary/20`

---

## Estructura de archivos generados

```
logsdebug/
  traffic/
    frodriguez/
      2026-06-10_1720-1.jsonl    ← chunk 1
      2026-06-10_1820-2.jsonl    ← chunk 2 (tras rotación)
    norberto.saavedra/
      2026-06-10_1730-1.jsonl
```

### Formato de cada línea (NDJSON)

```json
{
  "ts": "2026-06-10T17:27:30.412Z",
  "elapsed": 342,
  "ttfb": 195,
  "user": "frodriguez",
  "conn": "test-port",
  "method": "POST",
  "url": "/SIN/Denuncia/Create",
  "status": 200,
  "reqSize": 1024,
  "resSize": 48302,
  "ct": "text/html; charset=utf-8",
  "xhr": true,
  "err": null,
  "cookies": ["authjs.session-token", "ASP.NET_SessionId"],
  "reqHdrs": { "content-type": "...", "cookie": "..." },
  "resHdrs": { "content-type": "...", "set-cookie": "..." }
}
```

- `ttfb` ausente en entradas NTLM
- Cuerpo de request/response **no se graba** (solo tamaños)
- Para body completo, usar `harLog`

---

## Decisiones técnicas

| Decisión | Valor | Razón |
|----------|-------|-------|
| Formato de archivo | NDJSON (.jsonl) | Append-only, sin necesidad de parsear el archivo completo |
| Escritura | `fs.open()` + `fs.write()` | Descriptor abierto permanente, sin overhead de open/close por request |
| Singleton | `globalThis._trafficLogger` | Evita instancias duplicadas en hot-reload de Next.js |
| Timer cleanup | `.unref()` | No evita el shutdown del proceso |
| Cookies | Incluidas completas | Facilitan diagnóstico de errores de sesión |
| Usuarios anónimos | Excluidos | Evitan ruido de CSS/JS/img pre-login |
| TTFB | Solo flujo estándar | `httpntlm` no expone eventos intermedios |

---

## Cómo verificar

1. Ir a la UI de BizGuard → editar un conector → sección Diagnóstico
2. Activar el switch "Traffic Log"
3. Guardar cambios
4. Navegar en la aplicación proxied con un usuario autenticado
5. Verificar que se crearon archivos en `logsdebug/traffic/{usuario}/`
6. Cada línea del `.jsonl` es un JSON válido con la estructura documentada
7. Verificar que el campo `ttfb` aparece en entradas de flujo estándar pero no en NTLM
8. Para la retención: los archivos se eliminan automáticamente tras 5 horas

---

## Consideración de seguridad

Los archivos de traffic log incluyen cookies completas (incluyendo tokens de sesión NextAuth). La carpeta `logsdebug/traffic/` debe estar protegida a nivel de sistema operativo. Los logs se auto-eliminan a las 5 horas.
