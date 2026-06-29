# BizGuard - Cambios realizados el 2026-06-29

## Resumen ejecutivo

Durante la jornada se trabajaron cuatro frentes principales:

1. Desacople funcional por producto para evitar regresiones cruzadas.
2. Correcciones de autenticacion, origen y redireccion SSO/local.
3. Ajustes de UI, catalogo de productos y experiencia de edicion.
4. Simulador de pruebas por producto para validar escenarios reales.

La intencion general fue que cada producto (`generic`, `bank`, `core`, `dynamics-crm`, `serena-test`) defina su comportamiento propio sin depender de ramas globales fragiles dentro del proxy.

## 1. Desacople real por producto

### Objetivo

Sacar del `proxy-server` las decisiones semanticas por conector y moverlas a perfiles/reglas por producto.

### Cambios implementados

- Se amplio la base de reglas en:
  - `src/lib/rules/base.ts`
  - `src/lib/rules/generic.ts`
  - `src/lib/rules/bank.ts`
  - `src/lib/rules/core.ts`
  - `src/lib/rules/serena-test.ts`
  - `src/lib/rules/index.ts`
- Se incorporo un `RequestContext` comun y una resolucion explicita de `ProductExecutionMode`.
- Se definieron modos de ejecucion por producto:
  - `none`
  - `passive-html`
  - `xhr-keepalive`
  - `background-job`
- Se agrego catalogo y defaults por producto en:
  - `src/lib/product-catalog.ts`
- Se agrego clasificacion reutilizable de requests:
  - `src/lib/request-classifier.ts`
- Se agrego store para background jobs:
  - `src/lib/background-job-store.ts`

### Contratos preservados / recreados

#### Generic

- Heartbeat solo para navegacion GET larga tradicional.
- XHR y POST permanecen conservadores.

#### Bank

- `UploadAndProcess` y `UploadAndProcessMutual` se dirigen a `background-job`.
- Se mantiene la correccion de `type: "Json"` dentro del body reescrito.
- GET largos siguen usando `passive-html`.

#### Core

- XHR largos se resuelven con `xhr-keepalive`.
- Uploads multipart se resuelven con `background-job`.
- POST largos mantienen cobertura funcional de Core.

#### Dynamics CRM

- Se mantuvo el comportamiento de CRM sobre base conservadora de heartbeat.
- Se reforzo el flujo de NTLM por conector.
- Se agrego utilitario dedicado:
  - `src/lib/dynamics-crm.ts`

#### Serena Test

- Login excluido de heartbeat.
- AJAX Delta excluido.
- Limpieza DNN y autoreload conservados en reglas propias.

## 2. Configuracion por producto y compatibilidad

### Objetivo

Permitir customizacion por producto sin romper conectores legacy.

### Cambios implementados

- Se amplio el modelo `Connector` en:
  - `src/lib/connectors.ts`
- Se agrego `productConfig` opcional.
- Se mantuvo compatibilidad con:
  - `hbForceUrls`
  - `entryPath`
  - `ntlmDomain`
  - `coreNtlmDomain`
  - flags existentes
- Se agregaron normalizadores y defaults efectivos desde `product-catalog`.

## 3. Proxy y autenticacion

### Objetivo

Corregir el host efectivo del flujo SSO, respetar bypass por conector y evitar que pruebas locales queden contaminadas por `publicHost`, `AUTH_URL` o cookies viejas.

### Cambios implementados

#### Resolucion de origen

- Nuevo modulo:
  - `src/lib/auth-origin.ts`
- Politica aplicada:
  - `x-forwarded-host` publico tiene prioridad
  - luego `host`
  - luego `publicHost` del conector
  - luego settings / `AUTH_URL`
- Se preserva `localhost` en acceso local directo.
- Se preserva dominio publico cuando llega por tunel/proxy con `x-forwarded-host`.

#### Auth.js / auth.ts

- Se refactorizo:
  - `src/auth.ts`
