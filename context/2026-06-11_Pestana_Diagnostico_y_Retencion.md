# Implementación: Pestaña de Diagnóstico y Retención de Logs Configurable

**Fecha**: 2026-06-11
**Objetivo**: Reestructurar las opciones de diagnóstico de la edición de conectores, moviendo los controles (HAR Log, Log de Tráfico, Umbral de Heartbeat) a una nueva pestaña "Diagnóstico". Adicionalmente, agrupar los logs de tráfico bajo carpetas de conector en lugar de usuario para permitir registrar peticiones anónimas e implementar un tiempo de retención configurable de logs a nivel de cada conector.

---

## Archivos Creados/Modificados

- **[src/lib/connectors.ts](file:///e:/Desarrollo/BizGuard/src/lib/connectors.ts)**: Se agregaron las propiedades opcionales `trafficRetentionValue` y `trafficRetentionUnit` en la interfaz `Connector`.
- **[src/lib/logger-traffic.ts](file:///e:/Desarrollo/BizGuard/src/lib/logger-traffic.ts)**: Se modificó la estructura para agrupar por conector (`logs/traffic/{connectorId}/`) en lugar de por usuario y se implementó una retención de tiempo configurable basada en las propiedades del conector.
- **[src/lib/proxy-server.ts](file:///e:/Desarrollo/BizGuard/src/lib/proxy-server.ts)**: Se habilitó el logging para peticiones anónimas ( bypass SSO ) identificadas con el usuario `'anonymous'`. Adicionalmente, se corrigió el bug de superposición visual de la pantalla de carga del Heartbeat Shield, inyectando un script autolimpiador al cerrar el comentario HTML de streaming.
- **[src/app/actions.ts](file:///e:/Desarrollo/BizGuard/src/app/actions.ts)**: Se modificaron las server actions de creación y actualización para extraer y persistir los nuevos campos de retención en NeDB.
- **[src/components/ConnectorRow.tsx](file:///e:/Desarrollo/BizGuard/src/components/ConnectorRow.tsx)**: Se creó la pestaña "Diagnóstico" en la edición de conectores, se reubicaron allí los controles de diagnóstico anteriores y se añadieron inputs interactivos de retención de logs.
- **[src/components/AddConnectorForm.tsx](file:///e:/Desarrollo/BizGuard/src/components/AddConnectorForm.tsx)**: Se añadieron los campos equivalentes para la retención en el paso 5 del Wizard de creación de conectores.
- **[scratch/SimService.ps1](file:///e:/Desarrollo/BizGuard/scratch/SimService.ps1)**: Se extendieron los endpoints de prueba, se aumentó la duración de procesamiento de uploads a 15 segundos y se rediseñó el Dashboard HTML local con botones interactivos para testear casos de borde históricos. Adicionalmente, se forzó la codificación UTF-8 con BOM y se reemplazaron las tildes y eñes por entidades HTML para resolver problemas de codificación (mojibake) en el navegador del cliente.

---

## Decisiones Técnicas

1. **Agrupación por Conector**: Para registrar conexiones anónimas y no requerir el nombre de usuario de inicio, las carpetas de log de tráfico en el filesystem pasaron de `logs/traffic/{user}/` a `logs/traffic/{connectorId}/`.
2. **NeDB Libre de Esquema**: Por tratarse de una base de datos NoSQL documental, no fue necesario realizar alteraciones físicas en la BD. Los conectores antiguos se recuperan con valores `undefined` para los nuevos campos y son interpretados defensivamente con fallbacks lógicos predeterminados (ej: 5 horas para retención de logs de tráfico, 20 segundos para heartbeat).
3. **Limpieza Asíncrona con fs Síncrono**: La función periódica `cleanup` en `TrafficLogger` se definió de forma asíncrona para consultar `getConnectors()` desde NeDB, manteniendo el uso de métodos síncronos de `fs` para evitar condiciones de carrera al manipular archivos abiertos simultáneamente.
4. **Autolimpieza de Elementos del Heartbeat Shield**: En el modo de navegación full-page (streaming chunked), para evitar que la pantalla de carga "`⏳ Procesando archivo...`" y sus estilos flexbox contaminaran o taparan la respuesta real del backend una vez cargada, se asignó un `id="bg-style"` a la etiqueta de estilos inyectada y se inyectó un script de limpieza tras el cierre del comentario HTML (`-->`). Este script remueve el modal `#m`, el estilo `#bg-style` y destruye el intervalo `_iv` del cronómetro para prevenir fugas de memoria y errores silenciosos en la consola del navegador.
5. **Simulación de Escenarios Históricos en SimService**: Para robustecer las pruebas contra errores previamente reportados en producción (fugas de memoria en AJAX, corrupción de descargas binarias y redirecciones 302 fallidas tras activar Heartbeat), se añadieron endpoints que demoran 15 segundos (superando el heartbeat de 12s) y devuelven tipos de respuesta específicos: JSON puro para XHR (modo TCP Keep-Alive), adjunto de PDF binario (modo JS Blob Download) y redirecciones HTTP 302 (modo JS Redirect).
6. **Detección de AJAX/XHR Robusta para el Heartbeat**: Para evitar que llamadas asíncronas modernas como `fetch()` (que no envían la cabecera `X-Requested-With` por defecto) sean tratadas erróneamente como navegaciones de página completa e inyecten el spinner HTML (corrompiendo la respuesta esperada como JSON), se rediseñó la variable `isAjax`. Ahora analiza además las cabeceras estándar `Sec-Fetch-Mode !== 'navigate'` y que el header `Accept` no contenga `text/html`. Si se cumple cualquiera, se activa de forma segura el modo TCP Keep-Alive sin modificar el cuerpo de la respuesta.

---

## Instrucciones de Uso y Cómo Verificar

### Edición
1. Abre el panel de administración de BizGuard.
2. Selecciona un conector y presiona el botón **Configuración** (icono de engranaje).
3. Ve a la pestaña **Diagnóstico**.
4. Activa **Log de Tráfico y Diagnóstico**, define un **Tiempo de Retención** (por ejemplo, `30 segundos`) y presiona **Guardar Cambios**.
5. Realiza peticiones a través del puerto configurado para el proxy.
6. Abre la carpeta `logs/traffic/{connectorId}/` y confirma que se generan los logs JSONL.
7. Transcurridos 30 segundos, verifica que la limpieza periódica remueve el archivo correspondiente.

### Creación
1. Haz clic en **Dar de Alta Nuevo BizGuard**.
2. Completa los pasos del asistente.
3. En el **Paso 5: Logs**, configura el tiempo de retención deseado y presiona **Deploy**.

### Simulador de Backend (SimService.ps1)
1. Ejecuta el script `SimService.ps1` en PowerShell (`powershell -File scratch/SimService.ps1`). Asignará un puerto libre (ej: 8085).
2. Usa esta dirección como la "URL Interna" al crear o editar tu conector en BizGuard.
3. Abre el conector en tu navegador, realiza el login ficticio para habilitar el Dashboard de SimService.
4. Prueba cada escenario interactivo para validar la estabilidad del Heartbeat Shield:
   - **Upload de 15s**: Sube un archivo en el formulario; BizGuard disparará el spinner de carga y la subida se procesará limpia a los 15s.
   - **AJAX Lento (15s)**: Cuenta con 3 botones individuales para simular y validar las 3 ramas de detección robusta de BizGuard:
     1. *X-Requested-With*: Envía la cabecera clásica `X-Requested-With: XMLHttpRequest`.
     2. *Sec-Fetch-Mode*: Envía una petición `fetch()` asíncrona estándar (que de forma nativa incluye `Sec-Fetch-Mode: same-origin`).
     3. *Accept Header*: Envía la cabecera `Accept: application/json` indicando que prefiere datos en lugar de páginas HTML.
     Cualquiera de las 3 peticiones finalizará correctamente con la impresión del JSON procesado en el Dashboard y la consola sin que BizGuard inyecte código HTML.
   - **PDF Lento (15s)**: Presiona "Descargar PDF (15s)". BizGuard inyectará el modal de carga y, al finalizar, descargará un PDF sin corrupción de bytes.
   - **Redirección 302 Lenta (15s)**: Presiona "Ejecutar Redirección 302". Se activará la pantalla de carga y a los 15s redirigirá automáticamente a la home mediante JavaScript.
