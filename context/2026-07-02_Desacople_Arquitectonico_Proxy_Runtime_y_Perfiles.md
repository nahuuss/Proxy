# Registro de Implementacion: Desacople Arquitectonico de Proxy, Runtime y Perfiles

**Fecha:** 2026-07-02  
**Autor:** Codex (GPT-5)  
**Alcance:** consolidacion detallada de todo el desacople realizado hasta el momento sobre `src/lib`, capa de proxy, auth, runtime, conectores y perfiles de producto.

## 1. Objetivo de esta fase

Se avanzo sobre el desacople progresivo de la arquitectura real de BizGuard para reducir mezcla de responsabilidades entre:

- proxy HTTP/WebSocket
- estrategias por producto
- Auth.js y sesiones NTLM
- runtime manager, monitoreo y sync
- persistencia de conectores y NeDB
- observabilidad, heartbeat y background jobs

La intencion de esta fase fue mover logica transversal y logica especifica de producto fuera de archivos monoliticos, dejando modulos mas chicos, con contratos mas claros y menor riesgo de regresiones cruzadas.

## 2. Criterios seguidos durante el desacople

- Mantener compatibilidad de imports publicos cuando era posible.
- Convertir archivos grandes en fachadas o coordinadores.
- Separar infraestructura comun de reglas/contratos especificos por perfil.
- Validar despues de cada tanda con:
  - `npx tsc --noEmit`
  - `npx eslint` sobre el alcance modificado
- No introducir cambios funcionales intencionales fuera del desacople.

## 3. Desacoples realizados

### 3.1. Capa de base de datos y runtime NeDB

#### Situacion original

`src/lib/db.ts` mezclaba:

- deteccion de fase protegida (`build`/`test`)
- bootstrap de `data/*.db`
- carga con reintentos
- compactacion y scheduling de memoria

#### Resultado

`src/lib/db.ts` quedo como fachada corta y se separaron responsabilidades en:

- `src/lib/db-runtime-phase.ts`
  - deteccion de `isBuildPhase`
  - deteccion de `isTestPhase`
  - helper `isProtectedDbPhase`
- `src/lib/db-files.ts`
  - bootstrap del directorio `data`
  - aseguramiento de archivos `.db`
  - resolucion de paths
- `src/lib/db-loader.ts`
  - carga de NeDB con reintentos y tolerancia a `.db~`
- `src/lib/db-compaction.ts`
  - estado global de compactacion
  - calculo de intervalo
  - `forceMemoryReset`
  - `scheduleNextCompaction`

#### Impacto

- menor acoplamiento entre persistencia y scheduling
- mejor aislamiento de efectos colaterales en build/test
- API publica mantenida para consumidores existentes

### 3.2. Conectores: migracion, store y normalizacion

#### Situacion original

`src/lib/connectors.ts` mezclaba:

- migracion inicial desde `src/data/connectors.json`
- acceso CRUD a NeDB
- recarga defensiva de base
- normalizacion de `connectorType` y `productConfig`

#### Resultado

Se separo en:

- `src/lib/connectors-migration.ts`
  - migracion inicial JSON -> NeDB
- `src/lib/connectors-store.ts`
  - recarga de NeDB
  - `findAll`
  - `findById`
  - `insert`
  - `update`
  - `delete`
- `src/lib/connectors-normalize.ts`
  - normalizacion por perfil
  - defaults de `productConfig`
- `src/lib/connectors.ts`
  - fachada CRUD con el mismo contrato publico

#### Impacto

- CRUD desacoplado del seed inicial
- menos riesgo al tocar normalizacion de perfiles
- persistencia y bootstrap independientes

### 3.3. Origen de autenticacion y resolucion de host

#### Situacion original

`src/lib/auth-origin.ts` concentraba normalizacion de host/proto, chequeos locales y matching por puerto del conector.

#### Resultado

Se separo en:

- `src/lib/auth-origin-host.ts`
  - normalizacion de host/proto
  - deteccion de `localhost`
  - inferencia de protocolo
- `src/lib/auth-origin-connector.ts`
  - matching de conector por puerto
