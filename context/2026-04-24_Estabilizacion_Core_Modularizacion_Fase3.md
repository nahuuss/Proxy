# Registro de Implementación: Estabilización Core y Modularización de Reglas (Fase 3)

**Fecha:** 2026-04-24
**Autor:** Antigravity (BizGuard Assistant)

## Descripción
Se ha realizado una reestructuración profunda del sistema de reglas del proxy para desacoplar la lógica específica de cada producto (`core`, `bank`, `dynamics-crm`) y solucionar problemas críticos de experiencia de usuario en el producto Core.

## Problemas Solucionados
1.  **Carga Infinita en Core**: Tras una subida exitosa de archivos donde el Heartbeat Shield estuvo activo, el navegador quedaba bloqueado esperando una respuesta que el proxy ya había marcado como 200 OK parcial.
2.  **Acoplamiento de Código**: `proxy-server.ts` contenía lógica condicional compleja según el tipo de conector, lo que dificultaba el mantenimiento.

## Cambios Realizados

### 1. Sistema de Reglas Modular (`src/lib/rules/`)
Se ha implementado una arquitectura basada en el patrón Strategy/Policy:
- **`BaseRules`**: Define el contrato para el Heartbeat Shield y redirecciones.
- **`CoreRules`**: Configuración agresiva para permitir HB en subidas (POST/XHR) y manejo de redirecciones forzadas.
- **`BankRules`**: Mantiene parches específicos como el fix de `type: "Json"`.
- **`GenericRules`**: Proporciona un comportamiento seguro (HB solo en GET) para conectores nuevos.

### 2. Estabilización de Redirects (Core)
Se implementó `getRedirectScript` en el sistema de reglas. Si el proxy detecta un código 3xx del servidor mientras el HB está en curso:
- Cierra el comentario HTML si es necesario.
- Inyecta `<script>window.location.href="..."</script>`.
- Finaliza la respuesta correctamente.

### 3. Refactor de `proxy-server.ts`
- Se eliminaron los chequeos de `connector.connectorType === '...'`.
- El proxy ahora utiliza una factoría dinámica para obtener las reglas correspondientes al conector actual.

## Archivos Afectados
- `src/lib/proxy-server.ts` (Refactorizado)
- `src/lib/rules/index.ts` (Nuevo)
- `src/lib/rules/base.ts` (Nuevo)
- `src/lib/rules/core.ts` (Nuevo)
- `src/lib/rules/bank.ts` (Nuevo)
- `src/lib/rules/generic.ts` (Nuevo)

## Impacto
- Mejora la estabilidad de las subidas en Core (+10 archivos).
- Mejora la legibilidad y mantenibilidad del código base.
- Asegura que las optimizaciones de un producto no afecten negativamente a otros.
