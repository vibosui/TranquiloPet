$ErrorActionPreference = 'Stop'

$requiredCommands = @('git', 'node', 'npm')
$optionalCommands = @('java', 'adb', 'docker')
$results = @()
$missingRequired = @()

foreach ($commandName in $requiredCommands + $optionalCommands) {
  $command = Get-Command $commandName -ErrorAction SilentlyContinue
  $isRequired = $requiredCommands -contains $commandName

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
    & $commandName --version 2>&1 | Select-Object -First 1
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

Write-Output 'Ambiente minimo pronto para criar e executar o app Expo.'
