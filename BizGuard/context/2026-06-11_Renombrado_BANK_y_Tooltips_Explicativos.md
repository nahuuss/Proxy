# Renombrado de BANK y Tooltips Explicativos en Selector de Conectores

**Fecha:** 2026-06-11  
**Objetivo:** Modificar el selector visual de tipo de conector/producto para renombrar la opción "Banco / Entidad Financiera" por "BANK" e incorporar tooltips/globos explicativos flotantes que detallen las capacidades técnicas de cada producto en el Heartbeat Shield, peticiones AJAX y reescritura de respuestas.

---

## Archivos Creados/Modificados

*   **[ConnectorRow.tsx](file:///e:/Desarrollo/BizGuard/src/components/ConnectorRow.tsx)** (Modificado)
    *   Se agregó el atributo `title={t.tooltip}` a la etiqueta `<label>` del selector del editor para mostrar los tooltips nativos en el modal de configuración de conectores.
*   **[AddConnectorForm.tsx](file:///e:/Desarrollo/BizGuard/src/components/AddConnectorForm.tsx)** (Modificado)
    *   Se definió de forma local y privada la constante `CONNECTOR_TYPES` para cumplir con las directivas de modularidad estricta.
    *   Se reemplazó el control `<select>` clásico del paso 3 por una cuadrícula (`grid`) interactiva de botones radio idéntica a la del editor, dotada de los mismos tooltips y renombrada a "BANK".
*   **[instrumentation.ts](file:///e:/Desarrollo/BizGuard/src/instrumentation.ts)** (Modificado)
    *   Se implementó una validación en `register()` para retornar temprano si la fase de ejecución de Next.js es de compilación (`process.env.NEXT_PHASE === 'phase-production-build'`). Esto previene que se inicialice `proxyManager` y se abran sockets/puertos activos durante `next build`, lo que causaba que la generación estática de páginas fallara por timeout.
    *   Se refactorizó el bucle de migración de logs dinámico por una función estructurada que hace uso del comentario especial `/*turbopackIgnore: true*/` en el `path.join(process.cwd(), ...)` dinámico, evitando que el analizador de dependencias estáticas (NFT) intente rastrear y empaquetar todo el directorio raíz del proyecto de manera involuntaria.

---

## Decisiones Técnicas

1.  **Modularización Estricta (Regla 5):** Se duplicó la estructura de constantes `CONNECTOR_TYPES` a nivel de módulo privado dentro de `AddConnectorForm.tsx` y `ConnectorRow.tsx` en lugar de exportarla desde un archivo común. Esto evita acoplar el formulario de creación y el editor de filas, previniendo que futuras modificaciones sobre las vistas de uno de ellos rompan colateralmente al otro.
2.  **Consistencia de UX y Estética Premium:** El control de selección `<select>` de HTML nativo no ofrece soporte óptimo ni confiable para la propiedad `title` en las opciones secundarias `<option>`. Para ofrecer una experiencia verdaderamente premium y dotar de globos informativos a la creación, se transformó este paso al diseño visual de tarjetas de radio-botones que ya utilizaba el editor.
3.  **Evitar el Bloqueo en Compilación (instrumentation):** Se detectó que el build de Next.js (`next build`) fallaba por timeout al compilar páginas porque el archivo `src/instrumentation.ts` inicializaba el gestor de proxies y abría sockets persistentes para escuchar en red. Se introdujo una cláusula de exclusión temprana usando la variable de fase de compilación nativa de Next.js, logrando que el build se ejecute limpia y velozmente.
4.  **Silenciar la Advertencia de Turbopack NFT (Rastreo de Proyecto Involuntario):** Durante el build, el analizador de archivos standalone (NFT) detectaba la ruta dinámica `path.join(process.cwd(), file)` en el bucle de logs y asumía que cualquier archivo de la raíz del proyecto podía ser accedido en caliente, intentando mapear y empaquetar la raíz entera. La inclusión del comentario `/*turbopackIgnore: true*/` y la separación en llamadas estáticas le indica a Turbopack que no intente rastrear recursivamente la raíz en esta línea, eliminando la advertencia.
5.  **Compatibilidad del Formulario:** La transición de `<select name="connectorType">` a `<input type="radio" name="connectorType">` mantiene compatibilidad total con la acción de servidor (`Server Action`), puesto que el navegador envía exactamente el mismo valor string bajo la clave `connectorType` al enviar el FormData.

---

## Instrucciones de Uso

1.  **En la creación de conectores:**
    *   Al ingresar a la interfaz de "Dar de Alta Nuevo BizGuard", avanzar al **Paso 3 (Tipo)**.
    *   Se visualizará la cuadrícula de tarjetas de tipo de conector. Al pasar el mouse sobre cualquiera de ellas, se desplegará el globo emergente del navegador mostrando la explicación técnica detallada del Heartbeat Shield y soporte HTTP/AJAX.
2.  **En la edición de conectores:**
    *   Hacer clic en el botón de ajustes (icono de engranaje) de un conector activo.
    *   Navegar a la pestaña **Producto**.
    *   Pasar el mouse por encima de los botones de radio del tipo de producto para consultar sus detalles técnicos.

---

## Cómo Verificar

1.  **Verificación Visual:**
    *   Validar que en ambos paneles el término visual para el valor `bank` se represente de forma consistente como **BANK** en mayúsculas.
    *   Confirmar la correcta visualización del tooltip explicativo al colocar el puntero sobre cada producto (ej. "Genérico", "Dynamics CRM", "Core", "BANK" y "Serena Test").
2.  **Verificación Funcional:**
    *   Crear un nuevo conector del tipo **BANK** completando el asistente y validar que se guarde de manera exitosa.
    *   Editar un conector existente, cambiar su tipo de producto (ej. de BANK a Core) y guardar para certificar que el cambio persiste correctamente en la base de datos NeDB.
3.  **Verificación de Compilación:**
    *   Asegurar que la compilación offline de producción (`preparar-despliegue.ps1`) se complete de manera limpia sin errores de TypeScript.