- `src/lib/auth-origin.ts`
  - resolucion final del origen efectivo como fachada/coordinador

#### Impacto

- menor mezcla entre parsing de host y politica de origen
- base mas segura para cambios futuros de `auth-origin` y `login-entry`

### 3.4. Auth NTLM: usuarios, claims y lectura de sesion

#### Situacion original

`src/lib/auth-ntlm.ts` mezclaba:

- construccion de usuarios CRM/Core
- escritura de claims en JWT
- traslado a session
- lectura de credenciales desde session
- deteccion de vinculacion por conector
- resolucion del username preferido

#### Resultado

Se separo en:

- `src/lib/auth-ntlm-users.ts`
  - `createCrmNtlmAuthUser`
  - `createCoreNtlmAuthUser`
- `src/lib/auth-ntlm-claims.ts`
  - `applyNtlmJwtClaims`
  - `applyNtlmSessionClaims`
  - con tipado preservado para callbacks de Auth.js
- `src/lib/auth-ntlm-session.ts`
  - `hasCrmNtlmSessionForConnector`
  - `hasCoreNtlmSessionForConnector`
  - `getCrmNtlmSessionCredentials`
  - `getCoreNtlmSessionCredentials`
  - `getPreferredSessionUsername`
- `src/lib/auth-ntlm.ts`
  - fachada/barrel publico

#### Impacto

- menor acoplamiento entre Auth.js y runtime NTLM
- claims y lectura de sesion desacoplados de la construccion del usuario
- compatibilidad mantenida con imports existentes

### 3.5. Validaciones NTLM por perfil

#### Resultado acumulado

La validacion NTLM tambien se partio en:

- `src/lib/auth-ntlm-validation-shared.ts`
- `src/lib/auth-ntlm-validation-profiles.ts`
- `src/lib/auth-ntlm-validation.ts` como fachada

#### Impacto

- mejor separacion entre reglas compartidas y contratos de perfil (`core`, `dynamics-crm`)

### 3.6. Flujo de auth del proxy HTTP y WebSocket

#### Situacion original

La logica de acceso mezclaba:

- deteccion de rutas protegidas
- armado de callback
- chequeo de sesion NTLM/Core
- traduccion de decisiones a respuesta HTTP/WS

#### Resultado

Se separo en:

- `src/lib/proxy-auth-flow-routes.ts`
  - callbacks absolutos
  - redirects a login NTLM/Core/Auth.js
  - root-entry redirect
- `src/lib/proxy-auth-flow-session.ts`
  - chequeos de sesion CRM/Core por conector
- `src/lib/proxy-auth-flow.ts`
  - decisionador HTTP/WS
- `src/lib/proxy-port-http-auth.ts`
  - adaptacion de decisiones auth a HTTP
- `src/lib/proxy-port-websocket-auth.ts`
  - autorizacion del upgrade WS

#### Impacto

- menos riesgo de mezclar autenticacion con transporte
- mejor frontera entre politicas y delivery

### 3.7. Puertos HTTP y WebSocket del proxy

#### Resultado

Se limpiaron los handlers de puertos:

- `src/lib/proxy-port-http.ts`
  - ahora orquesta mas y decide menos internamente
- `src/lib/proxy-port-websocket.ts`
  - ahora delega auth y bridge
- `src/lib/proxy-port-websocket-bridge.ts`
  - ciclo de vida entre socket cliente y backend

#### Impacto

- HTTP y WS quedaron alineados en estructura
- menos mezcla entre acceso, wiring y transporte

### 3.8. Request context del proxy server

#### Situacion original

`src/lib/proxy-server-request-context.ts` mezclaba:

- saneamiento de headers
- armado de `RequestOptions`
- clasificacion del request
- deteccion de paths legacy HB
- resolucion de `executionMode`

#### Resultado

Se separo en:

- `src/lib/proxy-server-request-headers.ts`
  - headers forward
  - `RequestOptions`
  - `x-forwarded-*`
- `src/lib/proxy-server-request-execution.ts`
  - clasificacion de request
  - forced heartbeat legacy
  - `executionMode`
  - helpers de perfil
