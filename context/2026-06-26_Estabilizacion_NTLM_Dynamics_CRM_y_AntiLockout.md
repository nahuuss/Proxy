# BizGuard - Estabilizacion NTLM Dynamics CRM y AntiLockout

Fecha: 2026-06-26

## Resumen

Se realizo una estabilizacion completa del flujo NTLM para conectores `dynamics-crm`, motivada por una regresion observada en `crm-test` y con riesgo potencial tambien en `crm`.

El incidente tuvo tres manifestaciones distintas:

1. Login inicial correcto en BizGuard pero pantalla CRM en blanco o incompleta.
2. Multiples `401` en recursos secundarios del CRM (`css`, `js`, `ashx`, `asmx`, `iframe`) despues del ingreso.
3. `HTTP Error 401.1 - Unauthorized` incluso sobre `main.aspx` al ingresar por proxy, mientras el backend directo funcionaba.

La solucion final requirio corregir:

- el binding de credenciales NTLM al conector correcto
- el uso de transporte NTLM compartido en requests paralelos
- la continuidad de conexion durante el handshake NTLM de cada request
- el reenvio de headers del navegador que interferian con `httpntlm`
- la normalizacion de la ruta de entrada CRM para usar `main.aspx` cuando corresponde

## Evidencia observada

### Fase 1 - Recursos secundarios fallando

Se detectaron multiples respuestas `401` del backend CRM luego del login exitoso en BizGuard, sobre recursos como:

- `global.css.aspx`
- `theme.css.aspx`
- `navbar.css.aspx`
- `global.ashx`
- `RibbonLayout.js.aspx`
- `home_dashboards.aspx`
- `dlg_navtour.aspx`
- `RecentlyViewedWebService.asmx`
- `MessageBar.asmx`

Los headers del backend devolvian:

- `www-authenticate: Negotiate, NTLM`

Esto indicaba que el servidor seguia renegociando autenticacion en cascada sobre requests paralelos.

### Fase 2 - Riesgo de lockout AD

En `crm-test` se detecto comportamiento compatible con bloqueo de usuario AD despues de multiples intentos y `F5`.

Hipotesis validada:

- el proxy NTLM para CRM estaba reutilizando un `agent` compartido en trafico paralelo
- eso mezclaba o rompia handshakes NTLM entre recursos simultaneos
- el backend contestaba `401` en rafaga
- esa rafaga elevaba el riesgo de lockout AD

### Fase 3 - 401.1 en la entrada principal

Luego de estabilizar la rama anterior, siguio apareciendo:

- `HTTP Error 401.1 - Unauthorized: Access is denied`

en:

- `/ARTTesting/`
- `/ARTTesting/main.aspx`

sin embargo, el backend directo:

- `http://arbuewvcrmapp50:5555/ARTTesting/main.aspx`

si cargaba correctamente.

Esto demostro que ya no era solo un problema de ruta ni de credenciales, sino de handshake NTLM a nivel proxy.

## Causa raiz final

La causa no fue unica, sino combinada.

### 1. Credenciales CRM no atadas al conector real

El provider `ntlm-login` tomaba el primer conector NTLM activo:

- podia validar contra un CRM distinto al conector visitado
- podia mezclar `crm` y `crm-test` con el mismo usuario

### 2. Transporte NTLM compartido entre requests paralelos

El branch CRM en `proxy-server.ts` usaba un `agent` compartido para requests NTLM.

Eso era especialmente riesgoso en Dynamics CRM porque la pagina inicial dispara multiples requests protegidos casi en paralelo.

### 3. Handshake NTLM sin continuidad segura por request

El fix inicial de "aislar por request" no fue suficiente cuando se configuro el `agent` con `keepAlive: false`.

NTLM necesita:

- no compartir la conexion con otros requests
- pero si preservar la misma conexion dentro del mismo handshake Type1/Type2/Type3

### 4. Headers del navegador interfiriendo con `httpntlm`

Se reenviaban headers crudos del browser hacia `httpntlm`.

La libreria documenta que maneja internamente `Connection` y `Authorization`.

Como Node expone headers en minuscula, el `connection: keep-alive` del navegador podia colarse igual en el request NTLM final y dejar el handshake invalido.

### 5. Ruta de entrada CRM demasiado generica

En `crm-test`, el conector estaba configurado con:

- `entryPath: /ARTTesting/`

Se observo que el backend funcional real abria correctamente en:

- `/ARTTesting/main.aspx`

por lo que el login y el proxy debian alinearse a esa URL efectiva.

## Cambios implementados

## 1. Login NTLM CRM atado al conector correcto

Archivos:

- `src/lib/proxy-manager.ts`
- `src/app/login/ntlm/page.tsx`
- `src/app/login/ntlm/actions.ts`
- `src/auth.ts`

Cambios:

- el redirect a `/login/ntlm` ahora incluye `connectorId`
- la pantalla de login NTLM reenvia `connectorId`
- la server action `ntlmSignIn()` envia `connectorId` al provider
- `ntlm-login` valida contra `getConnectorById(connectorId)` en lugar de buscar "el primer NTLM activo"

Resultado:

- `crm` y `crm-test` ya no comparten ambiguamente las mismas credenciales de sesion

## 2. Persistencia de `crmConnectorId` en JWT y session

Archivo:

- `src/auth.ts`

Cambios:

- se persiste `crmConnectorId` en token
- se expone `crmConnectorId` en session

Resultado:

- el proxy puede validar que las credenciales CRM en sesion pertenecen al conector real de la request

## 3. Rechazo de sesion CRM cruzada entre conectores

Archivos:

