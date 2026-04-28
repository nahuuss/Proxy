# Documentación de Implementación: Estabilización de Subida de Archivos (Fase 2)

**Fecha:** 2026-04-24
**Módulo:** ABMTramiteMedico (Proxy BizGuard)
**Problema:** "Explorador sobrecargado" al activarse el Heartbeat Shield en subidas de 11 archivos.

## Análisis de Causa Raíz
Los logs confirmaron que el Heartbeat Shield (HB) se activaba correctamente 45s después del upload. Sin embargo:
1. El sistema detectaba el POST como "no XHR" (falta de header `X-Requested-With`).
2. Esto provocaba el envío del **modal HTML del spinner**.
3. Al recibir HTML en una petición de subida de archivos (que espera una respuesta de datos o redirección), el navegador colapsaba.

## Cambios Realizados

### proxy-server.ts
- **Modo Pasivo Universal para POST**: Se forzó que todas las peticiones `POST` (especialmente subidas) utilicen el modo **Pasivo (Spaces)**.
- **Inhibición de HTML Visual en POST**: Se restringió el envío del modal HTML únicamente a peticiones `GET` de navegación. Para `POST` y `XHR`, BizGuard ahora solo envía un **espacio en blanco (' ')** cada 15 segundos.
- **Detección de Datos Mejorada**: Se amplió `isXhr` para detectar subidas de archivos (`multipart/form-data`) y peticiones que aceptan JSON, evitando inyectar HTML en flujos de datos.

## Beneficio
La conexión con Cloudflare se mantiene viva mediante el envío de pulsos invisibles (espacios), lo que evita el error 524 sin interferir con la lógica del cliente (navegador). El usuario no verá el spinner de BizGuard en los uploads, pero la subida no se cortará.

## Próximos Pasos
- Verificar si el error de "Explorador sobrecargado" desaparece con la subida de 11 archivos.
