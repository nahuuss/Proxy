# Fix Dynamics CRM Lookup Shims

Fecha: 2026-06-29
Modulo: `dynamics-crm`
Estado: aplicado y validado localmente

## Contexto

Se reporto una falla en el conector productivo de Dynamics CRM donde:

- la grilla cargaba correctamente;
- al hacer click sobre un lookup de tipo `Razón Social` o similares no se abria el registro;
- en escenarios intermedios CRM quedaba en blanco o cargaba solo parcialmente.

La evidencia analizada quedo en:

- `analizar/crm/har con links funcionando.har`
- `analizar/crm/har con links fallando en localhost.har`
- `analizar/crm/har con links fallando en localhost2.har`
- `analizar/crm/2026-06-29_1750-1.jsonl`

## Diagnostico

### Problema original de navegacion

Comparando HAR funcionando contra HAR fallando se observo:

- en el caso funcionando, luego del click aparecia una navegacion a `main.aspx?...pagetype=entityrecord`;
- en el caso fallando, el evento cliente entraba en `handleLookupAnchorClick -> openlui -> openObj`, pero no salia ninguna request nueva;
- eso indico que la falla estaba en la navegacion cliente de Dynamics CRM bajo proxy, no en NTLM ni en el backend.

### Primer intento de correccion

Se implemento un shim cliente para:

- interceptar clicks sobre `a.ms-crm-List-Link`;
- leer `oid` y `otype` desde `.gridLui`;
- construir una URL proxificada a `main.aspx?...pagetype=entityrecord`;
- navegar directo sin depender de `openObj/openlui`.

### Falla detectada en `localhost.har`

El primer ajuste generaba:

- `Uncaught SyntaxError: missing ) after argument list`
- `Type is not defined`
- `Sys is not defined`
- pantalla blanca con header celeste

La causa fue que el shim se estaba inyectando tambien en assets JavaScript de CRM, por ejemplo:

- `_common/global.ashx`
- `_common/entityproperties/entitypropertiesutil.js.aspx`
- `_controls/ribbon/RibbonLayout.js.aspx`

Eso rompia el runtime base de Microsoft Ajax y, por cascada, toda la aplicacion CRM.

### Falla detectada en `localhost2.har`

Luego del primer ajuste de filtro, la app ya no quedaba completamente en blanco, pero cargaba "a medias".

El HAR `har con links fallando en localhost2.har` mostro que el shim seguia inyectandose en varias paginas HTML auxiliares de CRM:

- `home_dashboards.aspx`
- `dlg_navtour.aspx`
- `dashboard.aspx`
- `Visualization/visualization.aspx`

Esto no rompia el runtime base, pero ensuciaba pantallas donde no correspondia, generando una carga parcial o inconsistente.

## Causa raiz

La deteccion de "documento HTML CRM" era demasiado amplia.

Problemas encontrados:

1. Se tomaban como HTML real respuestas JavaScript que contenian strings como `"<html>...</html>"`.
2. Se inyectaba el shim en cualquier HTML de Dynamics, incluso cuando no habia grilla lookup.

## Implementacion final

Archivo principal afectado:

- `src/lib/dynamics-crm.ts`

Cambios aplicados:

1. Se mantuvo la reescritura de variables cliente exclusivas de CRM:
   - `SERVER_URL`
   - `WEB_SERVER_HOST`
   - `WEB_SERVER_PORT`

2. Se encapsulo el shim de lookup solo para `dynamics-crm`.

3. Se endurecio la deteccion de HTML real:
   - ahora solo se considera HTML si el contenido comienza efectivamente como documento HTML en el tramo inicial;
   - se evita tomar como HTML un `.js` que contiene `"<html>"` dentro de strings internas.

4. Se restringio la inyeccion del shim a paginas que realmente contienen lookup/grid CRM:
   - `handleLookupAnchorClick`
   - `ms-crm-List-Link`
   - `gridLui`

Con esto el shim ya no entra en:

- assets JS;
- dashboards;
- visualizaciones;
- dialogos HTML sin lookup grid.

Y solo queda en paginas donde realmente hace falta resolver la apertura del registro desde la grilla.

## Validacion realizada

Se agrego cobertura puntual en:

- `tests/dynamics-crm.test.ts`

Casos cubiertos:

1. Inyecta shim en HTML de CRM con lookup grid.
2. No inyecta shim dentro de assets JavaScript.
3. No inyecta shim en HTML de CRM sin lookup grid.

Comando ejecutado:

```bash
node --test tests/dynamics-crm.test.ts
```

Resultado:

- 3 tests OK.

## Resultado operativo

Despues del ultimo ajuste, el usuario reporto:

- "por ahora funciono"

Esto indica que:

- CRM dejo de quedar en blanco;
- desaparecio la carga parcial provocada por inyeccion excesiva;
- el parche quedo acotado al caso de lookup grid dentro del perfil `dynamics-crm`.

## Observaciones

- El parche esta separado por producto/conector y no impacta `generic`, `core`, `bank` ni `serena-test`.
- Cada cambio quedo encapsulado en la capa especifica de Dynamics CRM.
- Si reaparece una falla de apertura de registro, el proximo insumo recomendado es un HAR nuevo posterior a este fix final para validar si la navegacion `main.aspx?...pagetype=entityrecord` ya sale correctamente.