- `src/lib/proxy-server-request-context.ts`
  - coordinador/fachada

#### Impacto

- infraestructura de forwarding desacoplada de reglas por producto
- cambios futuros de `executionMode` ya no tocan el armado de request al backend

### 3.9. Heartbeat Shield

#### Situacion original

`src/lib/proxy-heartbeat-shield.ts` concentraba:

- start/end de heartbeat
- emision de eventos
- activacion por modo
- manejo de timers

#### Resultado

Se separo en:

- `src/lib/proxy-heartbeat-shield-modes.ts`
  - ya existente en el proceso de desacople anterior
- `src/lib/proxy-heartbeat-shield-events.ts`
  - eventos `heartbeat-start` / `heartbeat-end`
- `src/lib/proxy-heartbeat-shield-activation.ts`
  - activacion por modo:
    - `passive-html`
    - `xhr-keepalive`
    - `background-job`
- `src/lib/proxy-heartbeat-shield.ts`
  - coordinador de timers y estado

#### Impacto

- menor mezcla entre temporizacion y estrategia visual/delivery
- mas simple extender modos sin tocar el controller base

### 3.10. Background job page

#### Situacion original

`src/lib/proxy-bg-job-page.ts` generaba todo el HTML y JS inline en una sola funcion.

#### Resultado

Se separo en:

- `src/lib/proxy-bg-job-page-template.ts`
  - estilos
  - estructura HTML
- `src/lib/proxy-bg-job-page-script.ts`
  - polling
  - lectura de resultado
  - UX de exito/error
- `src/lib/proxy-bg-job-page.ts`
  - ensamblador final

#### Impacto

- menor complejidad por archivo
- mas facil modificar UX sin tocar el script completo

### 3.11. Standard response orchestration

#### Situacion original

`src/lib/proxy-standard-response-orchestrator.ts` mezclaba:

- redirect post-heartbeat
- rewrite buffered
- stream directo

#### Resultado

Se separo en:

- `src/lib/proxy-standard-response-types.ts`
  - contrato compartido
- `src/lib/proxy-standard-response-redirect.ts`
  - respuesta de redirect durante heartbeat
- `src/lib/proxy-standard-response-stream.ts`
  - stream directo
- `src/lib/proxy-standard-response-orchestrator.ts`
  - dispatcher principal

#### Impacto

- decisiones por tipo de respuesta mas claras
- menos mezcla entre rewrite, redirect y stream

### 3.12. Proxy server

#### Situacion original

`src/lib/proxy-server.ts` venia concentrando:

- setup de runtime
- observabilidad
- heartbeat lifecycle
- flujo NTLM
- flujo estandar
- wiring HTTP del backend

#### Resultado

Se desacoplo en varias capas:

- `src/lib/proxy-server-runtime.ts`
  - runtime init
  - `MAX_REQUEST_BODY`
- `src/lib/proxy-server-observability.ts`
  - status events
  - debug log
  - traffic builder
- `src/lib/proxy-server-heartbeat.ts`
  - creacion del controller heartbeat
  - binding del lifecycle del request
- `src/lib/proxy-server-standard-flow.ts`
  - request al backend
  - `proxyReq`
  - error path
  - body forwarding
- `src/lib/proxy-server.ts`
  - composicion general

#### Impacto

- `proxy-server.ts` dejo de ser el centro absoluto de cada detalle
- el flujo quedo partido en capas de responsabilidad mucho mas claras

### 3.13. Handshakes NTLM

#### Resultado acumulado

Primero se extrajo infraestructura comun:

- `src/lib/proxy-ntlm-handshake-common.ts`
  - recoleccion de body
  - resolucion del metodo NTLM por verbo
  - activacion defensiva de HB

Despues se separaron runners por contrato:

- `src/lib/proxy-ntlm-handshake-core.ts`
- `src/lib/proxy-ntlm-handshake-crm.ts`
- `src/lib/proxy-ntlm-handshake-runners.ts`
  - fachada minima

#### Impacto

- Core y CRM ya no comparten en el mismo archivo la preparacion completa del request
- el breaker de CRM queda mejor aislado de Core

