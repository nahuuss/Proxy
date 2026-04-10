# Implementación Proxy V62.x - Robustez de Dominios y Sesión

**Fecha:** 2026-03-19  
**Versión Final:** V62.6  
**Objetivo:** Resolver problemas de renderizado (botones faltantes), errores 404 en archivos estáticos y desincronización AJAX detectados bajo Azure AD Application Proxy.

## Resumen de Problemas Detectados
1. **Aislamiento de Sesión (Cookie Path):** El servidor enviaba cookies con `path=/SIN/`, impidiendo que el navegador las enviara a carpetas raíz como `/App_Themes/` o `/Js/`, causando errores 404/302.
2. **Error en Motor AJAX:** Un bug en la reconstrucción de bloques AJAX (falta de prefijo `|`) rompía el script del cliente, impidiendo actualizaciones parciales y funcionalidad de botones.
3. **Clasificación Incorrecta:** Diferenciación entre HTML, JSON y JS para aplicar reglas de reescritura específicas.
4. **Impacto de Logs en Rendimiento:** Logs de páginas de >2MB saturaban el canal IPC, causando inestabilidad en los Workers.

## Cambios Realizados (V62.0 a V62.6)

### 1. Reescritura de Cookie-Path (V62.6)
Se interceptan todas las cabeceras `Set-Cookie` para forzar `path=/`. 
Esto asegura que la sesión de autenticación sea compartida con todos los recursos estáticos del sitio, eliminando los errores 404 en temas y scripts.

### 2. Corrección de Reensamblado AJAX (V62.5)
Se corrigió la lógica de reconstrucción de bloques para seguir el formato exacto de ASP.NET AJAX: `|length|type|id|content|`. Se aseguró que cada bloque mantenga sus delimitadores intactos tras la reescritura de URLs internas.

### 3. Reescritura Robusta de Dominios
Se implementó un motor basado en expresiones regulares para detectar y eliminar el `INTERNAL_TARGET` (coretest.serenaart.com.ar), reemplazándolo por rutas relativas a raíz (`/`). Esto unifica el comportamiento tanto en HTML como en bloques AJAX.

### 4. Estabilización de Diagnósticos
- **Límite de Snippet:** Se impuso un límite de 50,000 caracteres para los logs de contenido completo, evitando fallos de IPC.
- **Escritura Atómica:** Cambio a `appendFileSync` para evitar corrupción de logs cuando múltiples Workers escriben simultáneamente.

### 5. Trazado de Depuración
Se agregaron alertas:
- `[SESSION-INFO]`: Tamaño de cookie recibida por archivo.
- `[DEBUG-HDR]`: Detalles de Referer y Cookie en caso de errores >= 400.

## Verificación
- Se confirmó el reescrito de 104 URLs en una sola carga.
- Se verificó que los bloques AJAX ahora se ensamblan con el formato correcto.
- Se validó que el Referer se reescribe a HTTPS con el dominio interno para compatibilidad con el backend.

---
*Documento generado por Antigravity para el historial de arquitectura del proyecto.*