- `src/lib/proxy-manager.ts`
- `src/lib/proxy-server.ts`

Cambios:

- si la sesion NTLM no coincide con el conector actual, se fuerza nuevo login NTLM
- si igualmente llega una request CRM con `crmConnectorId` distinto, el proxy responde `409` controlado

Resultado:

- se evita reutilizar credenciales de `crm` en `crm-test` o viceversa

## 4. Circuit breaker anti-lockout AD

Archivo:

- `src/lib/proxy-server.ts`

Cambios:

- se agrego estado en memoria por `connectorId + username`
- se registran fallos `401` en ventana corta
- con densidad anomala se abre un breaker temporal
- mientras el breaker esta abierto, se responde `429`
- se excluyen rutas irrelevantes como `/.well-known/appspecific/...`
- el estado se resetea al recibir respuesta NTLM exitosa

Resultado:

- se reduce fuertemente el riesgo de lockout AD cuando el backend entra en rafaga de rechazos

## 5. Aislamiento correcto del transporte NTLM CRM

Archivo:

- `src/lib/proxy-server.ts`

Cambios:

- se dejo de reutilizar el `agent` compartido en la rama CRM NTLM
- ahora cada request NTLM CRM crea su propio `agent`
- ese `agent` usa:
  - `keepAlive: true`
  - `maxSockets: 1`
  - `maxFreeSockets: 0`
- el `agent` se destruye al terminar el request

Resultado:

- cada request CRM conserva su propio handshake NTLM
- no comparte socket con otros recursos paralelos
- pero mantiene continuidad de conexion dentro del handshake

## 6. Saneamiento de headers reenviados a `httpntlm`

Archivo:

- `src/lib/proxy-server.ts`

Cambios:

- se agrego `buildCrmNtlmHeaders()`
- se dejo de reenviar headers crudos del navegador
- solo se permiten headers seguros y necesarios:
  - `accept`
  - `accept-language`
  - `cache-control`
  - `content-type`
  - `if-match`
  - `if-none-match`
  - `origin`
  - `pragma`
  - `referer`
  - `soapaction`
  - `user-agent`
  - `x-requested-with`

No se reenvian:

- `connection`
- `authorization`
- `cookie`
- `host`
- `accept-encoding`

Resultado:

- se evita interferir con el control interno que hace la libreria `httpntlm` sobre el handshake

## 7. Normalizacion de la entrada Dynamics CRM hacia `main.aspx`

Archivo nuevo:

- `src/lib/dynamics-crm.ts`

Archivos modificados:

- `src/auth.ts`
- `src/lib/proxy-server.ts`

Cambios:

- se agrego `resolveDynamicsCrmMainPath()`
- se agrego `buildDynamicsCrmEntryUrl()`
- se agrego `normalizeDynamicsCrmProxyPath()`
- si el request entra exactamente por la ruta de organizacion, el proxy resuelve a `main.aspx`
- la validacion del login NTLM CRM usa la misma URL real de entrada

Ejemplo:

- `/ARTTesting/` -> `/ARTTesting/main.aspx`

Resultado:

- login y navegacion principal quedan alineados con la URL efectiva del CRM

## 8. Ajuste colateral previo en rutas internas

Archivo:

- `src/lib/proxy-manager.ts`

Ya existia un cambio local previo y se preservo:

- no usar `startsWith("/login")` de forma generica porque capturaba rutas del backend como `/loginexterno.aspx`

Esto no fue la causa principal del incidente CRM actual, pero era importante no revertirlo.

## Validacion realizada

Validacion tecnica:

- `npx tsc -p tsconfig.json --noEmit` OK

Observacion:

- `npm run lint` del repositorio completo sigue fallando por problemas preexistentes en `.agents`, `Dist` y otros archivos ajenos a este fix
- no se considero bloqueo de esta implementacion porque no correspondia a los archivos modificados en este incidente

Validacion funcional reportada:

- el login CRM por proxy finalmente quedo funcionando
- el usuario confirmo funcionamiento correcto
- la traza de consola restante correspondia a scripts internos de Dynamics CRM y no a una falla del proxy

## Archivos modificados

- `src/lib/dynamics-crm.ts`
- `src/lib/proxy-server.ts`
- `src/lib/proxy-manager.ts`
- `src/auth.ts`
- `src/app/login/ntlm/page.tsx`
- `src/app/login/ntlm/actions.ts`

## Señales a vigilar a futuro

Si vuelve a aparecer un incidente similar, revisar en este orden:

1. Si el `401` ocurre en la navegacion principal (`main.aspx`) o solo en recursos secundarios.
2. Si la sesion tiene `crmConnectorId` correcto.
3. Si el backend responde `www-authenticate: Negotiate, NTLM` repetidamente.
4. Si se esta abriendo el breaker anti-lockout.
5. Si el request esta entrando por la ruta correcta de organizacion o por `main.aspx`.
6. Si reaparecio reenvio indebido de headers hacia `httpntlm`.
7. Si algun cambio nuevo vuelve a compartir transporte NTLM entre requests paralelos.

## Conclusion

El incidente no se resolvia con una sola correccion.

La estabilizacion definitiva del login CRM NTLM requirio:

- binding fuerte sesion-conector
- validacion NTLM contra el destino real
- aislamiento de conexion por request
- continuidad correcta de socket durante el handshake
- saneamiento de headers
- defensa anti-lockout para rafagas de `401`

Queda como referencia de arquitectura para cualquier futuro ajuste sobre:

- `dynamics-crm`
- `isNtlm`
- `proxy-server.ts`
- autenticacion NTLM por conector