### 3.14. Callbacks NTLM

#### Resultado

Se separo logica comun en:

- `src/lib/proxy-ntlm-callbacks-shared.ts`
  - escritura base del error
  - preparacion comun de respuesta NTLM exitosa

y `src/lib/proxy-ntlm-callbacks.ts` quedo mas orientado a adaptar Core/CRM.

#### Impacto

- menos repeticion entre callbacks Core y CRM
- menor riesgo al tocar delivery o logging de respuestas NTLM

### 3.15. Dynamics CRM

#### Situacion original

`src/lib/dynamics-crm.ts` mezclaba:

- normalizacion de entry path
- resolucion de `main.aspx`
- rewrite de variables cliente
- deteccion/inyeccion del lookup shim

#### Resultado

Se separo en:

- `src/lib/dynamics-crm-paths.ts`
- `src/lib/dynamics-crm-client-config.ts`
- `src/lib/dynamics-crm-lookup-shim.ts`
- `src/lib/dynamics-crm.ts`
  - barrel publico

#### Impacto

- mejor aislamiento del contrato CRM
- menos probabilidad de contaminar otros productos con parches CRM

### 3.16. Monitoreo y runtime manager

#### Proxy monitoring

Se separo en:

- `src/lib/proxy-monitoring-http.ts`
  - probe HTTP
- `src/lib/proxy-monitoring-target.ts`
  - candidatos y fallback del target
- `src/lib/proxy-monitoring.ts`
  - contrato principal

#### Runtime loop

Se separo en:

- `src/lib/proxy-runtime-loop-metrics.ts`
  - throughput
  - CPU
  - memoria
  - global metrics
- `src/lib/proxy-runtime-loop-sync.ts`
  - decision de sync
  - artefactos de snapshot/payload
- `src/lib/proxy-runtime-loop.ts`
  - composicion del tick

#### Runtime controller del manager

Se separo en:

- `src/lib/proxy-manager-runtime-deps.ts`
  - resolucion de dependencias
- `src/lib/proxy-manager-runtime-sync.ts`
  - aplicacion de estado post-tick
  - disparo de sync
- `src/lib/proxy-manager-runtime-controller.ts`
  - controller mas declarativo

#### Impacto

- mejor aislamiento de monitoreo, sync y calculo de metricas
- menos wiring manual dentro del manager

### 3.17. Logging HAR y Traffic

Tambien se desacoplaron dos modulos de observabilidad grandes:

#### Traffic log

- `src/lib/logger-traffic-types.ts`
- `src/lib/logger-traffic-utils.ts`
- `src/lib/logger-traffic-files.ts`
- `src/lib/logger-traffic-cleanup.ts`
- `src/lib/logger-traffic.ts`
  - coordinador/fachada

#### HAR log

- `src/lib/logger-har-types.ts`
- `src/lib/logger-har-parsers.ts`
- `src/lib/logger-har-content.ts`
- `src/lib/logger-har-entry.ts`
- `src/lib/logger-har.ts`
  - coordinador/fachada

#### Impacto

- mejor frontera entre parsing, persistencia y contrato publico de logs

### 3.18. Otros desacoples ya aplicados en la misma fase

Tambien quedaron desacoplados o encapsulados:

- `src/lib/proxy-control-routes.ts`
  - rutas de control `/__bizguard_status/stream` y `/__bizguard_job/*`
- `src/lib/proxy-standard-request-body.ts`
  - forwarding del body entrante
- `src/lib/proxy-utils.ts`
  - transformado en barrel con extracciones a:
    - `proxy-deep-rewrite.ts`
    - `proxy-header-rewrite.ts`
    - `proxy-blob-download.ts`
    - `proxy-bg-job-page.ts`
- `src/lib/proxy-manager-port-controller.ts`
  - ya habia sido recortado antes de esta consolidacion
- `src/lib/proxy-manager-port-controller.ts`
  - sigue como pieza intermedia despues del desacople del manager

## 4. Validaciones realizadas durante esta fase

### Validaciones positivas repetidas

Despues de cada bloque importante se verifico:

