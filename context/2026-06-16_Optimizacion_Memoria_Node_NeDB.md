# Optimización de Memoria y Resolución de Fugas en Node y NeDB

* **Fecha**: 2026-06-16
* **Objetivo**: Resolver el consumo excesivo y progresivo de memoria RAM del servicio de Node (BizGuard/Proxy) después de 24 horas de actividad ininterrumpida.

---

## Archivos Creados/Modificados

* [src/lib/db.ts](file:///e:/Desarrollo/BizGuard/src/lib/db.ts) (Modificado)
* [src/lib/proxy-manager.ts](file:///e:/Desarrollo/BizGuard/src/lib/proxy-manager.ts) (Modificado)
* [src/lib/proxy-server.ts](file:///e:/Desarrollo/BizGuard/src/lib/proxy-server.ts) (Modificado)

---

## Decisiones Técnicas

### 1. Compactación Periódica en NeDB v4 (`db.ts`)
* **Problema**: NeDB almacena la información agregando registros al final del archivo (esquema *append-only*). Sin compactación periódica, el archivo en disco y el índice en memoria RAM crecen indefinidamente por cada escritura o modificación. Además, al intentar configurar la autocompactación con métodos antiguos de NeDB (`setAutocompactInterval`), el servidor fallaba en el arranque con `TypeError: o.setAutocompactInterval is not a function` debido a que la versión `@seald-io/nedb` (v4+) ha deprecado/removido dicho método de la API principal.
* **Solución**: Se implementó una rutina de compactación manual asíncrona mediante un `setInterval` de **12 horas** que se invoca de manera segura sólo cuando el sistema no está en fase de compilación (`isBuildPhase()`). La rutina utiliza el método asíncrono válido de la librería: `.compactDatafileAsync()`. Se aplica a las tres colecciones:
  * `connectorsDb`
  * `metricsDb`
  * `settingsDb`
* Adicionalmente, el intervalo se configura con `.unref()` para evitar que Node mantenga el proceso activo en caso de que todo lo demás haya finalizado.

### 2. Reducción de I/O y Sincronización en Disco (`proxy-manager.ts`)
* **Problema**: El proxy sincronizaba estadísticas e historiales en disco escribiendo en el archivo `sync.json` de manera excesivamente frecuente (cada **500 ms**). Esto generaba una sobrecarga constante de operaciones de entrada/salida (I/O) de archivos y encolaba procesos pesados de serialización de JSON en el hilo principal de Node, elevando la memoria consumida.
* **Solución**: Se incrementó el intervalo de sincronización de `sync.json` a **5000 ms** (5 segundos). Esto reduce en un 90% las operaciones de disco e I/O, disminuyendo drásticamente el consumo de CPU y evitando que el recolector de basura de Node se vea saturado de buffers efímeros.

### 3. Liberación de Buffers de Trabajos Pesados (`proxy-server.ts`)
* **Problema**: Los archivos y flujos de datos pesados que pasaban por el proxy para conectores que requerían el flujo de fondo (*background jobs*) retenían los buffers de respuesta completos en memoria dentro del mapa `bgJobs`. Una vez que el cliente consultaba el resultado final a través de la ruta `/__bizguard_job/{id}/result`, la memoria continuaba reservada debido a que no se eliminaba el objeto del mapa.
* **Solución**: Se añadió una instrucción de limpieza explícita: `bgJobs.delete(jobId)` inmediatamente después de enviar los bytes de respuesta al cliente.

### 4. Limpieza Robusta en Conexiones SSE (`proxy-server.ts`)
* **Problema**: Las conexiones SSE (Server-Sent Events) abiertas en la ruta de monitoreo `/__bizguard_status/stream` dejaban intervalos activos y listeners enlazados al emisor de eventos si el cliente se desconectaba de forma abrupta, provocando una fuga de sockets abiertos y listeners duplicados.
* **Solución**: Se centralizó la lógica de desuscripción de eventos en una función unificada `cleanupSSE`. Esta función se ejecuta ante cualquier evento de desconexión del cliente (`req.on('close')`, `req.on('aborted')`, `res.on('close')` y `res.on('finish')`), asegurando que:
  * Se limpie el intervalo del latido (`clearInterval(heartbeat)`).
  * Se remueva el listener del emisor de eventos global (`statusEvents.off("status", onStatus)`).
  * Se eviten llamadas concurrentes o duplicadas en la desconexión mediante un flag `cleaned`.

---

## Instrucciones de Uso y Verificación

### Proceso de Despliegue
Para aplicar los cambios y regenerar el paquete standalone listo para producción:

1. Detener el proceso activo de Node (si se encuentra ejecutando `node server.js`).
2. Abrir una consola de PowerShell en la raíz del proyecto.
3. Ejecutar el script de despliegue para limpiar la caché anterior y empaquetar de forma limpia:
   ```powershell
   .\preparar-despliegue.ps1
   ```
4. Iniciar el servidor desde la carpeta de distribución generada (`BizGuard`):
   ```bash
   cd BizGuard
   node server.js
   ```

### Verificación del Consumo de RAM
1. **Verificación Inicial**: Validar que el servidor arranque correctamente sin lanzar el error de carga de hook/compresión (`TypeError: An error occurred while loading instrumentation hook`).
2. **Estabilidad de Memoria**: Dejar el servicio en ejecución y monitorear el consumo de memoria del proceso de Node (`node.exe`) utilizando el Administrador de Tareas o ejecutando en PowerShell:
   ```powershell
   Get-Process node | Select-Object Id, ProcessName, WorkingSet64
   ```
   El consumo de memoria no debería presentar incrementos lineales infinitos tras sucesivas consultas de los conectores o tras descargar archivos pesados.
3. **Monitoreo de Eventos**: Confirmar que al abrir y cerrar la interfaz de control y las pestañas que hacen uso del stream de estados, el contador de listeners activos del sistema no crezca y la memoria se estabilice tras las desconexiones.
