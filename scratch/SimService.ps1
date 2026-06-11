try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}
$OutputEncoding = [System.Text.Encoding]::UTF8

# SimService.ps1 - Servidor backend simulado para pruebas completas de BizGuard

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

# Helper centralizado para enviar respuestas HTML controlando peticiones HEAD
function Send-HtmlResponse($res, $req, $html, $statusCode = 200) {
    $res.StatusCode = $statusCode
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($html)
    $res.ContentLength64 = $buffer.Length
    $res.ContentType = "text/html; charset=utf-8"
    
    # En peticiones HEAD no se debe escribir contenido en el cuerpo, solo los encabezados
    if ($req.HttpMethod -ne "HEAD") {
        $res.OutputStream.Write($buffer, 0, $buffer.Length)
    }
}

$port = Get-FreePort
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Prefixes.Add("http://localhost:$port/")

$started = $false
try {
    $listener.Start()
    $started = $true
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "  SimService Levantado en Puerto: $port" -ForegroundColor Green
    Write-Host "  URL: http://localhost:$port/" -ForegroundColor White
    Write-Host "  Use esta URL como 'URL Interna' en BizGuard para probar:" -ForegroundColor Gray
    Write-Host "  * NOTA: Las funciones se habilitaran tras hacer un falso login." -ForegroundColor Yellow
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

            # Verificar si existe cookie de sesión activa
            $hasSession = $false
            $cookieHeader = $req.Headers.Get("Cookie")
            if ($cookieHeader -and $cookieHeader -match "SessionToken=AD_User_Mock_Session") {
                $hasSession = $true
            }

            Write-Host "[SimService] [$($req.HttpMethod)] (Sesion=$hasSession) $path$query" -ForegroundColor Gray

            # 1. Login POST (Acepta cualquier dato ficticio y redirige a /)
            if ($path -eq "/signin" -and $req.HttpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($req.InputStream)
                $body = $reader.ReadToEnd()
                Write-Host "[SimService] Falso Login Recibido (Datos ficticios aceptados): $body" -ForegroundColor White

                # Establecer cookie de sesión activa en la respuesta
                $res.Headers.Add("Set-Cookie", "SessionToken=AD_User_Mock_Session_67890; Path=/; HttpOnly")
                $res.StatusCode = 302
                $res.Headers.Add("Location", "/")
                $res.Close()
                continue
            }

            # 2. Logout (Elimina cookie y redirige)
            if ($path -eq "/logout") {
                Write-Host "[SimService] Cerrando sesion..." -ForegroundColor White
                # Expirar cookie en el cliente
                $res.Headers.Add("Set-Cookie", "SessionToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly")
                $res.StatusCode = 302
                $res.Headers.Add("Location", "/")
                $res.Close()
                continue
            }

            # 3. Validar Sesión para funciones protegidas (Excluir favicon, inicio y ruta de autenticación /signin)
            if (-not $hasSession -and $path -ne "/" -and $path -ne "/favicon.ico" -and $path -ne "/signin") {
                Write-Host "[SimService] Intento de acceso sin sesion a $path. Redirigiendo a Login..." -ForegroundColor DarkYellow
                $res.StatusCode = 302
                $res.Headers.Add("Location", "/")
                $res.Close()
                continue
            }

            # Evitar logs ruidosos para favicon en redirecciones
            if ($path -eq "/favicon.ico") {
                $res.StatusCode = 404
                $res.Close()
                continue
            }

            # 4. Simulación de Espera (Heartbeat testing - PROTEGIDO)
            if ($path -eq "/wait") {
                $seconds = 20
                if ($query -match "seconds=(\d+)") {
                    $seconds = [int]$Matches[1]
                }
                Write-Host "[SimService] [SESION OK] Simulando retardo de $seconds segundos..." -ForegroundColor Yellow
                Start-Sleep -Seconds $seconds
                
                $html = @"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Espera Finalizada</title>
    <style>
        body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 50px; text-align: center; }
        .card { background: #1e293b; padding: 30px; border-radius: 12px; display: inline-block; border: 1px solid #334155; }
        h1 { color: #f43f5e; }
        a { color: #38bdf8; text-decoration: none; font-weight: bold; }
    </style>
</head>
<body>
    <div class="card">
        <h1>⏱ Espera de $seconds Segundos Completada</h1>
        <p>Esta respuesta demorada sirve para verificar que el <strong>Heartbeat Shield</strong> o el keepalive mantuvieron viva la conexi&oacute;n sin lanzar CF 524.</p>
        <br>
        <a href="/">← Volver al inicio</a>
    </div>
</body>
</html>
"@
                Send-HtmlResponse -res $res -req $req -html $html
            }
            # 5. Subida de Archivos Lenta (PROTEGIDO)
            elseif ($path -eq "/upload" -and $req.HttpMethod -eq "POST") {
                Write-Host "[SimService] [SESION OK] Procesando subida de archivo lenta (15s)..." -ForegroundColor Cyan
                
                # Consumir el stream del archivo
                $reader = New-Object System.IO.StreamReader($req.InputStream)
                $chunk = $reader.ReadLine()
                Start-Sleep -Seconds 15
                
                $html = @"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Subida Completada</title>
    <style>
        body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 50px; text-align: center; }
        .card { background: #1e293b; padding: 30px; border-radius: 12px; display: inline-block; border: 1px solid #334155; }
        h1 { color: #10b981; }
        a { color: #38bdf8; text-decoration: none; font-weight: bold; }
    </style>
</head>
<body>
    <div class="card">
        <h1>📤 Carga y Procesamiento de Archivo Completado</h1>
        <p>Se emul&oacute; la carga de datos del cliente y una espera de procesamiento de 15 segundos en el backend.</p>
        <p>Verifica los bytes transferidos en los logs de tr&aacute;fico.</p>
        <br>
        <a href="/">← Volver al inicio</a>
    </div>
</body>
</html>
"@
                Send-HtmlResponse -res $res -req $req -html $html
            }
            # 6. Prueba de AJAX Lento (PROTEGIDO)
            elseif ($path -eq "/api/slow-json") {
                $mode = "Desconocido"
                if ($query -match "mode=([^&]+)") {
                    $mode = [System.Uri]::UnescapeDataString($Matches[1])
                }
                Write-Host "[SimService] [SESION OK] Procesando peticion AJAX Lenta (15s) | Modo Test: $mode..." -ForegroundColor Magenta
                Start-Sleep -Seconds 15
                
                $res.StatusCode = 200
                $res.ContentType = "application/json; charset=utf-8"
                $json = '{"status":"success","message":"Peticion AJAX lenta procesada con exito tras 15 segundos","mode":"' + $mode + '","ts":"' + (Get-Date -Format "o") + '"}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
                $res.ContentLength64 = $buffer.Length
                if ($req.HttpMethod -ne "HEAD") {
                    $res.OutputStream.Write($buffer, 0, $buffer.Length)
                }
            }
            # 7. Descarga PDF Lenta (PROTEGIDO)
            elseif ($path -eq "/download-slow") {
                Write-Host "[SimService] [SESION OK] Generando PDF de prueba lento (15s)..." -ForegroundColor Cyan
                Start-Sleep -Seconds 15
                $res.StatusCode = 200
                $res.ContentType = "application/pdf"
                $res.Headers.Add("Content-Disposition", "attachment; filename=`"reporte-bizguard.pdf`"")
                
                # Buffer PDF falso minimalista pero válido
                $pdfContent = "%PDF-1.4`n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj`n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj`n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj`n4 0 obj<</Length 44>>stream`nBT /F1 24 Tf 100 700 Td (BizGuard Test PDF Report) Tj ET`nendstream`nendobj`nxref`n0 5`n0000000000 65535 f`n0000000009 00000 n`n0000000056 00000 n`n0000000111 00000 n`n0000000212 00000 n`ntrailer<</Size 5/Root 1 0 R>>`nstartxref`n307`n%%EOF"
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($pdfContent)
                $res.ContentLength64 = $buffer.Length
                if ($req.HttpMethod -ne "HEAD") {
                    $res.OutputStream.Write($buffer, 0, $buffer.Length)
                }
            }
            # 8. Redirección 302 Lenta (PROTEGIDO)
            elseif ($path -eq "/slow-redirect") {
                Write-Host "[SimService] [SESION OK] Procesando redirección lenta (15s)..." -ForegroundColor Green
                Start-Sleep -Seconds 15
                $res.StatusCode = 302
                $res.Headers.Add("Location", "/")
            }
            # 9. Ruta Raíz / (Renderiza Login o Dashboard)
            elseif ($path -eq "/") {
                if (-not $hasSession) {
                    # renderizar FORMULARIO DE LOGIN ficticio
                    $html = @"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>BizGuard Simulation - Login Requerido</title>
    <style>
        body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 50px; text-align: center; }
        .card { background: #1e293b; padding: 35px; border-radius: 12px; display: inline-block; border: 1px solid #334155; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); }
        h1 { color: #38bdf8; margin-top: 0; }
        p { color: #94a3b8; font-size: 0.9rem; }
        input { width: 100%; max-width: 250px; padding: 10px; margin: 8px 0; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; box-sizing: border-box; }
        button { width: 100%; max-width: 250px; padding: 10px; background: #38bdf8; color: #0f172a; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 10px; }
        button:hover { background: #0ea5e9; }
    </style>
</head>
<body>
    <div class="card">
        <h1>SimService - Login Requerido</h1>
        <p>Inicia sesi&oacute;n con cualquier dato ficticio para desbloquear las funciones de testeo.</p>
        <form method="POST" action="/signin">
            <input type="text" name="user" placeholder="Usuario ficticio" required><br>
            <input type="password" name="password" placeholder="Contrase&ntilde;a ficticia" required><br>
            <button type="submit">Iniciar Sesión de Prueba</button>
        </form>
    </div>
</body>
</html>
"@
                    Send-HtmlResponse -res $res -req $req -html $html
                } else {
                    # renderizar DASHBOARD CON FUNCIONES DE TEST
                    $html = @"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>BizGuard Simulation Service</title>
    <style>
        body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid #334155; padding-bottom: 15px; }
        .card { background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 25px; }
        h1 { color: #38bdf8; margin: 0; }
        h2 { color: #e2e8f0; font-size: 1.25rem; margin-top: 0; }
        p { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; }
        input { width: 100%; max-width: 300px; padding: 10px; margin: 8px 0; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; box-sizing: border-box; }
        button, .btn { display: inline-block; padding: 10px 20px; background: #38bdf8; color: #0f172a; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; text-decoration: none; font-size: 0.9rem; margin-top: 5px; }
        button:hover, .btn:hover { background: #0ea5e9; }
        .grid { display: grid; grid-template-cols: 1fr; gap: 20px; }
        @media(min-width: 600px) { .grid { grid-template-cols: 1fr 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header-bar">
            <div>
                <h1>BizGuard SimService</h1>
                <p style="margin: 5px 0 0 0;">Panel de Pruebas Protegido (Sesi&oacute;n Activa)</p>
            </div>
            <a href="/logout" class="btn" style="background: #ef4444; color: #fff; padding: 8px 15px; font-size: 0.8rem;">Cerrar Sesi&oacute;n</a>
        </div>

        <div class="grid">
            <!-- Test 1: Heartbeat Shield -->
            <div class="card">
                <h2>1. Simulaci&oacute;n de Heartbeat (Espera HTML)</h2>
                <p>Hace una petici&oacute;n que tarda <strong>12 segundos</strong> en responder. Muestra el spinner y valida que el Heartbeat Shield mantenga la conexi&oacute;n.</p>
                <div style="margin-top: 15px;">
                    <a href="/wait?seconds=12" class="btn" style="background: #f43f5e; color: #fff;">Iniciar Espera de 12s</a>
                </div>
            </div>

            <!-- Test 2: Upload de Archivos Lento -->
            <div class="card">
                <h2>2. Carga de Archivos Lenta (15s)</h2>
                <p>Sube un archivo y simula un procesamiento lento de <strong>15 segundos</strong> para disparar el Heartbeat Shield durante un POST/Upload.</p>
                <form method="POST" action="/upload" enctype="multipart/form-data">
                    <input type="file" name="testfile" required><br>
                    <button type="submit" style="background: #10b981; color: #fff;">Subir y Procesar (15s)</button>
                </form>
            </div>
        </div>

        <div class="grid" style="margin-top: 20px;">
            <!-- Test 3: AJAX Lento con 3 Métodos de Detección -->
            <div class="card">
                <h2>3. Petici&oacute;n AJAX / XHR Lenta (15s)</h2>
                <p>Ejecuta una petici&oacute;n de API que toma 15 segundos. Selecciona uno de los 3 m&eacute;todos de detecci&oacute;n robusta implementados en BizGuard:</p>
                <div style="margin-top: 15px; display: flex; gap: 8px; flex-wrap: wrap;">
                    <button onclick="testAjax('X-Requested-With')" class="btn" style="background: #a855f7; color: #fff; font-size: 0.8rem; padding: 8px 14px;">1. X-Requested-With</button>
                    <button onclick="testAjax('Sec-Fetch-Mode')" class="btn" style="background: #8b5cf6; color: #fff; font-size: 0.8rem; padding: 8px 14px;">2. Sec-Fetch-Mode (Fetch estándar)</button>
                    <button onclick="testAjax('Accept-Header')" class="btn" style="background: #7c3aed; color: #fff; font-size: 0.8rem; padding: 8px 14px;">3. Accept Header (JSON)</button>
                </div>
                <div id="ajaxResult" style="margin-top: 12px; font-family: monospace; font-size: 0.8rem; color: #a7f3d0; white-space: pre-wrap;"></div>
            </div>

            <!-- Test 4: Descarga PDF Lenta -->
            <div class="card">
                <h2>4. Generaci&oacute;n y Descarga de PDF Lenta (15s)</h2>
                <p>Genera un archivo PDF con un retraso de 15 segundos en el backend, testeando el buffering de binarios y la descarga limpia v&iacute;a Blob.</p>
                <div style="margin-top: 15px;">
                    <a href="/download-slow" class="btn" style="background: #06b6d4; color: #fff;">Descargar PDF (15s)</a>
                </div>
            </div>
        </div>

        <div class="grid" style="margin-top: 20px;">
            <!-- Test 5: Redirección Lenta -->
            <div class="card">
                <h2>5. Redirecci&oacute;n HTTP 302 Lenta (15s)</h2>
                <p>Procesa una solicitud durante 15 segundos y finaliza con un redireccionamiento HTTP 302 que BizGuard debe forzar por JS.</p>
                <div style="margin-top: 15px;">
                    <a href="/slow-redirect" class="btn" style="background: #eab308; color: #0f172a;">Ejecutar Redirecci&oacute;n 302</a>
                </div>
            </div>

            <!-- Test 6: Diagnóstico Activo -->
            <div class="card border-dashed">
                <h2>6. Diagn&oacute;stico Activo</h2>
                <p>Navega a rutas inexistentes para verificar el logueo de errores 404 en la base de datos de telemetr&iacute;a de BizGuard.</p>
                <div style="margin-top: 15px;">
                    <a href="/ruta-inexistente" class="btn" style="background: #64748b; color: #fff; font-size: 0.8rem; padding: 6px 12px;">Forzar Error 404</a>
                </div>
            </div>
        </div>

        <script>
            function testAjax(mode) {
                var resDiv = document.getElementById('ajaxResult');
                resDiv.textContent = '\u23f1 Ejecutando petici\u00f3n AJAX lenta (Modo: ' + mode + ') - esperando 15s...';
                
                var headers = {};
                if (mode === 'X-Requested-With') {
                    headers['X-Requested-With'] = 'XMLHttpRequest';
                } else if (mode === 'Accept-Header') {
                    headers['Accept'] = 'application/json';
                }
                
                fetch('/api/slow-json?mode=' + encodeURIComponent(mode), {
                    headers: headers
                })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        resDiv.textContent = '\u2705 Respuesta Recibida (' + mode + '):\\n' + JSON.stringify(data, null, 2);
                    })
                    .catch(function(err) {
                        resDiv.textContent = '\u274c Error (' + mode + '): ' + err.message;
                    });
            }
        </script>
    </div>
</body>
</html>
"@
                    Send-HtmlResponse -res $res -req $req -html $html
                }
            } else {
                # 404 genérico para el resto de rutas
                $html = "Ruta de prueba no encontrada"
                Send-HtmlResponse -res $res -req $req -html $html -statusCode 404
            }
            $res.Close()
        }
        catch {
            Write-Host "[SimService] Error procesando petici&oacute;n individual: $_" -ForegroundColor DarkYellow
            if ($context -ne $null) {
                try { $context.Response.Close() } catch {}
            }
        }
    }
}
catch {
    Write-Error $_.Exception.Message
}
finally {
    if ($listener -ne $null -and $started) {
        try {
            $listener.Stop()
            $listener.Close()
        } catch {}
    }
}
