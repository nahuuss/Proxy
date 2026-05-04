/*
  IMPLEMENTACIÓN: Personalización del Formulario de Login NTLM
  FECHA: 2026-04-29
  DESCRIPCIÓN: Ajuste de etiquetas (Legajo, Acceso a CRM) y ocultación del campo dominio en el frontend.
*/

-- Registro de la tarea en el historial de BizGuard
INSERT INTO BizGuard_Tasks (TaskDate, ProductName, TaskDescription, Status)
VALUES (
    GETDATE(), 
    'NTLM-Login', 
    'Personalización de UI: Cambio de etiquetas a "Legajo", "Acceso a CRM" y ocultación del campo Dominio (Default: SERENASEGUROS).', 
    'COMPLETED'
);

-- Nota: No se requieren cambios en el esquema de base de datos ya que el dominio 
-- se maneja como valor oculto en el frontend o fallback en el servidor de auth.
