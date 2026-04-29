# Implementación de Producto: Serena-Test (Entorno de Staging)

**Fecha:** 2026-04-29  
**Estado:** Completado  
**Versión Proxy:** 1.3.2  

## 1. Objetivo
El objetivo de esta implementación es crear un nuevo tipo de producto denominado `Serena-Test` dentro del ecosistema BizGuard Proxy. Este producto actúa como un entorno de "Sandbox" o "Staging" donde se pueden inyectar y probar customizaciones experimentales de reglas sin afectar a los conectores de producción (`core`, `bank`, `dynamics-crm`).

## 2. Arquitectura de Reglas
Siguiendo el patrón de estrategia implementado en la v1.3.1, `Serena-Test` utiliza su propia clase de reglas:

- **Clase:** `SerenaTestRules` (hereda de `BaseRules`)
- **Archivo:** `src/lib/rules/serena-test.ts`
- **Comportamiento Inicial:** Replica la lógica de `CoreRules` (Heartbeat Shield activo para POST/XHR y soporte para subidas de archivos pesados).

## 3. Cambios Realizados

### Backend (Rules Engine)
- **[NEW]** `src/lib/rules/serena-test.ts`: Implementación de la clase `SerenaTestRules`.
- **[MODIFY]** `src/lib/rules/index.ts`: Registro del nuevo tipo en el `getRulesFor` factory.

### Tipado y Contratos
- **[MODIFY]** `src/lib/connectors.ts`: Se expandió la unión de tipos `connectorType` para incluir `'serena-test'`.

### UI (Dashboard)
- **[MODIFY]** `src/components/ConnectorRow.tsx`: 
    - Actualización de `CONNECTOR_TYPES` con el nuevo producto.
    - Icono asignado: `🧪` (Probeta/Test).
    - Descripción: "Entorno de pruebas y staging para customizaciones experimentales."
    - Actualización de estados y dispatchers para soportar el nuevo tipo.

## 4. Validación
1. Se verificó que el selector de productos en el dashboard muestra correctamente "Serena Test".
2. Se validó mediante el factory que al seleccionar el tipo `serena-test`, el sistema instancia correctamente la clase `SerenaTestRules`.
3. Se confirma que el HB Shield funciona bajo las mismas condiciones que `core`, permitiendo pruebas de estabilidad en este entorno.

## 5. Notas para Desarrolladores
Cualquier customización específica requerida por el equipo de Serena que sea experimental debe inyectarse exclusivamente en `SerenaTestRules`. Una vez estabilizada, podrá evaluarse su migración a `CoreRules`.
