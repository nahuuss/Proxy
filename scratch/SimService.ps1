try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}
$OutputEncoding = [System.Text.Encoding]::UTF8

# SimService.ps1 - Backend simulado para probar productos BizGuard

function Get-FreePort {
    try {
        $tcpListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
        $tcpListener.Start()
        $freePort = $tcpListener.LocalEndpoint.Port
        $tcpListener.Stop()
        return $freePort
    } catch {
        return 8085
    }
}

function Send-HtmlResponse($res, $req, $html, $statusCode = 200) {
    $res.StatusCode = $statusCode
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($html)
    $res.ContentLength64 = $buffer.Length
    $res.ContentType = "text/html; charset=utf-8"
    if ($req.HttpMethod -ne "HEAD") {
        $res.OutputStream.Write($buffer, 0, $buffer.Length)
    }
}

function Send-JsonResponse($res, $req, $payload, $statusCode = 200) {
    $res.StatusCode = $statusCode
    $json = $payload | ConvertTo-Json -Depth 8 -Compress
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
    $res.ContentLength64 = $buffer.Length
    $res.ContentType = "application/json; charset=utf-8"
    if ($req.HttpMethod -ne "HEAD") {
        $res.OutputStream.Write($buffer, 0, $buffer.Length)
    }
}

function Send-PlainTextResponse($res, $req, $text, $statusCode = 200, $contentType = "text/plain; charset=utf-8") {
    $res.StatusCode = $statusCode
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($text)
    $res.ContentLength64 = $buffer.Length
    $res.ContentType = $contentType
    if ($req.HttpMethod -ne "HEAD") {
        $res.OutputStream.Write($buffer, 0, $buffer.Length)
    }
}

function Read-RequestBody($req) {
    $reader = New-Object System.IO.StreamReader($req.InputStream)
    return $reader.ReadToEnd()
}

