# V62.7 - AJAX Pipe Fix + Cookie Injection + Diagnostico 154967

**Fecha:** 2026-03-19
**Version anterior:** V62.6
**Version resultante:** V62.7
**Archivo:** `E:\wrapper\wrapper-appProxy.js`

---

## Contexto de la sesion

Se analizaron dos archivos de log (`wrapper.log` y `wrapper1.log`) para continuar el
debug de botones vacios en grillas cuando se accede via Azure App Proxy.

**Situacion al inicio de la sesion (V62.6):**
- `Menu.css` devolvia 404 en todas las cargas de pagina
- `CookieLen=42` para todos los recursos estaticos (CSS/JS/imagenes)
- `CookieLen=815` para requests ASPX (correcto)
- DIAG-PERM mostraba `EDITOR` en algunas cargas pero no siempre
- El log mostraba `[REWRITE] Se reescribieron 85 URLs (Global Fallback)` para
  GestionTramiteMedico.aspx, lo que indicaba un posible bug en el parser AJAX

---

## Bugs encontrados y corregidos

### Bug 1 (CRITICO): Pipe doble en AJAX block reconstruction (introducido en V62.5)

**Descripcion:**
El parser AJAX de V62.5 reconstruia cada bloque Microsoft UpdatePanel con un `|` inicial
extra en el template literal:

```js
// V62.5/V62.6 (INCORRECTO):
newText += `|${content.length}|${type}|${id}|${content}|`;
```

**Efecto:**
- Formato correcto MS AJAX: `length|type|id|content|` (sin pipe inicial)
- Formato producido: `|length|type|id|content|` (pipe sobrante al inicio)
- Entre bloques: `...content||nextLength|...` (doble pipe)
- El motor Microsoft AJAX (ScriptManager/UpdatePanel) recibia una respuesta malformada
  y fallaba silenciosamente, dejando los botones de grilla sin renderizar (LINK-CELL-VACIO)

**Fix (linea 705):**
```js
// V62.7 (CORRECTO):
newText += `${content.length}|${type}|${id}|${content}|`;
```

---

### Bug 2 (CRITICO): Global Fallback corrupto para respuestas ASPX con bloques AJAX

**Descripcion:**
Cuando el parser AJAX encontraba bloques validos pero el dominio a reescribir aparecia
FUERA de los bloques, caia al fallback:

```js
// ANTES: global replace sobre texto original con longitudes VIEJAS
text = text.replace(domainRegex, '');
log('[REWRITE] Global Fallback');
```

**Fix:**
```js
// V62.7: si habia bloques parseados, el replace se hace sobre newText (longitudes OK)
if (blocksFound > 0) {
    text = newText.replace(domainRegex, '');
    log('[AJAX] Replace sobre newText (N bloques seguros, M URLs)');
} else {
    // Sin bloques: HTML plano, replace directo es seguro
    text = text.replace(domainRegex, '');
    log('[REWRITE] Se reescribieron M URLs (HTML plano, sin bloques AJAX)');
}
```

Tambien se agrego el contador `blocksFound` dentro del loop del parser.

---

### Bug 3: Cookie Injection para recursos estaticos (Menu.css 404 -> 200)

**Causa raiz:**
La cookie de sesion ASP.NET tenia `path=/SIN/` configurado por el servidor.
El browser NO enviaba la cookie para recursos fuera de `/SIN/`:
- `/App_Themes/OmintTheme/Web/Menu.css` -> `CookieLen=42` (solo token App Proxy)
- El servidor requeria autenticacion para servir Menu.css -> devolvia 404

La correccion de V62.6 (`Set-Cookie path=/`) solo funciona para cookies NUEVAS.
Los logs confirmaron que `CookieLen` seguia siendo 42 para CSS en sesiones activas.

**Fix - Cookie Injection (scope del worker):**
```js
// Variable worker-scoped (persiste entre requests del mismo worker)
let lastFullCookie = '';

// En el handler de cada request:
if (isAspxRequest && cookieLen > 200) {
    lastFullCookie = headers['cookie'];
    log('[COOKIE-STORE] Guardada cookie de Nb desde ASPX');
}
if (isStaticResource && cookieLen < 100 && lastFullCookie) {
    headers['cookie'] = lastFullCookie;
    log('[COOKIE-INJECT] Inyectando Nb en /path/file.css');
}
```

