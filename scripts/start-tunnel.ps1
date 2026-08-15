$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$monitorRoot = Join-Path $repositoryRoot 'tools\dev-monitor'
$monitorExecutable = Join-Path $monitorRoot '.venv\Scripts\tranquilo-pet-monitor.exe'
$mobileEnvPath = Join-Path $repositoryRoot 'apps\mobile\.env.local'
$monitorProcess = $null
$ngrokProcess = $null

function Wait-Until {
  param(
    [Parameter(Mandatory = $true)][scriptblock]$Condition,
    [int]$Attempts = 30,
    [int]$DelayMilliseconds = 500
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
      if (& $Condition) {
        return $true
      }
    } catch {
      # O servico pode ainda estar inicializando.
    }

    Start-Sleep -Milliseconds $DelayMilliseconds
  }

  return $false
}

$ngrokCommand = Get-Command ngrok -ErrorAction SilentlyContinue
if ($null -eq $ngrokCommand) {
  throw 'ngrok CLI nao encontrado. Instale e autentique o ngrok antes de executar npm.cmd run dev:tunnel.'
}

$expoNgrokInstalled = $false
try {
  $globalExpoNgrok = & npm.cmd list -g @expo/ngrok --depth=0 2>$null
  $expoNgrokInstalled = ($LASTEXITCODE -eq 0) -and (($globalExpoNgrok -join "`n") -match '@expo/ngrok@')
} catch {
  $expoNgrokInstalled = $false
}

if (-not $expoNgrokInstalled) {
  throw 'O tunnel do Expo precisa de @expo/ngrok global. Execute: npm.cmd install -g @expo/ngrok'
}

if (-not (Test-Path -LiteralPath $monitorExecutable)) {
  throw 'Monitor nao instalado. Siga a secao "Preparar o projeto" do README.md.'
}

try {
  Write-Host '[Tranquilo Pet] Iniciando monitor local na porta 8000...'
  $monitorProcess = Start-Process `
    -FilePath $monitorExecutable `
    -WorkingDirectory $monitorRoot `
    -PassThru `
    -WindowStyle Hidden

  $monitorReady = Wait-Until -Condition {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/api/health' -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  }

  if (-not $monitorReady) {
    throw 'O monitor nao respondeu em http://127.0.0.1:8000/api/health.'
  }

  Write-Host '[Tranquilo Pet] Abrindo tunel HTTPS do monitor com ngrok...'
  $ngrokProcess = Start-Process `
    -FilePath $ngrokCommand.Source `
    -ArgumentList @('http', '8000') `
    -PassThru `
    -WindowStyle Hidden

  $ngrokReady = Wait-Until -Condition {
    $response = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 2
    return $null -ne ($response.tunnels | Where-Object { $_.public_url -like 'https://*' } | Select-Object -First 1)
  }

  if (-not $ngrokReady) {
    throw 'O ngrok nao publicou o monitor. Confira a autenticacao com ngrok config check e tente novamente.'
  }

  $tunnels = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 2
  $publicUrl = ($tunnels.tunnels | Where-Object { $_.public_url -like 'https://*' } | Select-Object -First 1).public_url.TrimEnd('/')

  $existingLines = @()
  if (Test-Path -LiteralPath $mobileEnvPath) {
    $existingLines = Get-Content -LiteralPath $mobileEnvPath | Where-Object {
      $_ -notmatch '^EXPO_PUBLIC_MONITOR_API_URL='
    }
  }

  $newLines = @("EXPO_PUBLIC_MONITOR_API_URL=$publicUrl") + $existingLines
  Set-Content -LiteralPath $mobileEnvPath -Value $newLines -Encoding utf8

  Write-Host "[Tranquilo Pet] Monitor publico: $publicUrl"
  Write-Host "[Tranquilo Pet] Health check: $publicUrl/api/health"
  Write-Host '[Tranquilo Pet] .env.local atualizado automaticamente.'
  Write-Host '[Tranquilo Pet] Iniciando Expo pelo tunnel...'
  Write-Host ''

  Push-Location $repositoryRoot
  try {
    & npm.cmd run start:tunnel
    exit $LASTEXITCODE
  } finally {
    Pop-Location
  }
} finally {
  if ($null -ne $ngrokProcess -and -not $ngrokProcess.HasExited) {
    Stop-Process -Id $ngrokProcess.Id -Force -ErrorAction SilentlyContinue
  }

  if ($null -ne $monitorProcess -and -not $monitorProcess.HasExited) {
    Stop-Process -Id $monitorProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
