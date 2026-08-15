$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$monitorRoot = Join-Path $repositoryRoot 'tools\dev-monitor'
$monitorExecutable = Join-Path $monitorRoot '.venv\Scripts\tranquilo-pet-monitor.exe'

if (-not (Test-Path -LiteralPath $monitorExecutable)) {
  throw 'Monitor nao instalado. Siga a secao "Preparar o monitor uma vez" do README.md.'
}

Push-Location $monitorRoot
try {
  & $monitorExecutable
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
