# Registro de Implementación: Switch de Depuración HAR en Conectores

**Fecha:** 10 de junio de 2026  
**Objetivo:** Integrar un switch de depuración avanzado por conector que permita capturar trazas de tráfico HTTP detalladas (similares a un archivo HAR) que incluyan marcas de tiempo, datos de la solicitud y respuesta, y el usuario que realizó la operación, con el fin de detectar errores e inconsistencias entre conectores sin penalizar el rendimiento ni agotar la memoria.

## Archivos Creados / Modificados

### Creados
* [compile-har.js](file:///e:/Desarrollo/BizGuard/scratch/compile-har.js): Script para compilar el log de líneas JSON (`.jsonl`) a un archivo `.har` tradicional.
* [logger-har.ts](file:///e:/Desarrollo/BizGuard/src/lib/logger-har.ts): Módulo encargado de estructurar y persistir los logs en formato JSON Lines (`.jsonl`) de manera asíncrona.

### Modificados
* [connectors.ts](file:///e:/Desarrollo/BizGuard/src/lib/connectors.ts): Se agregó la propiedad opcional `harLog?: boolean` al modelo `Connector`.
* [actions.ts](file:///e:/Desarrollo/BizGuard/src/app/actions.ts): Se lee y persiste el switch `harLog` desde el formulario de actualización del conector.
* [proxy-server.ts](file:///e:/Desarrollo/BizGuard/src/lib/proxy-server.ts): Intercepción de peticiones/respuestas (estándar y NTLM) y envío de datos al módulo de logs HAR.
* [ConnectorRow.tsx](file:///e:/Desarrollo/BizGuard/src/components/ConnectorRow.tsx): Se añadió el switch "Debug HAR" en el panel "General" de configuración y un indicador visual `"HAR"` en la fila del conector.

## Decisiones Técnicas

1. **Formato JSON Lines (NDJSON):** Escribir archivos `.har` directamente es ineficiente en Node.js debido a que requeriría leer, parsear, modificar y serializar un archivo JSON grande en cada solicitud. En su lugar, se registran las entradas como líneas JSON individuales (`.jsonl`), lo que permite el uso de `fs.appendFile` asíncrono y no bloqueante.
2. **Límite de Tamaño de Cuerpos (2MB):** Se estableció un límite estricto de 2MB para almacenar el cuerpo de peticiones y respuestas de tipo texto (HTML, JSON, JS).
3. **Optimización de Streaming Directo (`overrideResBodySize`):** Para transferencias de archivos grandes y binarios, no se recolecta el cuerpo en memoria; se calcula su tamaño dinámicamente y se almacena en el campo de tamaño sin inicializar buffers intermedios.
4. **Detección de Sesiones:** El usuario se obtiene a través de `req.session` (NextAuth) o el objeto `session.crmUser` generado durante el handshake NTLM.

## Instrucciones de Uso

1. Ingresar al panel de control de BizGuard.
2. Editar el conector deseado haciendo clic en el icono de herramientas (Settings).
3. En la pestaña **General**, activar la opción **Debug HAR**.
4. Guardar los cambios. El conector se reiniciará automáticamente con el log de trazas HAR activo.
5. El log se guardará en `logsdebug/har-{connectorId}.jsonl`.

## Cómo Verificar e Importar en el Navegador

1. Realizar una petición a través del conector (ej: `http://localhost:8081/...`).
2. Comprobar que se ha creado/actualizado el archivo de logs correspondiente en `logsdebug/har-{connectorId}.jsonl`.
3. Compilar el archivo al formato HAR estándar ejecutando:
   ```bash
   node scratch/compile-har.js logsdebug/har-{connectorId}.jsonl
   ```
4. Se generará el archivo `logsdebug/har-{connectorId}.har`.
5. Abrir la pestaña **Network** del inspector de elementos de Chrome/Edge/Firefox, hacer clic derecho y seleccionar **Import HAR file...** (o arrastrar y soltar el archivo). Podrás ver toda la cascada de peticiones capturada por el proxy como si se hubiese grabado directamente desde el navegador.
