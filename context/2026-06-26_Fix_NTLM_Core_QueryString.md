# Fix NTLM Core — Pérdida de Query String en LoginExterno (2026-06-26)

## Información General

*   **Fecha:** 2026-06-26
*   **Estado:** Completado
*   **Versión Proxy:** v1.2.2-Enterprise (Standalone)

---

## Objetivo

Resolver el problema en el conector del producto `Core` donde la pantalla del navegador del usuario final quedaba en blanco tras iniciar sesión exitosamente por NTLM. El bug ocurría al acceder a enlaces directos parametrizados como:
`https://coretest.serenaart.com.ar/LoginExterno.aspx?P=QUNDSU9OPVZFUkNPTlRSQVRPJklkQ29udHJhdG89MjQxMjU=`

La pantalla cargaba vacía porque el proxy no estaba enviando el parámetro `P` al backend real durante el handshake NTLM.

---

## Archivos Modificados

*   **`src/lib/proxy-server.ts`**:
    *   Se extrae dinámicamente el `queryString` de la solicitud entrante (`req.url`).
    *   Se concatena este `queryString` a la `validationUrl` que se pasa a la librería `httpntlm`.

---

## Decisiones Técnicas

*   **Preservación del QueryString:** 
    *   Anteriormente, la URL de validación del core se definía estrictamente como:
        `const validationUrl = buildCoreNtlmValidationUrl(connector);`
        Esto generaba una URL fija a `/LoginExterno.aspx` sin parámetros.
    *   Se implementó una extracción dinámica:
        ```typescript
        const queryIdx = (req.url || "").indexOf("?");
        const queryString = queryIdx !== -1 ? (req.url || "").substring(queryIdx) : "";
        const validationUrl = buildCoreNtlmValidationUrl(connector) + queryString;
        ```
        Esto asegura que cualquier parámetro provisto por el enlace externo (como `P` para redirecciones a contratos específicos) sea enviado al IIS de Core, permitiendo que la página de login de ASP.NET procese la redirección al recurso correspondiente en lugar de pintar una pantalla vacía.

*   **Independencia de Autenticación de Credenciales (`auth.ts`):**
    *   Se mantuvo intacto el uso de `buildCoreNtlmValidationUrl` sin QueryString en la Server Action de login de NextAuth, ya que en esa etapa solo se requiere validar si el usuario/contraseña es correcto, no realizar una redirección funcional de negocio.

---

## Instrucciones de Uso y Verificación

### Cómo verificar

1.  **Ejecutar el Proxy:**
    Arrancar el servidor BizGuard con el comando habitual:
    `node server.js` (desde la carpeta `BizGuard/`).
2.  **Prueba desde el Exterior (Fuera del servidor):**
    *   Acceder al enlace parametrizado del conector:
        `https://coretest.serenaart.com.ar/LoginExterno.aspx?P=QUNDSU9OPVZFUkNPTlRSQVRPJklkQ29udHJhdG89MjQxMjU=`
    *   Si no se cuenta con sesión activa, BizGuard redirigirá a la pantalla de ingreso NTLM del core.
    *   Ingresar credenciales válidas.
    *   **Resultado esperado:** El sistema debe autenticar con éxito y redirigir automáticamente al recurso de negocio (ej. `/AYC/Contrato/ContratoGetContrato.aspx?...`) mostrando el contrato y cargando los datos correctamente en pantalla en lugar de quedar en blanco.
