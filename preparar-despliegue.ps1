# Script de Preparacion de Paquete Offline (Power-Pack BizGuard ENTERPRISE)
# Correr en Windows PowerShell

$dist = "BizGuard"
$version = "v1.2.2-Enterprise"

Write-Host "------------------------------------"
Write-Host "INICIANDO EMPAQUETADO BIZGUARD $version"
Write-Host "------------------------------------"

# 0. Limpieza y Compilación Fresca
Write-Host "[1/6] Limpiando directorios previos..."
if (Test-Path $dist) { 
    Remove-Item -Path $dist -Recurse -Force -ErrorAction SilentlyContinue
}
if (Test-Path ".next") {
    Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "[2/6] Compilando aplicacion Next.js (npm run build)..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR CRITICO: La compilacion fallo. Abortando." -ForegroundColor Red
    exit $LASTEXITCODE
}

New-Item -ItemType Directory -Path $dist

# 1. Copia de Standalone
Write-Host "[3/6] Copiando binarios y dependencias (Standalone)..."
if (Test-Path ".next/standalone") {
    robocopy .next\standalone $dist /E /NFL /NDL /NJH /NJS /nc /ns /np
}

# 2. Copia de Recursos Estáticos
Write-Host "[4/6] Copiando activos estaticos y publicos..."
if (-not (Test-Path "$dist/.next/static")) { 
    New-Item -ItemType Directory -Path "$dist/.next/static" -Force 
}
if (Test-Path ".next/static") {
    robocopy .next\static "$dist\.next\static" /E /NFL /NDL /NJH /NJS /nc /ns /np
}

if (Test-Path "public") {
    robocopy public "$dist\public" /E /NFL /NDL /NJH /NJS /nc /ns /np
}

# 3. Sincronización de Datos y Configuración
Write-Host "[5/6] Sincronizando bases de datos y .env..."
if (Test-Path "data") {
    robocopy data "$dist\data" /E /NFL /NDL /NJH /NJS /nc /ns /np
}

if (Test-Path ".env.local") {
    Copy-Item -Path ".env.local" -Destination "$dist/.env" -Force
}

# 4. ENTREGA ENTERPRISE: Documentación y SQL
Write-Host "[6/6] Incluyendo documentacion Enterprise (context/sql)..."
if (Test-Path "context") {
    robocopy context "$dist\context" /E /NFL /NDL /NJH /NJS /nc /ns /np
}
if (Test-Path "sql") {
    robocopy sql "$dist\sql" /E /NFL /NDL /NJH /NJS /nc /ns /np
}
if (Test-Path "Docs") {
    robocopy Docs "$dist\Docs" /E /NFL /NDL /NJH /NJS /nc /ns /np
}

# 5. Verificacion Final
if (Test-Path "$dist/server.js") {
    Write-Host "------------------------------------"
    Write-Host "PAQUETE ENTERPRISE CREADO EXITOSAMENTE."
    Write-Host "Ubicacion: $PWD\$dist"
    Write-Host "Version: $version"
    Write-Host "Ejecuta: node server.js"
    Write-Host "------------------------------------"
} else {
    Write-Host "ERROR: No se encontro server.js. Verifica el build." -ForegroundColor Red
}
