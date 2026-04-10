# Documentación Técnica: Heartbeat Híbrido Automático (V3)
**Fecha: 2026-04-01**
**Estado: Implementado / Estable**

## 1. Contexto del Problema
Anteriormente, BizGuard requería una configuración manual de las URLs para activar el modo "Background Job" en peticiones POST largas. Si una URL no estaba en la lista, Cloudflare cortaba la conexión a los 100 segundos con un error **524 (Timeout)**.

Además, el Heartbeat pasivo (enviar espacios) era compatible con GET, pero rompía las respuestas POST (especialmente redirecciones y JSON).

## 2. Solución Implementada (Universal v3)
Se ha implementado una lógica de detección y respuesta automática en el proxy:

### A. Rastreo Universal
Todas las peticiones entrantes (no estáticas y no AJAX) reciben un `jobId` único al inicio. Esto permite que el proxy capture el resultado del backend de forma resiliente, incluso si el cliente se desconecta.

### B. Conmutación Inteligente (Híbrida)
BizGuard monitoriza el tiempo de respuesta del backend. Al alcanzar los **55 segundos** (margen de seguridad para Cloudflare), el proxy toma una decisión basada en el método HTTP:

- **GET**: Activa el **Escudo Pasivo**. El usuario sigue en la página actual viendo un contador de tiempo real. El proxy envía chunks de datos (espacios) para mantener el socket vivo.
- **POST/PUT/etc**: Activa el **Background Job**. BizGuard responde inmediatamente con una página de polling (`renderBgJobPage`). 
    - El navegador "completa" la subida desde su perspectiva.
    - El usuario ve una pantalla de carga de BizGuard.
    - El backend sigue procesando la subida en segundo plano.
    - Al finalizar, el polling captura el resultado real (redirección, JSON, etc.) y lo aplica en el navegador.

## 3. Beneficios
- **Zero Config**: No requiere configuración manual de URLs forzadas.
- **Compatibilidad Total**: Soporta redirecciones de Azure y Cloudflare sin errores de protocolo.
- **Resiliencia**: Si el usuario cierra el navegador, el proceso en el servidor continúa y el resultado se guarda durante 30 minutos.

## 4. Archivos Modificados
- `src/lib/proxy-server.ts`: Lógica de conmutación híbrida y universalización de `jobId`.
- `context/`: Documentación histórica actualizada.