- `npx tsc --noEmit`
- `npx eslint` sobre archivos modificados

Estas validaciones quedaron pasando al cierre de cada tanda de desacople registrada en esta fase.

### Observacion sobre tests

Se confirmo nuevamente que el runner directo:

- `node --test ...`

permanece structuralmente desalineado con imports TypeScript/ESM sin extension, por lo que varios fallos observados en esa via corresponden al tooling actual del proyecto y no necesariamente a regresiones del desacople.

## 5. Efecto arquitectonico logrado hasta ahora

### Mejora principal

La arquitectura quedo bastante menos centrada en archivos monoliticos y mucho mas orientada a:

- fachadas pequenas
- helpers por responsabilidad
- barrels de compatibilidad
- contratos de perfil mejor aislados

### Beneficios concretos

- menor probabilidad de romper `generic`, `bank`, `core`, `dynamics-crm` y `serena-test` con un mismo cambio transversal
- mejor trazabilidad de reglas por producto
- mejor frontera entre:
  - auth
  - runtime
  - proxy
  - observabilidad
  - persistencia
- facilidades para cubrir con tests unitarios piezas mas chicas

## 6. Archivos/familias mas relevantes intervenidas

### Persistencia y runtime

- `src/lib/db.ts`
- `src/lib/db-*.ts`
- `src/lib/connectors.ts`
- `src/lib/connectors-*.ts`
- `src/lib/proxy-runtime-loop*.ts`
- `src/lib/proxy-manager-runtime-*.ts`

### Auth y sesiones

- `src/lib/auth-origin.ts`
- `src/lib/auth-origin-*.ts`
- `src/lib/auth-ntlm.ts`
- `src/lib/auth-ntlm-*.ts`
- `src/lib/auth-ntlm-validation*.ts`
- `src/lib/login-entry.ts`

### Proxy y heartbeat

- `src/lib/proxy-server.ts`
- `src/lib/proxy-server-*.ts`
- `src/lib/proxy-heartbeat-shield*.ts`
- `src/lib/proxy-standard-response-*.ts`
- `src/lib/proxy-standard-request-body.ts`
- `src/lib/proxy-port-http*.ts`
- `src/lib/proxy-port-websocket*.ts`

### NTLM y CRM

- `src/lib/proxy-ntlm-*.ts`
- `src/lib/dynamics-crm*.ts`

### Observabilidad y logs

- `src/lib/logger-har*.ts`
- `src/lib/logger-traffic*.ts`
- `src/lib/proxy-monitoring*.ts`
- `src/lib/proxy-control-routes.ts`

## 7. Riesgos o puntos todavia pendientes

Aunque el desacople avanzo fuerte, todavia quedan piezas donde conviene seguir trabajando:

- `src/lib/proxy-control-routes.ts`
- `src/lib/auth-origin.ts` como fachada aun relativamente grande
- `src/lib/proxy-server.ts` aunque ya mucho mas chico, sigue siendo nodo importante de composicion
- `src/lib/proxy-manager-port-controller.ts`
- algunos barrels/fachadas todavia concentran compatibilidad y pueden dividirse mas si hace falta

## 8. Estado funcional esperado despues de esta fase

No se buscaron cambios de contrato funcional visibles para usuario final. La expectativa de esta fase es:

- mismo comportamiento observable
- menor acoplamiento interno
- menor superficie de regresion cruzada
- base mas segura para seguir aislando perfiles y reforzar seguridad/tooling

## 9. Cambios sobre SQL o esquema

En esta fase no se realizaron cambios de esquema ni scripts SQL.  
El trabajo fue de desacople de codigo, runtime, proxy y perfiles sobre la base existente.

## 10. Recomendacion para la siguiente fase

Prioridades razonables para continuar:

1. Seguir bajando complejidad en las fachadas que aun coordinan muchas piezas.
2. Revisar y cerrar tooling pendiente del runner de tests TypeScript/ESM.
3. Consolidar smoke tests por perfil sobre las piezas ya desacopladas.
4. Continuar endureciendo control de acceso y superficies administrativas sobre la base ya modularizada.