- Cambios relevantes:
  - origen efectivo resuelto con `resolveAuthOrigin(...)`
  - `redirectProxyUrl` y callback dinamico basados en host efectivo
  - `authorized(...)` ahora respeta `connector.bypassAuth`
  - se mejoro el logging de origen

#### Login local y callback contaminado

- Nuevo modulo:
  - `src/lib/login-entry.ts`
- Nuevo cliente de auto-submit:
  - `src/components/AutoLoginClient.tsx`
- Nueva pagina server-side:
  - `src/app/login/page.tsx`
- Comportamiento agregado:
  - si el conector tiene bypass, `/login` no dispara SSO
  - si llega un `callbackUrl` viejo como `https://bank.bzld.click`, se sanea
  - el retorno se mantiene en el origen real del request

#### Proxy manager

- Se ajusto:
  - `src/lib/proxy-manager.ts`
- Cambios relevantes:
  - rutas internas (`/login`, `/api/auth`, etc.) ahora preservan `x-forwarded-host`
  - tambien preservan `x-forwarded-proto`
  - esto evita que el dashboard interno en `3000` pierda el host original del conector

## 4. Proxy server y motores de ejecucion

### Objetivo

Desacoplar la estrategia por request de la infraestructura comun del proxy.

### Cambios implementados

- Refactor principal en:
  - `src/lib/proxy-server.ts`
- Se adapto la ejecucion para usar la resolucion por producto en lugar de ramas globales rigidas.
- Se reforzaron casos de background-job, XHR keepalive y passive HTML.
- Se conservaron integraciones especiales de Core, CRM y Serena Test.

## 5. UI y catalogo de productos

### Objetivo

Que frontend y backend hablen del mismo catalogo de productos y no dejen texto o comportamiento hardcodeado divergente.

### Cambios implementados

- Catalogo compartido en:
  - `src/lib/product-catalog.ts`
- Formularios y edicion actualizados en:
  - `src/components/AddConnectorForm.tsx`
  - `src/components/ConnectorRow.tsx`
  - `src/app/actions.ts`
- Se alinearon labels, defaults y capacidades por producto.

## 6. Correccion de hidratacion y enlaces locales

### Problema

La lista de conectores generaba diferencias entre SSR y cliente al calcular el link con `window.location`.

### Solucion

- Se paso host/protocolo del dashboard desde servidor a cliente:
  - `src/app/page.tsx`
  - `src/components/DashboardClient.tsx`
  - `src/components/ConnectorRow.tsx`
- Resultado:
  - no se depende de `window.location` para construir el gateway link
  - en entorno local el link apunta a `http://localhost:PUERTO/`
  - en entorno publico respeta host/protocolo externo

## 7. NTLM y conectores autenticados

### Cambios relevantes

- Ajustes en:
  - `src/app/login/ntlm/actions.ts`
  - `src/app/login/ntlm/page.tsx`
  - `src/auth.ts`
- Se paso `connectorId` explicitamente a los flujos NTLM/Core NTLM.
- Las credenciales NTLM quedan asociadas al conector correcto en session/token.
- Se mantuvo el aislamiento por conector para evitar cruces entre productos.

## 8. SimService: simulador de pruebas por producto

### Objetivo

Tener un backend local controlado, con pruebas utiles por producto y no solo un panel generico.

### Archivo

- `scratch/SimService.ps1`

### Cambios implementados

- Reescritura modular completa del simulador.
- Helpers agregados:
  - `Send-HtmlResponse`
  - `Send-JsonResponse`
  - `Send-PlainTextResponse`
  - `Read-RequestBody`
  - generadores HTML dedicados
- Nuevo dashboard con tabs:
  - Generic
  - Bank
  - Core
  - Dynamics CRM
  - Serena Test