**Resultado confirmado en logs:**
- `[COOKIE-INJECT] Inyectando 815b en /App_Themes/OmintTheme/Web/Menu.css`
- `Menu.css -> 200 OK` (antes: `[WARN] 404`)

---

### Bug 4: Regex Set-Cookie con trailing slash

**Descripcion:**
La regex `/path=\/[a-zA-Z0-9_-]*/` no capturaba la barra final:
- Input: `ASPXAUTH=xxx; path=/SIN/; HttpOnly`
- Output incorrecto: `path=//; HttpOnly` (doble slash)

**Fix:**
```js
c.replace(/path=\/[^;,\s]*/gi, 'path=/')
```

Aplicado en dos lugares: modo piping (~linea 601) y modo sendProcessed (~linea 728).

---

## Logging agregado en V62.7

| Tag | Cuando aparece |
|-----|----------------|
| `[AJAX-PARSE] Iniciando` | Antes de parsear bloques AJAX en un .aspx |
| `[AJAX-PARSE] Resultado` | Muestra blocks=N changed=T/F fixes=M |
| `[COOKIE-STORE]` | Al guardar cookie completa de un ASPX request |
| `[COOKIE-INJECT]` | Al inyectar cookie en recurso estatico con cookie pobre |
| `[AJAX] Replace sobre newText` | Cuando hay bloques OK pero dominio fuera de ellos |
| `[REWRITE] HTML plano` | Cuando no hay bloques AJAX, replace directo |

---

## Footer/TUI actualizado

El footer del TUI tenia hardcodeado `V62.6`. Se actualizo a `V62.7` en:
- Linea de status inferior: `Feature: App Proxy V62.7`
- Log de inicio: `Motor App Proxy V62.7 activo.`

---

## Diagnostico de siniestro 154967

### Hallazgos del log

| Timestamp | Evento | Detalle |
|-----------|--------|---------|
| 18:25:21 | ABMTramiteMedico.aspx | 2,005,171 chars, blocks=0, 104 URLs reescritas |
| 18:26:21 | ABMTramiteMedico.aspx | 2,005,316 chars (misma pagina, 1 min despues) |
| 18:29:15 | ABMTramiteMedico.aspx | 2,005,171 chars |
| 18:29:18 | 5x POST ABMTramite -> JSON | Callbacks de secciones, todos rapidos (< 1s) |
| 18:29:23 | GestionTramiteMedico.aspx | 889,878 chars (vs usual 927KB = con resultados filtrados) |
| 18:37:43 | GestionTramiteMedico.aspx | EDITOR (zoom=true ver=true edit=true cell=true) |
| 18:38:36 | ABMTramiteMedico.aspx (158666) | EDITOR (todos los botones presentes) |

### Conclusion

**El proxy NO es el problema para 154967.**

La pagina ABMTramiteMedico.aspx para el tramite 154967 es de 2MB.
El proxy la procesa correctamente:
- AJAX-PARSE: blocks=0 (HTML full, no respuesta UpdatePanel)
- 104 URLs internas reescritas correctamente
- Callbacks JSON inmediatos regresan en menos de 1 segundo

El "la consulta se queda en cargando" es un problema de datos/servidor
especifico para ese tramite:
- Una query de BD lenta para alguna seccion especifica del tramite 154967
- Un callback especifico que puede tardar > 75s y App Proxy lo corta (ECONNRESET)
- Un error JS en el browser al procesar los datos de 154967

### Para confirmar la causa

1. Probar 154967 desde ADENTRO de la red (sin proxy):
   - Si tambien falla: problema 100% de servidor/datos
   - Si solo falla desde afuera: hay un callback que supera el timeout de App Proxy (75s)

2. Si falla solo desde afuera: en el log del proxy deberia aparecer:
   `[ERROR] ECONNRESET /SIN/TramiteMedico/ABMTramiteMedico.aspx`

---

## Resultado final V62.7

| Problema | Estado |
|----------|--------|
| Menu.css 404 | RESUELTO (COOKIE-INJECT) |
| Doble pipe AJAX | RESUELTO (fix template literal) |
| Global Fallback corrupto | RESUELTO (replace sobre newText) |
| Set-Cookie trailing slash | RESUELTO (regex mejorada) |
| GestionTramiteMedico EDITOR | CONFIRMADO en logs (18:37:43) |
| 158666 botones visibles | CONFIRMADO en logs (EDITOR 18:38:36) |
| 154967 cargando | PENDIENTE (diagnosticar desde adentro) |
