/*
  IMPLEMENTACIÓN: Estabilización Final Serena-Test
  FECHA: 2026-04-29
  DESCRIPCIÓN: Registro de cambios en lógica de proxy y limpieza de rutas para el entorno de staging.
*/

-- Registro de la tarea en el historial de BizGuard (Meta-data)
INSERT INTO BizGuard_Tasks (TaskDate, ProductName, TaskDescription, Status)
VALUES (
    GETDATE(), 
    'Serena-Test', 
    'Implementación de Auto-Reload post-login e inyección de script PRM para estabilización de AJAX Delta en DNN.', 
    'COMPLETED'
);

-- Actualización de la versión del producto Serena-Test en configuración
UPDATE BizGuard_Products 
SET ConfigVersion = '1.0.6',
    LastStabilizationDate = GETDATE(),
    Features = Features + ';InfraFix;AutoReload_v2'
WHERE ProductName = 'Serena-Test';

-- Log de limpieza de rutas (Ejemplo de lo que se corrige)
-- Pattern: (\/Portals\/[^"'<>\s\/]+)\/+(Portals\/)
-- Target: /Portals/0//Portals/0/ -> /Portals/0/