- Nuevas rutas / escenarios:
  - `/core/api/slow-json`
  - `/core/upload`
  - `/bank/cobranzaautomatica/uploadandprocess`
  - `/bank/cobranzaautomatica/uploadandprocessmutual`
  - `/bank/ajax-json-page`
  - `/crm/auth-fail`
  - `/SERENAART/`
  - `/serena/ingreso`
  - `/serena/delta-endpoint`
  - `/serena/dnn-paths`

## 9. Pruebas agregadas

### Nuevas pruebas

- `tests/auth-origin.test.ts`
- `tests/login-entry.test.ts`
- `tests/product-profiles.test.ts`

### Cobertura agregada

- prioridad de origen local/publico
- preservacion de `localhost`
- soporte tunel/proxy
- saneamiento de callback URL
- bypass por conector en login
- comportamiento por producto en Generic, Bank, Core y Serena Test

## 10. Pruebas ejecutadas hoy

### Validaciones tecnicas

- `tests/auth-origin.test.ts`
- `tests/login-entry.test.ts`
- `tests/product-profiles.test.ts`
- Resultado:
  - todas las pruebas pasaron luego del refactor de perfiles, origen SSO y login local

### Validacion real sobre `test-port` (`http://localhost:8081/`)

- Se valido el conector `test-port` configurado como `core` contra el backend local de `SimService.ps1`.
- El log de trafico quedo confirmado en:
  - `logs/traffic/test-port/2026-06-29_1542-1.jsonl`
- Escenarios verificados:
  - `POST /core/upload`
    - quedo registrado con `mode=background-job`
    - respuesta final `200`
    - tiempo observado aproximado: `16s`
  - `GET /core/api/slow-json` con `X-Requested-With: XMLHttpRequest`
    - quedo registrado en runtime con `mode=none`
    - respuesta final `200`
    - tiempo observado aproximado: `16s`

### Hallazgo importante de runtime

- Aunque la regla actual en codigo de `src/lib/rules/core.ts` ya resuelve el caso Core XHR hacia `xhr-keepalive`, el proceso que estaba atendiendo el puerto `8081` siguio registrando:
  - `XHR=true hbEligible=false forcedHB=false mode=none`
- Esto indica que el listener/proxy ya levantado estaba sirviendo logica previa en memoria o no habia sido reiniciado al momento de la validacion real.
- Impacto:
  - el log de trafico ya funciona correctamente
  - el upload multipart Core ya entra por `background-job`
  - el caso XHR largo de Core necesita revalidacion despues de reiniciar BizGuard o reciclar el conector para asegurar que tome la regla nueva en runtime

### Observacion de configuracion detectada

- Durante la revision del estado persistido se detecto que `test-port` figuraba en `data/connectors.db` con:
  - `bypassAuth: false`
- Esto explica por que en pruebas previas el conector seguia entrando al flujo de login aunque en UI se hubiera activado el bypass.
- Queda pendiente revisar si ese valor no se guardo o si el proceso estaba leyendo estado anterior en memoria.

## 11. Revalidacion final luego de reiniciar BizGuard

Despues de reiniciar BizGuard se repitieron las pruebas sobre `http://localhost:8081/` y el estado final correcto fue el siguiente:

- `GET /` ya no redirige al SSO de Microsoft.
- El conector entra directamente al login propio del sistema de destino.
- Esto confirma que `bypassAuth` del conector quedo aplicado en BizGuard.

### Estado persistido confirmado

- En `data/connectors.db`, el conector `test-port` quedo con:
  - `bypassAuth: true`
  - `connectorType: "core"`
  - `productConfig.core.xhrKeepAliveForAjax: true`
  - `productConfig.core.backgroundJobForMultipart: true`

### Log de trafico final

Se creo un nuevo archivo de log:

- `logs/traffic/test-port/2026-06-29_1550-1.jsonl`

En ese archivo se confirmo:

- `GET /core/api/slow-json?mode=core-xhr-after-restart`
  - `XHR=true hbEligible=true forcedHB=false mode=xhr-keepalive`
