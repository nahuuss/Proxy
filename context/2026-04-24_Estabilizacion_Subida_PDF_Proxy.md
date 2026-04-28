# Documentación de Implementación: Estabilización de Subida de Archivos

**Fecha:** 2026-04-24
**Módulo:** ABMTramiteMedico (Proxy BizGuard)
**Problema:** Fallo en subida de 11 archivos PDF (Error 524 / Explorador Sobrecargado).

## Análisis Técnico
Se detectó que el **Heartbeat Shield (HB)** se estaba activando prematuramente. El cálculo del primer pulso (45s) se realizaba desde el inicio del request. En subidas de archivos grandes:
1. El upload consumía casi todo el tiempo del margen (o lo superaba).
2. Al terminar el upload, BizGuard activaba el HB casi inmediatamente (a los 5s).
3. El envío del HTML del spinner de BizGuard interfería con el procesamiento del navegador, resultando en "Explorador sobrecargado".
4. Cloudflare podía cortar la conexión si el HB no lograba activarse correctamente debido a la saturación del socket durante el upload.

## Cambios Realizados

### proxy-server.ts
- **Relatividad del Timer**: Se modificó `startHbShield` para que el `remainingTime` sea siempre `HB_FIRST_PULSE_MS` (45s) sin restar el tiempo ya transcurrido.
- **Trigger Post-Upload**: Se aseguró que `startHbShield` se llame específicamente al evento `req.on('end')` (fin de subida). 
- **Trazabilidad**: Se agregó el log `[UPLOAD-DONE]` para identificar exactamente cuándo termina la transferencia de archivos y empieza el procesamiento del servidor.
- **Margen de Seguridad**: Al resetear el timer después del upload, se aprovecha que Cloudflare también resetea su timer de 100s al recibir el cuerpo completo del request, dando un margen real de 45s de procesamiento limpio al backend antes de intervenir con el escudo.

## Logs de Referencia
- `[UPLOAD-DONE] Subida completada para /SIN/TramiteMedico/... Iniciando cuenta regresiva de 45s para HB.`
- `[HB-SHIELD] Pasivo (Spaces) ... Iniciado tras 125s (core-serena)` -> Ejemplo de inicio tras una subida larga.

## Próximos Pasos
- El usuario debe probar la subida de los 11 archivos.
- Monitorear `logHB` para asegurar que el HB no se dispare antes de los 45s posteriores al log `[UPLOAD-DONE]`.
