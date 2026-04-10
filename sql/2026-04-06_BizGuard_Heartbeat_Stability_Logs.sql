-- *****************************************************************************
-- Implementación: Mejoras de Estabilidad Heartbeat y Diagnóstico (v1.3.1)
-- Fecha: 2026-04-06
-- *****************************************************************************

-- NOTA: Esta implementación no modifica el esquema físico de la base de datos,
-- se centra en la lógica de servidor Node.js (Proxy) y observabilidad.

-- RESUMEN DE CAMBIOS:
-- 1. Aumento de límite de memoria para Requests a 500MB (MAX_REQUEST_BODY_MB).
-- 2. Incremento de tiempo de gracia HB_FIRST_PULSE_MS a 45s.
-- 3. Implementación de sistema de logs circular en hb.log.
-- 4. Fix de inyección de comentarios HTML para evitar corrupción de JSON (XHR).
-- 5. Fix de renderizado de caracteres Unicode en pantallas de espera.
-- 6. Reparación del evento onclick del botón "Volver" en descargas Blob.

-- REGISTRO DE ESTADO:
-- Se confirma que el sistema de Heartbeat Shield es capaz de mantener conexiones
-- activas por más de 20 minutos (1419s), superando los límites estándar.
-- El diagnóstico indica que fallas superiores a 23 min son debidas a carga en el
-- servidor backend o bloqueos de sesión (Session Locking).

PRINT 'Implementación v1.3.1 (Estabilidad) registrada con éxito.';