function Get-LoginHtml {
@"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>BizGuard SimService - Login requerido</title>
    <style>
        body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 50px; text-align: center; }
        .card { background: #1e293b; padding: 35px; border-radius: 12px; display: inline-block; border: 1px solid #334155; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); }
        h1 { color: #38bdf8; margin-top: 0; }
        p { color: #94a3b8; font-size: 0.95rem; }
        input { width: 100%; max-width: 250px; padding: 10px; margin: 8px 0; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; box-sizing: border-box; }
        button { width: 100%; max-width: 250px; padding: 10px; background: #38bdf8; color: #0f172a; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 10px; }
        button:hover { background: #0ea5e9; }
    </style>
</head>
<body>
    <div class="card">
        <h1>SimService - Login requerido</h1>
        <p>Inicia sesion con cualquier dato ficticio para desbloquear las pruebas.</p>
        <form method="POST" action="/signin">
            <input type="text" name="user" placeholder="Usuario ficticio" required><br>
            <input type="password" name="password" placeholder="Contrasena ficticia" required><br>
            <button type="submit">Iniciar sesion de prueba</button>
        </form>
    </div>
</body>
</html>
"@
}

function Get-DashboardHtml {
@"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>BizGuard SimService</title>
    <style>
        body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 36px; }
        .container { max-width: 1180px; margin: 0 auto; }
        .header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; border-bottom: 1px solid #334155; padding-bottom: 16px; gap: 12px; }
        .title-wrap p { color: #94a3b8; margin: 6px 0 0 0; }
        .card { background: #1e293b; padding: 22px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 20px; }
        h1 { color: #38bdf8; margin: 0; }
        h2 { color: #e2e8f0; font-size: 1.18rem; margin-top: 0; }
        h3 { color: #cbd5e1; font-size: 0.96rem; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.04em; }
        p { color: #94a3b8; font-size: 0.92rem; line-height: 1.5; }
        code { color: #c4b5fd; }
        input { width: 100%; max-width: 320px; padding: 10px; margin: 8px 0; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; box-sizing: border-box; }
        button, .btn { display: inline-block; padding: 10px 16px; background: #38bdf8; color: #0f172a; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; text-decoration: none; font-size: 0.88rem; margin-top: 6px; }
        button:hover, .btn:hover { background: #0ea5e9; }
        .btn-secondary { background: #334155; color: #f8fafc; }
        .btn-success { background: #10b981; color: #fff; }
        .btn-warning { background: #eab308; color: #0f172a; }
        .btn-danger { background: #ef4444; color: #fff; }
        .btn-purple { background: #8b5cf6; color: #fff; }
        .btn-cyan { background: #06b6d4; color: #fff; }
        .btn-rose { background: #f43f5e; color: #fff; }
        .tab-bar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
        .tab-btn { background: #0f172a; color: #cbd5e1; border: 1px solid #334155; padding: 10px 14px; border-radius: 999px; cursor: pointer; font-weight: bold; }
        .tab-btn.active { background: #38bdf8; color: #0f172a; border-color: #38bdf8; }
        .tab-panel { display: none; }
        .tab-panel.active { display: block; }
        .grid { display: grid; grid-template-columns: 1fr; gap: 18px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 20px; }
        .metrics .card { margin-bottom: 0; }
        .note { font-size: 0.86rem; color: #cbd5e1; background: #0b1220; border: 1px solid #233047; border-radius: 10px; padding: 12px 14px; margin-bottom: 18px; }
        .actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .result { margin-top: 12px; font-family: Consolas, monospace; font-size: 0.8rem; color: #a7f3d0; white-space: pre-wrap; background: #020617; padding: 12px; border-radius: 8px; min-height: 62px; }
        .list { margin: 0; padding-left: 18px; color: #94a3b8; }
        .list li { margin-bottom: 6px; }
        @media(min-width: 840px) { .grid { grid-template-columns: 1fr 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header-bar">
            <div class="title-wrap">
                <h1>BizGuard SimService</h1>
                <p>Tabs de prueba por producto para Generic, Bank, Core, Dynamics CRM y Serena Test.</p>
            </div>
            <a href="/logout" class="btn btn-danger">Cerrar sesion</a>
        </div>

        <div class="note">
            Usa esta URL como <strong>URL Interna</strong> del conector que quieras probar en BizGuard. Cada tab ataca rutas y comportamientos alineados con la estrategia del producto.
        </div>

        <div class="metrics">
            <div class="card"><h3>Generic</h3><p>GET largos, descarga lenta y diagnostico 404 sin personalizaciones agresivas.</p></div>
            <div class="card"><h3>Bank</h3><p>UploadAndProcess, UploadAndProcessMutual y correccion de <code>type: "Json"</code>.</p></div>
            <div class="card"><h3>Core</h3><p>XHR largos, uploads multipart y redirects demorados.</p></div>
            <div class="card"><h3>CRM / Serena</h3><p>EntryPath, 401 tipo NTLM, AJAX Delta y limpieza de rutas DNN.</p></div>
        </div>

        <div class="tab-bar">
            <button class="tab-btn active" onclick="showTab('generic', this)">Generic</button>
            <button class="tab-btn" onclick="showTab('bank', this)">Bank</button>
            <button class="tab-btn" onclick="showTab('core', this)">Core</button>
            <button class="tab-btn" onclick="showTab('crm', this)">Dynamics CRM</button>
            <button class="tab-btn" onclick="showTab('serena', this)">Serena Test</button>
        </div>

        <section class="tab-panel active" id="tab-generic">
            <div class="note">Configura el conector como <strong>generic</strong>. Esperado: Heartbeat solo para GET largos; XHR JSON debe mantenerse conservador.</div>
            <div class="grid">
                <div class="card">
                    <h2>GET largo HTML</h2>
                    <p>Simula una pagina lenta para validar Heartbeat Shield pasivo.</p>
                    <div class="actions">
                        <a href="/wait?seconds=12" class="btn btn-rose">Espera HTML 12s</a>
                    </div>
                </div>
                <div class="card">
                    <h2>XHR JSON conservador</h2>
                    <p>Peticion AJAX lenta para validar que Generic no fuerce un modo incorrecto.</p>
                    <div class="actions">
                        <button class="btn btn-purple" onclick="testAjax('/api/slow-json?mode=generic-xhr', 'genericResult', 'X-Requested-With', 'GET')">XHR con X-Requested-With</button>
                        <button class="btn btn-secondary" onclick="testAjax('/api/slow-json?mode=generic-accept', 'genericResult', 'Accept-Header', 'GET')">XHR con Accept JSON</button>
                    </div>
                    <pre class="result" id="genericResult">Esperando ejecucion...</pre>
                </div>
                <div class="card">
                    <h2>Descarga binaria</h2>
                    <p>PDF lento para revisar buffering y entrega limpia.</p>
                    <div class="actions">
                        <a href="/download-slow" class="btn btn-cyan">Descargar PDF</a>
                    </div>
                </div>
                <div class="card">
                    <h2>Diagnostico 404</h2>
                    <p>Sirve para revisar telemetry, traffic logs y comportamiento de errores.</p>
                    <div class="actions">
                        <a href="/ruta-inexistente" class="btn btn-secondary">Forzar 404</a>
                    </div>
                </div>
            </div>
        </section>

        <section class="tab-panel" id="tab-bank">
            <div class="note">Configura el conector como <strong>bank</strong>. Esperado: uploads largos en background-job y correccion del script <code>type: "Json"</code> a POST.</div>
            <div class="grid">
                <div class="card">
                    <h2>UploadAndProcess</h2>
                    <p>Ruta critica de cobranza automatica para validar background-job.</p>
                    <form method="POST" action="/bank/cobranzaautomatica/uploadandprocess" enctype="multipart/form-data">
                        <input type="file" name="testfile" required><br>
                        <button type="submit" class="btn btn-success">Subir a UploadAndProcess</button>
                    </form>
                </div>
                <div class="card">
                    <h2>UploadAndProcessMutual</h2>
                    <p>Segunda ruta critica de BANK para comparar el mismo comportamiento.</p>
                    <form method="POST" action="/bank/cobranzaautomatica/uploadandprocessmutual" enctype="multipart/form-data">
                        <input type="file" name="testfile" required><br>
                        <button type="submit" class="btn btn-success">Subir a Mutual</button>
                    </form>
                </div>
                <div class="card">
                    <h2>Correccion de type: "Json"</h2>
                    <p>Abre una pagina cuyo script viene con el bug clasico de BANK. Con BizGuard debe terminar invocando POST al endpoint lento.</p>
                    <div class="actions">
                        <a href="/bank/ajax-json-page" class="btn btn-purple">Abrir pagina con bug</a>
                    </div>
                </div>
                <div class="card">
                    <h2>GET largo BANK</h2>
                    <p>Confirmacion visual de que Bank conserva el Heartbeat para navegacion GET tradicional.</p>
                    <div class="actions">
                        <a href="/wait?seconds=14" class="btn btn-rose">GET largo 14s</a>
                    </div>
                </div>
            </div>
        </section>

        <section class="tab-panel" id="tab-core">
            <div class="note">Configura el conector como <strong>core</strong>. Esperado: XHR largos con keepalive, uploads multipart protegidos y redirects demorados bien resueltos.</div>
            <div class="grid">
                <div class="card">
                    <h2>XHR largo Core</h2>
                    <p>Prueba principal de XHR largo para validar keepalive.</p>
                    <div class="actions">
                        <button class="btn btn-purple" onclick="testAjax('/core/api/slow-json?mode=core-xhr', 'coreAjaxResult', 'X-Requested-With', 'GET')">XHR Core</button>
                    </div>
                    <pre class="result" id="coreAjaxResult">Esperando ejecucion...</pre>
                </div>
                <div class="card">
                    <h2>Upload multipart Core</h2>
                    <p>Subida pesada para validar background job y continuidad del request.</p>
                    <form method="POST" action="/core/upload" enctype="multipart/form-data">
                        <input type="file" name="testfile" required><br>
                        <button type="submit" class="btn btn-success">Upload Core</button>
                    </form>
                </div>
                <div class="card">
                    <h2>Descarga PDF lenta</h2>
                    <p>Chequea buffering de binarios y cierre correcto del flujo.</p>
                    <div class="actions">
                        <a href="/download-slow" class="btn btn-cyan">Descargar PDF</a>
                    </div>
                </div>
                <div class="card">
                    <h2>Redirect 302 lento</h2>
                    <p>Valida que una respuesta larga finalizando en redirect no rompa el cliente.</p>
                    <div class="actions">
                        <a href="/slow-redirect" class="btn btn-warning">Ejecutar redirect</a>
                    </div>
                </div>
            </div>
        </section>

        <section class="tab-panel" id="tab-crm">
            <div class="note">Configura el conector como <strong>dynamics-crm</strong>. Esperado: entryPath dedicado, manejo de 401 tipo NTLM y reglas de Heartbeat conservadoras.</div>
            <div class="grid">
                <div class="card">
                    <h2>EntryPath CRM</h2>
                    <p>Abre un entryPath simulado tipo CRM.</p>
                    <div class="actions">
                        <a href="/SERENAART/" class="btn btn-cyan">Abrir entryPath</a>
                    </div>
                </div>
                <div class="card">
                    <h2>401 NTLM</h2>
                    <p>Respuesta 401 con header <code>WWW-Authenticate: NTLM</code> para revisar logs y proteccion anti-lockout.</p>
                    <div class="actions">
                        <a href="/crm/auth-fail" class="btn btn-danger">Forzar 401</a>
                    </div>
                </div>
                <div class="card">
                    <h2>XHR lento CRM</h2>
                    <p>Prueba de request CRM sin reglas agresivas.</p>
                    <div class="actions">
                        <button class="btn btn-purple" onclick="testAjax('/crm/api/slow-json?mode=crm-xhr', 'crmAjaxResult', 'Accept-Header', 'GET')">XHR CRM</button>
                    </div>
                    <pre class="result" id="crmAjaxResult">Esperando ejecucion...</pre>
                </div>
            </div>
        </section>

        <section class="tab-panel" id="tab-serena">
            <div class="note">Configura el conector como <strong>serena-test</strong>. Esperado: login excluido del HB, AJAX Delta intacto y limpieza de rutas DNN duplicadas.</div>
            <div class="grid">
                <div class="card">
                    <h2>Login / Ingreso</h2>
                    <p>Ruta con marcadores DNN para validar exclusion de login y auto-reload.</p>
                    <div class="actions">
                        <a href="/serena/ingreso" class="btn btn-secondary">Abrir ingreso</a>
                    </div>
                </div>
                <div class="card">
                    <h2>AJAX Delta</h2>
                    <p>POST tipo Delta que no debe romperse por Heartbeat.</p>
                    <div class="actions">
                        <button class="btn btn-purple" onclick="testDelta()">Ejecutar Delta AJAX</button>
                    </div>
                    <pre class="result" id="serenaDeltaResult">Esperando ejecucion...</pre>
                </div>
                <div class="card">
                    <h2>Upload Serena</h2>
                    <p>Subida pesada del sandbox para revisar aislamiento de reglas.</p>
                    <form method="POST" action="/serena/upload" enctype="multipart/form-data">
                        <input type="file" name="testfile" required><br>
                        <button type="submit" class="btn btn-success">Upload Serena</button>
                    </form>
                </div>
                <div class="card">
                    <h2>Limpieza DNN</h2>
                    <p>Respuesta con rutas duplicadas <code>//Portals/</code> para observar rewrite en el HTML.</p>
                    <div class="actions">
                        <a href="/serena/dnn-paths" class="btn btn-cyan">Abrir DNN paths</a>
                    </div>
                </div>
            </div>
        </section>

        <div class="card">
            <h2>Matriz sugerida de chequeo</h2>
            <ul class="list">
                <li>Revisar en logs de trafico si el path dispara el modo esperado para el producto.</li>
                <li>Comparar comportamiento con y sin BizGuard cuando sea necesario, especialmente BANK type: "Json".</li>
                <li>Validar que una mejora de un producto no cambie los escenarios de otro.</li>
            </ul>
        </div>

        <script>
            function showTab(tabId, button) {
                document.querySelectorAll('.tab-panel').forEach(function(panel) {
                    panel.classList.toggle('active', panel.id === 'tab-' + tabId);
                });
                document.querySelectorAll('.tab-btn').forEach(function(btn) {
                    btn.classList.toggle('active', btn === button);
                });
            }

            function testAjax(url, resultId, mode, method) {
                var resDiv = document.getElementById(resultId);
                resDiv.textContent = 'Ejecutando peticion lenta (' + mode + ')...';
                var headers = {};
                if (mode === 'X-Requested-With') {
                    headers['X-Requested-With'] = 'XMLHttpRequest';
                }
                if (mode === 'Accept-Header') {
                    headers['Accept'] = 'application/json';
                }
                fetch(url, {
                    method: method || 'GET',
                    headers: headers
                })
                    .then(function(r) {
                        return r.json().then(function(data) {
                            return { ok: r.ok, status: r.status, data: data };
                        });
                    })
                    .then(function(data) {
                        resDiv.textContent = JSON.stringify(data, null, 2);
                    })
                    .catch(function(err) {
                        resDiv.textContent = 'ERROR: ' + err.message;
                    });
            }

            function testDelta() {
                var resDiv = document.getElementById('serenaDeltaResult');
                resDiv.textContent = 'Ejecutando Delta AJAX...';
                fetch('/serena/delta-endpoint', {
                    method: 'POST',
                    headers: {
                        'X-MicrosoftAjax': 'Delta=true',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'Accept': 'text/plain'
                    },
                    body: 'ctl00$MainContent$btn=1'
                })
                    .then(function(r) {
                        return r.text().then(function(text) {
                            return { ok: r.ok, status: r.status, text: text };
                        });
                    })
                    .then(function(result) {
                        resDiv.textContent = JSON.stringify(result, null, 2);
                    })
                    .catch(function(err) {
                        resDiv.textContent = 'ERROR: ' + err.message;
                    });
            }
        </script>
    </div>
</body>
</html>
"@
}

function Get-WaitHtml($seconds) {
@"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Espera finalizada</title>
    <style>
        body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 50px; text-align: center; }
        .card { background: #1e293b; padding: 30px; border-radius: 12px; display: inline-block; border: 1px solid #334155; }
        h1 { color: #f43f5e; }
        a { color: #38bdf8; text-decoration: none; font-weight: bold; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Espera de $seconds segundos completada</h1>
        <p>Esta respuesta demorada sirve para verificar que el Heartbeat Shield o el keepalive mantuvieron viva la conexion sin lanzar timeout.</p>
        <br>
        <a href="/">Volver al inicio</a>
    </div>
</body>
</html>
"@
}

function Get-UploadHtml($title, $subtitle, $bytes) {
@"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Subida completada</title>
    <style>
        body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 50px; text-align: center; }
        .card { background: #1e293b; padding: 30px; border-radius: 12px; display: inline-block; border: 1px solid #334155; }
        h1 { color: #10b981; }
        a { color: #38bdf8; text-decoration: none; font-weight: bold; }
    </style>
</head>
<body>
    <div class="card">
        <h1>$title</h1>
        <p>$subtitle</p>
        <p>Bytes recibidos: <strong>$bytes</strong>. Verifica los logs de trafico y el modo de ejecucion esperado.</p>
        <br>
        <a href="/">Volver al inicio</a>
    </div>
</body>
</html>
"@
}

function Get-BankAjaxBugHtml {
@"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>BANK AJAX Json Bug</title>
    <style>
        body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; }
        .card { background: #1e293b; padding: 24px; border-radius: 12px; border: 1px solid #334155; max-width: 900px; margin: 0 auto; }
        .btn { display: inline-block; margin-top: 10px; padding: 10px 16px; border-radius: 6px; text-decoration: none; font-weight: bold; background: #8b5cf6; color: #fff; border: none; cursor: pointer; }
        pre { background: #020617; color: #a7f3d0; padding: 12px; border-radius: 8px; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="card">
        <h1>BANK - type: "Json"</h1>
        <p>Esta pagina entrega un script con el bug historico de BANK. Si BizGuard reescribe el body, la llamada debe terminar como <strong>POST</strong>.</p>
        <button class="btn" onclick="runBankBug()">Ejecutar llamada</button>
        <pre id="bankResult">Esperando ejecucion...</pre>
    </div>
    <script>
        function fakeAjax(cfg) {
            var method = cfg.type === "POST" ? "POST" : "GET";
            fetch(cfg.url, {
                method: method,
                headers: { "Accept": "application/json" }
            })
                .then(function(r) {
                    return r.json().then(function(data) {
                        return { ok: r.ok, status: r.status, data: data };
                    });
                })
                .then(function(result) {
                    document.getElementById("bankResult").textContent = JSON.stringify(result, null, 2);
                })
                .catch(function(err) {
                    document.getElementById("bankResult").textContent = "ERROR: " + err.message;
                });
        }
        function runBankBug() {
            fakeAjax({
                url: "/bank/api/slow-json?mode=bank-json-bug",
                type: "Json"
            });
        }
    </script>
</body>
</html>
"@
}

function Get-CrmEntryHtml {
@"
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Dynamics CRM simulado</title></head>
<body style="font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:40px;">
    <div style="background:#1e293b;padding:24px;border-radius:12px;border:1px solid #334155;max-width:900px;margin:0 auto;">
        <h1 style="color:#38bdf8;">Dynamics CRM simulado</h1>
        <p>EntryPath CRM para probar reescrituras, entrada dedicada y respuestas 401 tipo NTLM.</p>
        <p><a href="/crm/auth-fail" style="color:#f8fafc;">Forzar 401 tipo NTLM</a></p>
        <p><a href="/crm/api/slow-json?mode=crm-fetch" style="color:#f8fafc;">XHR lento CRM</a></p>
        <p><a href="/" style="color:#38bdf8;">Volver</a></p>
    </div>
</body>
</html>
"@
}

function Get-SerenaLoginHtml {
@"
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Serena login simulado</title></head>
<body>
    <div id="dnn_ctr820_ContentPane">
        <h1>Ingreso Serena Test</h1>
        <button id="cmdLogin">Login</button>
        <p>Marcadores DNN para validar exclusion de login del Heartbeat e inyeccion de autoreload.</p>
    </div>
</body>
</html>
"@
}

function Get-SerenaDnnPathsHtml {
@"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>DNN Paths simulado</title>
</head>
<body>
    <img src="//Portals/0//Images/logo.png" alt="logo">
    <link rel="stylesheet" href="//Portals/0//Skins/site.css">
    <script src="//Portals/0//DesktopModules/app.js"></script>
    <h1>DNN Path Cleanup</h1>
    <p>Esta respuesta contiene rutas duplicadas para validar la limpieza de Serena-Test.</p>
</body>
</html>
"@
}

$uploadRoutes = @(
    "/upload",
    "/core/upload",
    "/bank/cobranzaautomatica/uploadandprocess",
    "/bank/cobranzaautomatica/uploadandprocessmutual",
    "/serena/upload"
)

$slowJsonRoutes = @(
    "/api/slow-json",
    "/core/api/slow-json",
    "/bank/api/slow-json",
    "/crm/api/slow-json"
)

$port = Get-FreePort
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Prefixes.Add("http://localhost:$port/")

$started = $false
try {
    $listener.Start()
    $started = $true
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "  SimService levantado en puerto: $port" -ForegroundColor Green
    Write-Host "  URL: http://localhost:$port/" -ForegroundColor White
    Write-Host "  Usa esta URL como 'URL Interna' en BizGuard." -ForegroundColor Gray
    Write-Host "  Hay tabs de prueba por producto tras hacer login ficticio." -ForegroundColor Yellow
    Write-Host "  Presiona Ctrl + C para detener el servicio." -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Cyan

    while ($listener.IsListening) {
        $context = $null
        try {
            $context = $listener.GetContext()
            $req = $context.Request
            $res = $context.Response
            $path = $req.Url.AbsolutePath
            $query = $req.Url.Query

            $hasSession = $false
            $cookieHeader = $req.Headers.Get("Cookie")
            if ($cookieHeader -and $cookieHeader -match "SessionToken=AD_User_Mock_Session") {
                $hasSession = $true
            }

            Write-Host "[SimService] [$($req.HttpMethod)] (Sesion=$hasSession) $path$query" -ForegroundColor Gray

            if ($path -eq "/signin" -and $req.HttpMethod -eq "POST") {
                $body = Read-RequestBody $req
                Write-Host "[SimService] Falso login recibido: $body" -ForegroundColor White
                $res.Headers.Add("Set-Cookie", "SessionToken=AD_User_Mock_Session_67890; Path=/; HttpOnly")
                $res.StatusCode = 302
                $res.Headers.Add("Location", "/")
                $res.Close()
                continue
            }

            if ($path -eq "/logout") {
                Write-Host "[SimService] Cerrando sesion..." -ForegroundColor White
                $res.Headers.Add("Set-Cookie", "SessionToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly")
                $res.StatusCode = 302
                $res.Headers.Add("Location", "/")
                $res.Close()
                continue
            }

            if (-not $hasSession -and $path -ne "/" -and $path -ne "/favicon.ico" -and $path -ne "/signin") {
                Write-Host "[SimService] Intento sin sesion a $path. Redirigiendo..." -ForegroundColor DarkYellow
                $res.StatusCode = 302
                $res.Headers.Add("Location", "/")
                $res.Close()
                continue
            }

            if ($path -eq "/favicon.ico") {
                $res.StatusCode = 404
                $res.Close()
                continue
            }

            if ($path -eq "/wait") {
                $seconds = 20
                if ($query -match "seconds=(\d+)") {
                    $seconds = [int]$Matches[1]
                }
                Write-Host "[SimService] Espera lenta de $seconds segundos..." -ForegroundColor Yellow
                Start-Sleep -Seconds $seconds
                Send-HtmlResponse -res $res -req $req -html (Get-WaitHtml $seconds)
            }
            elseif ($uploadRoutes -contains $path -and $req.HttpMethod -eq "POST") {
                $body = Read-RequestBody $req
                $delaySeconds = 15
                $title = "Carga y procesamiento de archivo completado"
                $subtitle = "Se emulo una carga de archivo lenta para validar la continuidad del flujo."

                if ($path.StartsWith("/bank/")) {
                    $delaySeconds = 18
                    $title = "BANK - UploadAndProcess completado"
                    $subtitle = "Se simulo una cobranza larga tipo BANK para validar background-job."
                } elseif ($path -eq "/core/upload") {
                    $delaySeconds = 16
                    $title = "CORE - Upload multipart completado"
                    $subtitle = "Se simulo una subida multipart de Core para validar uploads largos."
                } elseif ($path -eq "/serena/upload") {
                    $delaySeconds = 16
                    $title = "Serena Test - Upload completado"
                    $subtitle = "Se simulo una subida pesada del sandbox Serena Test."
                }

                Write-Host "[SimService] Upload lento en $path ($delaySeconds s)..." -ForegroundColor Cyan
                Start-Sleep -Seconds $delaySeconds
                Send-HtmlResponse -res $res -req $req -html (Get-UploadHtml $title $subtitle $body.Length)
            }
            elseif ($slowJsonRoutes -contains $path) {
                $mode = "desconocido"
                if ($query -match "mode=([^&]+)") {
                    $mode = [System.Uri]::UnescapeDataString($Matches[1])
                }

                $delaySeconds = if ($path.StartsWith("/core/")) { 16 } elseif ($path.StartsWith("/crm/")) { 8 } else { 15 }

                if ($path -eq "/bank/api/slow-json" -and $req.HttpMethod -ne "POST") {
                    Send-JsonResponse -res $res -req $req -statusCode 405 -payload @{
                        status = "error"
                        expected = "POST"
                        actual = $req.HttpMethod
                        message = 'BANK requiere POST. Si BizGuard reescribe type: "Json", este endpoint debe pasar a POST.'
                    }
                } else {
                    Write-Host "[SimService] AJAX lento en $path ($delaySeconds s) | modo=$mode" -ForegroundColor Magenta
                    Start-Sleep -Seconds $delaySeconds
                    Send-JsonResponse -res $res -req $req -payload @{
                        status = "success"
                        message = "Peticion AJAX lenta procesada con exito"
                        mode = $mode
                        path = $path
                        method = $req.HttpMethod
                        ts = (Get-Date -Format "o")
                    }
                }
            }
            elseif ($path -eq "/bank/ajax-json-page") {
                Send-HtmlResponse -res $res -req $req -html (Get-BankAjaxBugHtml)
            }
            elseif ($path -eq "/SERENAART/" -or $path -eq "/crm/entry") {
                Send-HtmlResponse -res $res -req $req -html (Get-CrmEntryHtml)
            }
            elseif ($path -eq "/crm/auth-fail") {
                $res.Headers.Add("WWW-Authenticate", "NTLM")
                Send-HtmlResponse -res $res -req $req -statusCode 401 -html "<html><body><h1>CRM 401 NTLM</h1><p>Respuesta 401 simulada para validar CRM / anti-lockout.</p></body></html>"
            }
            elseif ($path -eq "/serena/ingreso" -or $path -eq "/serena/login") {
                Send-HtmlResponse -res $res -req $req -html (Get-SerenaLoginHtml)
            }
            elseif ($path -eq "/serena/delta-endpoint") {
                Write-Host "[SimService] AJAX Delta Serena-Test (12 s)..." -ForegroundColor DarkMagenta
                Start-Sleep -Seconds 12
                Send-PlainTextResponse -res $res -req $req -text "|updatePanel|ctl00`$MainContent`$updPanel|<div>Delta OK $(Get-Date -Format "HH:mm:ss")</div>|"
            }
            elseif ($path -eq "/serena/dnn-paths") {
                Send-HtmlResponse -res $res -req $req -html (Get-SerenaDnnPathsHtml)
            }
            elseif ($path -eq "/download-slow") {
                Write-Host "[SimService] Generando PDF lento (15 s)..." -ForegroundColor Cyan
                Start-Sleep -Seconds 15
                $res.StatusCode = 200
                $res.ContentType = "application/pdf"
                $res.Headers.Add("Content-Disposition", "attachment; filename=`"reporte-bizguard.pdf`"")
                $pdfContent = "%PDF-1.4`n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj`n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj`n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj`n4 0 obj<</Length 44>>stream`nBT /F1 24 Tf 100 700 Td (BizGuard Test PDF Report) Tj ET`nendstream`nendobj`nxref`n0 5`n0000000000 65535 f`n0000000009 00000 n`n0000000056 00000 n`n0000000111 00000 n`n0000000212 00000 n`ntrailer<</Size 5/Root 1 0 R>>`nstartxref`n307`n%%EOF"
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($pdfContent)
                $res.ContentLength64 = $buffer.Length
                if ($req.HttpMethod -ne "HEAD") {
                    $res.OutputStream.Write($buffer, 0, $buffer.Length)
                }
            }
            elseif ($path -eq "/slow-redirect") {
                Write-Host "[SimService] Redireccion lenta (15 s)..." -ForegroundColor Green
                Start-Sleep -Seconds 15
                $res.StatusCode = 302
                $res.Headers.Add("Location", "/")
            }
            elseif ($path -eq "/") {
                if (-not $hasSession) {
                    Send-HtmlResponse -res $res -req $req -html (Get-LoginHtml)
                } else {
                    Send-HtmlResponse -res $res -req $req -html (Get-DashboardHtml)
                }
            }
            else {
                Send-HtmlResponse -res $res -req $req -html "Ruta de prueba no encontrada" -statusCode 404
            }

            $res.Close()
        } catch {
            Write-Host "[SimService] Error procesando peticion individual: $_" -ForegroundColor DarkYellow
            if ($context -ne $null) {
                try { $context.Response.Close() } catch {}
            }
        }
    }
} catch {
    Write-Error $_.Exception.Message
} finally {
    if ($listener -ne $null -and $started) {
        try {
            $listener.Stop()
            $listener.Close()
        } catch {}
    }
}