- `GET /`
  - sin paso por Microsoft SSO
  - responde el login propio del backend de prueba

### Conclusion final

- El problema previo no era una falla vigente de persistencia del checkbox.
- El estado final correcto quedo aplicado luego del reinicio del proceso.
- La interpretacion mas probable es que habia estado anterior servido en memoria antes del reinicio, tanto para la politica de auth como para la resolucion de modo Core XHR.

- `npx tsc --noEmit`
- `npx --yes tsx --test tests/auth-origin.test.ts tests/login-entry.test.ts tests/product-profiles.test.ts`

### Validacion manual de SSO / origen

- `http://localhost:8081/login?callbackUrl=https://bank.bzld.click`
  - quedo redirigiendo a `http://localhost:8081/` cuando aplica bypass
- se corrigio la preservacion del host original al reenviar rutas internas al dashboard auth

### Validacion manual de SimService Core

Se configuro el conector `test-port` como:

- `port: 8081`
- `targetUrl: http://localhost:52398/`
- `connectorType: core`

Pruebas realizadas:

1. `GET http://localhost:8081/`
   - resultado: `200`
   - se mostro login ficticio del SimService

2. login local ficticio por `POST /signin`
   - resultado: correcto

3. `GET http://localhost:8081/core/api/slow-json?mode=core-xhr`
   - con header `X-Requested-With: XMLHttpRequest`
   - resultado: `200`
   - respuesta JSON correcta

4. `POST http://localhost:8081/core/upload`
   - multipart real
   - resultado: HTML de confirmacion
   - mensaje devuelto: `CORE - Upload multipart completado`

### Observacion pendiente

Durante esta validacion no se generaron archivos visibles bajo `logs/traffic/` pese a que el conector `test-port` tiene `trafficLog: true`.

Esto deja una verificacion pendiente:

- confirmar si la instancia `npm run dev` que estaba levantada habia tomado la configuracion/logica mas reciente
- o revisar si el writer de traffic logs tiene una condicion adicional que no se activo en este flujo

## 11. Archivos principales afectados hoy

### Backend / Auth / Proxy

- `src/auth.ts`
- `src/lib/auth-origin.ts`
- `src/lib/login-entry.ts`
- `src/lib/proxy-manager.ts`
- `src/lib/proxy-server.ts`
- `src/lib/connectors.ts`
- `src/lib/dynamics-crm.ts`
- `src/lib/request-classifier.ts`
- `src/lib/background-job-store.ts`

### Reglas por producto

- `src/lib/rules/base.ts`
- `src/lib/rules/generic.ts`
- `src/lib/rules/bank.ts`
- `src/lib/rules/core.ts`
- `src/lib/rules/serena-test.ts`
- `src/lib/rules/index.ts`
- `src/lib/product-catalog.ts`

### UI / acciones

- `src/app/page.tsx`
- `src/app/login/page.tsx`
- `src/app/actions.ts`
- `src/app/login/ntlm/actions.ts`
- `src/app/login/ntlm/page.tsx`
- `src/components/AddConnectorForm.tsx`
- `src/components/DashboardClient.tsx`
- `src/components/ConnectorRow.tsx`
- `src/components/AutoLoginClient.tsx`

### Simulacion / pruebas

- `scratch/SimService.ps1`
- `tests/auth-origin.test.ts`
- `tests/login-entry.test.ts`
- `tests/product-profiles.test.ts`

## 12. Estado final del dia

### Quedo implementado

- desacople por producto con perfiles funcionales
- resolucion de origen y host mas robusta
- bypass por conector respetado en login/auth
- saneamiento de callback local contaminado
- correccion de hidratacion y links locales del dashboard
- simulador local por tabs para todos los productos clave

### Pendiente recomendado

- validar persistencia real de `logs/traffic` en el flujo `core` local
- seguir usando el SimService para regression testing por producto antes de despliegues
- si se desea, agregar una matriz automatizada de smoke tests sobre SimService
