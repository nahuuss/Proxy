/*
  IMPLEMENTACIÓN: Corrección de Descargas Excel y Optimización Heartbeat Shield
  FECHA: 2026-05-04
  DESCRIPCIÓN: Solución a corrupción de archivos, volcado binario en pantalla y fallos en navegación POST.
*/

-- Registro de la tarea en el historial de BizGuard
-- Nota: Se asume la existencia de la tabla en el esquema de control centralizado
INSERT INTO BizGuard_Tasks (TaskDate, ProductName, TaskDescription, Status)
VALUES (
    GETDATE(), 
    'Core-Product', 
    'Corrección de corrupción en descargas Excel mediante buffering forzado y limpieza de firmas binarias en modo Heartbeat.', 
    'COMPLETED'
);

-- Actualización de versión y features para el conector Core
UPDATE BizGuard_Products 
SET ConfigVersion = '1.2.5',
    LastStabilizationDate = GETDATE(),
    Features = Features + ';BinarySignatureFix;HB_Buffering;BlobDownload_v2'
WHERE ProductName = 'Core';

-- Log de firmas soportadas para referencia
-- PK (.xlsx): 50 4B
-- OLE (.xls): D0 CF 11 E0
-- PDF (.pdf): 25 50 44 46
