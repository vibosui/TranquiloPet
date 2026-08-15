$ErrorActionPreference = 'Stop'

$requiredCommands = @('git', 'node', 'npm', 'python')
$optionalCommands = @('java', 'adb', 'docker')
$results = @()
$missingRequired = @()

foreach ($commandName in $requiredCommands + $optionalCommands) {
  $command = Get-Command $commandName -ErrorAction SilentlyContinue
  $isRequired = $requiredCommands -contains $commandName

  if ($commandName -eq 'python') {
    $pythonInstallRoot = Join-Path $env:LOCALAPPDATA 'Programs\Python'
    $pythonExecutable = Get-ChildItem -Path $pythonInstallRoot -Filter 'python.exe' -File -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($null -ne $pythonExecutable) {
      $command = Get-Command $pythonExecutable.FullName
    }
  }

  if ($null -eq $command) {
    $results += [PSCustomObject]@{
      Ferramenta = $commandName
      ObrigatoriaAgora = $isRequired
      Estado = 'nao encontrada'
    }

    if ($isRequired) {
      $missingRequired += $commandName
    }

    continue
  }

  $version = if ($commandName -eq 'java') {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $javaVersionOutput = & $command.Source -version 2>&1
    $ErrorActionPreference = $previousErrorActionPreference
    ($javaVersionOutput | Select-Object -First 1) -replace '^.*?version\s+', ''
  } else {
    & $command.Source --version 2>&1 | Select-Object -First 1
  }

  $results += [PSCustomObject]@{
    Ferramenta = $commandName
    ObrigatoriaAgora = $isRequired
    Estado = $version
  }
}

$results | Format-Table -AutoSize

if ($missingRequired.Count -gt 0) {
  Write-Error "Instale as ferramentas obrigatorias: $($missingRequired -join ', ')."
  exit 1
}

Write-Output 'Ambiente minimo pronto para executar o app Expo e o monitor local.'
