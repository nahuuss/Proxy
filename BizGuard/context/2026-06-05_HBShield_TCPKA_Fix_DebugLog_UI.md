# HB-Shield TCP-KA Fix + Debug Log + UI Mejoras — 05/06/2026

## Objetivo

Resolver el problema donde el conector BizGuard, al proxear requests XHR/AJAX largos
(como la carga de archivos en Liquidación de Práctica Médica), inyectaba espacios en el
body HTTP corrompiendo la respuesta JSON. El usuario nunca veía el resultado de la operación.

---

## Problema Identificado

### Causa raíz
El **HB-Shield** (mecanismo anti-timeout de Cloudflare) se activaba tras 10 segundos sin
respuesta del backend. Para requests XHR/POST, escribía un espacio `' '` directamente en
el socket HTTP y luego un espacio adicional cada 15 segundos.

Al llegar la respuesta real del backend (ej: 70s después), el body resultante era:

```
     {"error":"","result":"...datos..."}
^^^^^
espacios iniciales → JSON.parse() falla → el cliente no ve nada
```

### Por qué test no fallaba y prod sí
- **Entorno test** (`coretest.serenaart.com.ar`): PREIMPORTAR tardaba ~9.6s — por debajo
  del umbral de 10s → HB nunca se activaba.
- **Entorno producción** (`core.serenaart.com.ar`): PREIMPORTAR tardaba ~70-82s → HB se
  activaba e inyectaba espacios.

### Evidencia
Análisis de 5 archivos HAR y correlación con `hb.log` confirmaron que el HB-Shield
(Pasivo/Spaces) se activaba exactamente cuando el backend productivo tardaba >10s.

---

## Cambios Implementados

### 1. HB-Shield — Modo TCP-KA para XHR (`src/lib/proxy-server.ts`)

**Problema:** El shield no distinguía entre navegación real (HTML) y requests XHR/AJAX.
Escribía espacios al body en ambos casos.

**Solución:** Bifurcación por tipo de request dentro del `startHbShield()`:

| Tipo | Comportamiento anterior | Comportamiento nuevo |
|---|---|---|
| Full-page navigation (GET sin XHR) | Spinner HTML + espacios en comentario HTML | Sin cambio ✅ |
| XHR / AJAX / POST con `x-requested-with` | `res.write(' ')` → corrompe JSON ❌ | TCP socket keepalive — no toca el body ✅ |

**Implementación del modo TCP-KA:**
- Se llama a `res.socket?.setKeepAlive(true, 15000)` para mantener viva la conexión a nivel TCP.
- `res.writeHead()` **no se llama** — los headers HTTP quedan pendientes hasta que llegue la respuesta del backend.
- Al llegar la respuesta: se detecta `isHeartbeatActive && !res.headersSent` y se envía una respuesta HTTP completa normal (`writeHead + end`) con los headers y body correctos del backend.
- El mismo fix se aplicó al path NTLM (detección por `res.headersSent`).

**Logs diferenciadores:**
- `[HB-SHIELD] Pasivo (Spaces/HTML)` → full-page nav (comportamiento anterior preservado)
- `[HB-SHIELD] Pasivo (TCP-KA)` → XHR (nuevo comportamiento)
- `[HB-SHIELD] TCP-KA completo` → respuesta enviada normalmente

### 2. Sistema de Debug Log por Conector (`src/lib/logger-hb.ts`)

Nueva función `logDebug()`:
- Solo escribe si el conector tiene `debugLog: true`.
- Archivo de salida: `debug-{connectorId}.log` en raíz del proyecto.
- Formato tabulado (separado por `\t`) para análisis en Excel/grep:
  ```
  timestamp | tag | method | path | status | elapsedMs | extra
  ```
- Registra: inicio de cada request (`[REQUEST-IN]`), activación TCP-KA (`[HB-TCP-KA]`), y completado (`[HB-TCP-KA-DONE]`).

### 3. Campo `debugLog` en Conector (`src/lib/connectors.ts` + `src/app/actions.ts`)

- Agregado campo `debugLog?: boolean` al tipo `Connector`.
- Persistido en la DB al guardar desde el formulario.
- Corregido el type cast de `connectorType` en `updateConnectorAction` para incluir `'serena-test'` (estaba ausente).

### 4. UI — Tab General rediseñada (`src/components/ConnectorRow.tsx`)

La tab General del editor de conector se reorganizó en **3 secciones delimitadas**:

```
── Identidad ──────────────────────
  Nombre

── Red ────────────────────────────
  Host Público    Puerto
  URL Interna

── Diagnóstico ────────────────────
  [toggle] Debug Log
```

**Cambios específicos:**
- Campos **Host Público** y **Puerto** separados visualmente en grid independiente con
  labels propios y bordes individuales (antes estaban fusionados en un mismo contenedor).
- Toggle **Debug Log** en sección Diagnóstico — color tertiary (amarillo) para diferenciarlo
  del rojo (bypass SSO) y azul (primary).
- Tab muestra badge **`DBG`** cuando debug log está activo.
- Estado `debugLog` inicializado desde `connector.debugLog`.

---

## Archivos Modificados

| Archivo | Cambio |
|---|---|
| `src/lib/proxy-server.ts` | Bifurcación HB-Shield TCP-KA vs Spaces; fix NTLM path; integración `logDebug()` |
| `src/lib/logger-hb.ts` | Nueva función `logDebug()` con escritura tabulada a `debug-{id}.log` |
| `src/lib/connectors.ts` | Campo `debugLog?: boolean` en tipo `Connector` |
| `src/app/actions.ts` | Persistencia de `debugLog`; corrección type cast `connectorType` |
| `src/components/ConnectorRow.tsx` | Tab General con secciones; toggle Debug Log; separación Host/Puerto |
| `src/data/connectors.json` | Seed actualizado con `connectorType: 'core'` en ambos conectores |

---

## Verificación

Pruebas reales sobre `ConsultaLiquidacionPracticaMedica.aspx` en producción:

| Prueba | Duración backend | Resultado |
|---|---|---|
| Antes del fix (conector prod) | ~82s | ❌ Sin respuesta — JSON corrupto |
| Test 1 post-fix | ~59s | ✅ Respuesta mostrada correctamente |
| Test 2 post-fix | ~70s | ✅ Respuesta mostrada correctamente |

**Log de confirmación (hb.log):**
```
[HB-SHIELD] Pasivo (TCP-KA) /SIN/LiquidacionPracticaMedica/... | Iniciado tras 10s
[HB-SHIELD] TCP-KA completo — enviando respuesta normal
```

---

## Notas

- No se tocó el código de Core ni de los backends. El fix es exclusivamente en el conector.
- La lógica de full-page navigation (spinner HTML) queda intacta y sin cambios.
- El modo TCP-KA no garantiza protección si Cloudflare termina la conexión antes que el
  backend responda. Para casos >100s considerar agregar timeout configurable en el
  outgoing `http.request`.
