-- Documentación de configuración SQL para SSO Microsoft Entra ID
-- Fecha: 2026-04-07

/*
NOTA: Esta implementación no requirió cambios directos en el esquema de la base de datos SQL Server.
Sin embargo, se documenta la configuración del Connector relacionado con el dominio público bank.bzld.click
que es detectado dinámicamente por auth.ts para las redirecciones.
*/

-- Consulta para verificar el conector activo para el dominio del banco
-- SELECT * FROM [dbo].[Connectors] WHERE [Host] LIKE '%bank.bzld.click%';

-- En caso de requerir un backup de la configuración de roles asignados por SSO:
-- SELECT * FROM [dbo].[SSORoleMappings];

-- Los cambios actuales se centraron en la capa de lógica (auth.ts) y variables de entorno (.env.local)
-- específicos para estabilizar el handshake de OAuth2/OIDC bajo un Proxy Reverso HTTPS -> HTTP.
