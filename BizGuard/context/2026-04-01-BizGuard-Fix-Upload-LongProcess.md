# BizGuard v1.3.1 - Corrección: Uploads de Archivos y Procesos POST Largos

Fecha: 2026-04-01
Estado: Implementado en `src/lib/proxy-server.ts`

## Problema
Las subidas de archivos (POST) que tardaban más de 55 segundos en procesarse en el backend activaban prematuramente el **Heartbeat Shield**. 
Al activarse, el escudo enviaba una respuesta `200 OK` con HTML de "Procesando..." al navegador. 
Si el backend del cliente, tras procesar los datos (ej. un archivo de 4900 líneas), intentaba realizar una redirección (`302`) o devolver un JSON, el navegador lo ignoraba o fallaba porque los encabezados de respuesta ya habían sido emitidos por el escudo.

## Solución
Se ha refactorizado la lógica de elegibilidad del Heartbeat Shield (`hbEligible`) para restringir su activación automática solo a peticiones de tipo **GET**.

- **Peticiones POST, PUT, DELETE, PATCH**: Ahora esperarán indefinidamente al backend sin que el escudo interfiera enviando respuestas preliminares. Esto asegura que las redirecciones post-upload funcionen correctamente.
- **Forzado Manual**: Si una petición POST específica requiere el escudo (para evitar timeouts de Azure/Cloudflare en procesos que NO redirigen), se puede seguir forzando agregando la URL al campo `hbForceUrls` del conector.

## Archivos Modificados
- [proxy-server.ts](file:///e:/Proxy/src/lib/proxy-server.ts): Modificación de la variable `hbEligible` incorporando el chequeo de `req.method`.

## Verificación
- Se ha revisado que el cambio no afecte a los reportes GET pesados (que seguirán mostrando el escudo tras 55s).
- Se ha validado que las peticiones POST ahora son ignoradas por el timer del escudo.
