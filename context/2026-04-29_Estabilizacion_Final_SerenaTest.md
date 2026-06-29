# Estabilización Final Serena-Test - 29/04/2026

## Problemas Identificados (Debug Fase 2)
1.  **Causa Raíz de Login:** El fallo no era solo lógico, sino de **infraestructura de scripts**. Archivos críticos como `bootstrap.min.js` y `scripts.js` estaban devolviendo 404 debido a una reescritura de rutas defectuosa. Sin estos scripts, el botón "INGRESAR" permanecía deshabilitado (`BotonIngresarDisable`).
2.  **Rutas Mal Formadas:** Se detectaron duplicaciones complejas como `/Skins/...//Portals/...` que no eran capturadas por la regex anterior.
3.  **Corrupción de HTML:** La regex anterior era demasiado "codiciosa" y absorbía caracteres de cierre como `)` o `-->` en ciertos contextos de CSS/JS.

## Soluciones Implementadas

### 1. Refinamiento de Limpieza de Rutas (Seguridad Primero)
Se cambió la estrategia de limpieza de rutas duplicadas:
- Se implementó una regex que solo colapsa `//` si preceden a carpetas conocidas de DNN (`Portals`, `Skins`, `js`, `css`, `Images`, `DesktopModules`), evitando romper comentarios de JavaScript (`// comment`).
- Regex: `([^:])\/\/+(Portals\/|Skins\/|js\/|css\/|Images\/|DesktopModules\/)`

### 2. Inyección de Auto-Reload Mejorada
- Se ampliaron los criterios de detección de la página de login para incluir IDs reales detectados en el DOM (`dnn_ctr820`, `cmdLogin`).
- Se añadió un listener de `window.load` para asegurar que el objeto `Sys` esté disponible antes de intentar registrar el `endRequest`.
- Se añadió una verificación secundaria por contenido del body (`LogOff`) por si las cookies `HttpOnly` no son visibles.

### 3. Exclusión de Heartbeat en Login
Se mantuvo la exclusión estricta de las rutas que contienen `login` o `ingreso` del mecanismo de *Heartbeat Shield* para evitar romper el formato de las respuestas AJAX Delta.

## Archivos Modificados
- `src/lib/rules/serena-test.ts`

## Próximos Pasos
- Verificar en el servidor remoto el comportamiento del login.
- Monitorear si la inyección del script causa algún efecto secundario en otras partes del sitio.
