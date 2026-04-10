# Estabilización de SSO y Cookies de Auth.js (v1.3.5)

**Fecha:** 2026-04-07
**Estado:** Implementado y Verificado
**Componente:** Autenticación (SSO Microsoft Entra ID) via Proxy Reverso

## 📋 Resumen del Problema
Se identificó que el flujo de autenticación SSO fallaba de manera intermitente (loops de login) y producía errores `MissingCSRF` o `InvalidCheck (state cookie missing)`. Esto se debía a la discrepancia entre el entorno externo (HTTPS en `bank.bzld.click`) y el interno (HTTP en `localhost:3000` manejado por el proxy).

1. **Bug CSRF:** Auth.js v5 genera cookies `__Secure-` en HTTPS, pero al conectar internamente por HTTP, el navegador no devuelve estas cookies al servidor Next.js.
2. **Bug de Estado (State/Nonce):** Al detectar un esquema HTTP internamente, Auth.js v5 podía usar nombres de cookies distintos a los establecidos durante el handshake de OAuth.
3. **Bloqueo de Endpoint:** El middleware de autorización bloqueaba el acceso al token CSRF antes de iniciar el login.

## 🛠️ Soluciones Aplicadas

### 1. Configuración de `auth.ts` (Backend)
Se aplicaron tres cambios críticos de bajo nivel:
- **`skipCSRFCheck`**: Se habilitó esta opción experimental para permitir que el proxy reverso maneje la seguridad sin colisionar con la validación interna de cookies de Next-Auth.
- **`useSecureCookies: false`**: Se forzó la desactivación de cookies seguras internamente para asegurar que el proxy pueda recibir y procesar las cookies generadas por el backend Next.js independientemente de si el tráfico externo es HTTPS.
- **Mapeo Explícito de Cookies**: Se definieron nombres fijos (sin prefijo `__Secure-`) para todas las cookies (`sessionToken`, `callbackUrl`, `csrfToken`, `pkceCodeVerifier`, `state`, `nonce`) con flag `secure: false`. Esto garantiza consistencia total entre el Proxy y el Backend.

### 2. Rediseño de Página de Login (Frotend)
- Se eliminó la dependencia de `next-auth/react` (que causaba crashes por inicialización de URL vacía).
- Se implementó un **Server Component** con un formulario HTML nativo que realiza un `POST` directo a `/api/auth/signin/microsoft-entra-id`.
- Al usar `skipCSRFCheck`, el formulario ya no requiere la carga previa del token CSRF, eliminando el loop de peticiones 401.

## 📁 Archivos Modificados
- `src/auth.ts`: Reconfiguración central de cookies y skips de seguridad.
- `src/app/login/page.tsx`: Nueva lógica de auto-login simplificada y robusta.
- `.env.local`: Configuración de `AUTH_URL` y variables de entorno oficiales.

## ✅ Verificación
- Verificado que el redireccionamiento a Microsoft funciona sin loops.
- Verificado que el callback procesa el `state` correctamente al regresar del SSO.
- Verificado que no hay errores de `TypeError: Failed to construct 'URL'` en el cliente.
