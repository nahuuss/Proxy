# Corrección de Descargas y Optimización del Heartbeat Shield - 04/05/2026

## Problemas Identificados
1.  **Corrupción de Excel**: Al generar archivos grandes, el servidor tardaba más de 45 segundos, disparando el *Heartbeat Shield*. Al terminar el proceso, el proxy volcaba los datos binarios al final del HTML de la pantalla de carga, corrompiendo el archivo e impidiendo su apertura.
2.  **Pantalla Blanca en POST**: Las peticiones `POST` de navegación completa (como el botón "Generar" en ASP.NET) no activaban el spinner correctamente, dejando al usuario con una pantalla blanca durante el procesamiento.
3.  **Botón Volver Inoperativo**: El botón "Volver" en la pantalla de éxito de descarga fallaba debido a un error de sintaxis en el JavaScript inyectado (conflicto de comillas).
4.  **Basura en Binarios**: Algunos servidores inyectaban espacios o texto antes de la firma del archivo (PK, OLE), lo que causaba errores de formato en Excel.

## Soluciones Implementadas

### 1. Forzado de Buffering en Modo Heartbeat
- Se modificó la lógica de decisión de reescritura (`needsRewrite`). Ahora, si el *Heartbeat Shield* está activo, el proxy **siempre** captura la respuesta en un buffer, independientemente de si es texto o binario.
- Esto permite interceptar la respuesta completa y decidir si enviarla como HTML o como una descarga de archivo limpia.

### 2. Detección Robusta de Firmas Binarias
- Se implementó un sistema de búsqueda de firmas en los primeros 2KB del buffer:
    - `PK` (0x50 0x4B) para archivos Office modernos (.xlsx).
    - `OLE` (0xD0 0xCF 0x11 0xE0) para archivos Office antiguos (.xls).
    - `%PDF` (0x25 0x50 0x44 0x46) para archivos PDF.
- **Auto-Trimming**: Si la firma no comienza en el índice 0, el proxy recorta el buffer automáticamente para eliminar cualquier residuo de texto o espacios previos.

### 3. Entrega vía JS Blob
- Se utiliza la función `serveAsBlobDownload` para enviar un script que:
    - Cierra el comentario HTML del Heartbeat.
    - Convierte el buffer Base64 a un Blob.
    - Dispara la descarga en el navegador con el nombre de archivo original.
    - Muestra una interfaz de éxito con un botón "Volver" funcional.

### 4. Corrección del Botón Volver
- Se movió la URL de retorno a una variable de script (`bu`) para evitar conflictos con las comillas del atributo `onclick`.
- Se añadió soporte para `backUrl` en la página de procesos en segundo plano (`renderBgJobPage`).

## Archivos Modificados
- `src/lib/proxy-server.ts`: Lógica de buffering y detección de firmas.
- `src/lib/proxy-utils.ts`: Lógica de descarga Blob y renderizado de páginas de espera.

## Próximos Pasos
- Monitorear el consumo de memoria en descargas extremadamente grandes (>100MB) debido al buffering forzado en modo HB.
- Verificar el comportamiento en navegadores con políticas de seguridad (CSP) restrictivas respecto a Blobs.
