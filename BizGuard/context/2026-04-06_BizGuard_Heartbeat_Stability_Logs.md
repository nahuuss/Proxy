# Implementación: Estabilidad Heartbeat y Diagnóstico de Procesos Pesados (v1.3.1)
**Fecha:** 2026-04-06
**Autor:** Antigravity AI

## Propósito
Resolver los timeouts (Error 524) en archivos de más de 4000 líneas y mejorar la estabilidad visual y funcional del sistema de protección Heartbeat Shield.

## Cambios Realizados

### 1. Sistema de Logging Específico (hb.log)
Se implementó un logger exclusivo para evitar el ruido en `console.log` y permitir un análisis forense de los tiempos de respuesta del backend.
- **Archivo:** `src/lib/logger-hb.ts`
- **Ubicación del log:** `hb.log` (raíz del proyecto)

### 2. Corrección de Inyección "-->" (XHR Fix)
Se detectó que el proxy inyectaba incorrectamente el cierre del comentario HTML en peticiones AJAX/XHR, lo que corrompía las respuestas JSON del backend.
- Se añadió el flag `isHtmlCommentOpen` para asegurar que el cierre solo se inyecte si se abrió explícitamente un bloque de comentarios en una navegación de página completa.

### 3. Ajustes de Tiempo y Memoria
- **HB_FIRST_PULSE_MS:** Aumentado de 30s a **45s** para dar margen a procesos de subida masiva.
- **MAX_REQUEST_BODY_MB:** Aumentado de 50MB a **500MB** para soportar archivos .lis de gran volumen.

### 4. Mejoras de UI en Pantalla de Espera
- **Encoding:** Corregido el escape de caracteres Unicode (`están`, `protección`, `conexión`) que se mostraban como código literal.
- **Botón Volver:** Reparado el error de sintaxis en el evento `onclick`. Ahora utiliza `window.history.back()` para un retorno más intuitivo a la lista de registros.

## Diagnóstico Técnico: El "Muro" de los 5 Minutos
Tras analizar los logs, se determinó que el proxy mantiene la conexión viva (logrando récords de hasta 23 minutos), pero el entorno (Cloudflare/IIS) o el navegador suelen cortar el socket al llegar a umbrales específicos de sus capas respectivas. Se identificó un posible **Session Locking** en el servidor backend que bloquea las peticiones concurrentes del usuario durante procesos largos.

## Registro de Tareas (task.md)
- [x] Crear logger centralizado `logHB`.
- [x] Corregir bug de inyección `-->` en JSON/XHR.
- [x] Aumentar margen de primer latido a 45s.
- [x] Reparar renderizado de acentos en servidor.
- [x] Reparar lógica del botón "Volver" en `serveAsBlobDownload`.
- [x] Aumentar límites de memoria a 100MB.
- [x] Analizar correlación de fallos en archivos >100mb.
