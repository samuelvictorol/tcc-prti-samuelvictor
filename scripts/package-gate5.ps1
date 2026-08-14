[CmdletBinding()]
param(
  [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$')]
  [string]$OutputName = 'notify-flow-gate5'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$packageRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot '.gate5-package'))
$stagingRoot = [System.IO.Path]::GetFullPath((Join-Path $packageRoot 'staging'))
$stagingProject = [System.IO.Path]::GetFullPath((Join-Path $stagingRoot $OutputName))
$zipPath = [System.IO.Path]::GetFullPath((Join-Path $packageRoot ($OutputName + '.zip')))
$manifestName = 'MANIFEST-SHA256.txt'

function Get-SafeRelativePath {
  param(
    [Parameter(Mandatory)][string]$BasePath,
    [Parameter(Mandatory)][string]$TargetPath
  )

  $baseFullPath = [System.IO.Path]::GetFullPath($BasePath).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  $targetFullPath = [System.IO.Path]::GetFullPath($TargetPath)
  $baseUri = [Uri]::new($baseFullPath)
  $targetUri = [Uri]::new($targetFullPath)
  if ($baseUri.Scheme -ne $targetUri.Scheme) {
    throw "Nao foi possivel criar caminho relativo entre $baseFullPath e $targetFullPath"
  }
  return [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
}

function Assert-InPackageRoot {
  param([Parameter(Mandatory)][string]$Path)

  $candidate = [System.IO.Path]::GetFullPath($Path)
  $prefix = $packageRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  if ($candidate -ne $packageRoot -and -not $candidate.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Operacao recusada fora de .gate5-package: $candidate"
  }
  return $candidate
}

function Remove-PackagePath {
  param([Parameter(Mandatory)][string]$Path)

  $safePath = Assert-InPackageRoot -Path $Path
  if (Test-Path -LiteralPath $safePath) {
    Remove-Item -LiteralPath $safePath -Recurse -Force
  }
}

function Test-ExcludedDirectory {
  param([Parameter(Mandatory)][string]$RelativePath)

  $segments = $RelativePath -split '[\\/]'
  foreach ($segment in $segments) {
    if ($segment -in @(
      '.git', '.gate5-package', '.codex-tmp', '.docker-validation-config',
      'node_modules', 'dist', 'coverage', 'test-results', '.nyc_output',
      '.cache', '.npm', '.vite', '__pycache__', '.pytest_cache',
      '.wwebjs_auth', '.wwebjs_cache'
    )) { return $true }
    if ($segment -like '.codex*') { return $true }
  }
  return $false
}

function Test-ExcludedFile {
  param(
    [Parameter(Mandatory)][System.IO.FileInfo]$File,
    [Parameter(Mandatory)][string]$RelativePath
  )

  if (Test-ExcludedDirectory -RelativePath $RelativePath) { return $true }

  $name = $File.Name
  $safeEnvironmentExample = $name -match '(?i)\.env\.example$' -or $name -ieq '.env.example'
  if (-not $safeEnvironmentExample -and $name -match '(?i)(^\.env($|\.)|\.env($|\.))') { return $true }
  if ($name -match '(?i)\.(log|tmp|temp|bak|swp)$') { return $true }
  if ($name -in @('.DS_Store', 'Thumbs.db')) { return $true }
  return $false
}

function Copy-SanitizedRepository {
  $rootDirectory = Get-Item -LiteralPath $repositoryRoot -Force
  $pending = [System.Collections.Generic.Stack[System.IO.DirectoryInfo]]::new()
  $pending.Push($rootDirectory)

  while ($pending.Count -gt 0) {
    $directory = $pending.Pop()
    foreach ($item in Get-ChildItem -LiteralPath $directory.FullName -Force) {
      $relativePath = Get-SafeRelativePath -BasePath $repositoryRoot -TargetPath $item.FullName

      if ($item.PSIsContainer) {
        if (Test-ExcludedDirectory -RelativePath $relativePath) { continue }
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
          Write-Warning "Diretorio reparse ignorado por seguranca: $relativePath"
          continue
        }
        $pending.Push([System.IO.DirectoryInfo]$item)
        continue
      }

      if (Test-ExcludedFile -File ([System.IO.FileInfo]$item) -RelativePath $relativePath) { continue }

      $destination = Join-Path $stagingProject $relativePath
      $destinationDirectory = Split-Path -Parent $destination
      if (-not (Test-Path -LiteralPath $destinationDirectory)) {
        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
      }
      Copy-Item -LiteralPath $item.FullName -Destination $destination -Force
    }
  }
}

function Assert-SanitizedStaging {
  $violations = [System.Collections.Generic.List[string]]::new()
  $textExtensions = @(
    '.js', '.mjs', '.cjs', '.ts', '.vue', '.json', '.md', '.txt', '.yml', '.yaml',
    '.ps1', '.sh', '.html', '.css', '.scss', '.sass', '.xml', '.conf', '.example'
  )
  $secretPatterns = [ordered]@{
    'chave privada' = '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'
    'token Telegram' = '(?<![A-Za-z0-9])\d{6,12}:[A-Za-z0-9_-]{30,}'
    'token Meta longo' = '(?<![A-Za-z0-9])EA[A-Za-z0-9]{80,}'
    'URI com credencial' = '(?i)(?:mongodb(?:\+srv)?|redis|postgres(?:ql)?|mysql):\/\/[^\s\/:@]+:[^\s\/@]+@'
  }

  foreach ($item in Get-ChildItem -LiteralPath $stagingProject -Recurse -Force) {
    $relativePath = Get-SafeRelativePath -BasePath $stagingProject -TargetPath $item.FullName
    if ($item.PSIsContainer) {
      if (Test-ExcludedDirectory -RelativePath $relativePath) {
        $violations.Add("diretorio excluido presente: $relativePath")
      }
      continue
    }

    if (Test-ExcludedFile -File ([System.IO.FileInfo]$item) -RelativePath $relativePath) {
      $violations.Add("arquivo excluido presente: $relativePath")
      continue
    }

    $extension = $item.Extension.ToLowerInvariant()
    if ($textExtensions -notcontains $extension -and $item.Name -notin @('.gitignore', '.dockerignore')) { continue }
    if ($item.Length -gt 5MB) { continue }

    $content = [System.IO.File]::ReadAllText($item.FullName)
    foreach ($entry in $secretPatterns.GetEnumerator()) {
      $matches = [regex]::Matches($content, $entry.Value)
      foreach ($match in $matches) {
        $candidate = $match.Value
        if ($entry.Key -eq 'token Telegram' -and $candidate -eq '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcd') {
          continue
        }
        if ($entry.Key -eq 'URI com credencial' -and $candidate -match '(?i)(USUARIO|SENHA|USER|PASSWORD|HOST|CLUSTER|SEU_|EXAMPLE|PLACEHOLDER|REPLACE)') {
          continue
        }
        $violations.Add("possivel $($entry.Key) em $relativePath")
      }
    }
  }

  if ($violations.Count -gt 0) {
    $preview = ($violations | Select-Object -Unique | Select-Object -First 20) -join [Environment]::NewLine
    throw "Empacotamento interrompido por verificacoes de seguranca:`n$preview"
  }
}

function Write-Sha256Manifest {
  $manifestPath = Join-Path $stagingProject $manifestName
  $files = Get-ChildItem -LiteralPath $stagingProject -Recurse -File -Force |
    Where-Object { $_.FullName -ne $manifestPath } |
    Sort-Object { Get-SafeRelativePath -BasePath $stagingProject -TargetPath $_.FullName }

  $lines = [System.Collections.Generic.List[string]]::new()
  $lines.Add('# Notify Flow - Gate 5')
  $lines.Add('# Gerado em UTC: ' + [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))
  $lines.Add('# SHA-256  caminho relativo')
  foreach ($file in $files) {
    $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $relativePath = (Get-SafeRelativePath -BasePath $stagingProject -TargetPath $file.FullName).Replace('\', '/')
    $lines.Add("$hash *$relativePath")
  }
  [System.IO.File]::WriteAllLines($manifestPath, $lines, [System.Text.UTF8Encoding]::new($false))
  return $manifestPath
}

function New-Gate5Archive {
  param(
    [Parameter(Mandatory)][string]$SourceDirectory,
    [Parameter(Mandatory)][string]$DestinationZip
  )

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::Open($DestinationZip, [System.IO.Compression.ZipArchiveMode]::Create)
  $baseName = Split-Path -Leaf $SourceDirectory
  try {
    foreach ($file in Get-ChildItem -LiteralPath $SourceDirectory -Recurse -File -Force) {
      $relativePath = (Get-SafeRelativePath -BasePath $SourceDirectory -TargetPath $file.FullName).Replace('\', '/')
      $entryName = $baseName + '/' + $relativePath
      $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
      $sourceStream = [System.IO.File]::OpenRead($file.FullName)
      $destinationStream = $entry.Open()
      try {
        $sourceStream.CopyTo($destinationStream)
      } finally {
        $destinationStream.Dispose()
        $sourceStream.Dispose()
      }
    }
  } finally {
    $archive.Dispose()
  }
}

if (-not (Test-Path -LiteralPath $repositoryRoot -PathType Container)) {
  throw "Raiz do repositorio nao encontrada: $repositoryRoot"
}

Remove-PackagePath -Path $packageRoot
New-Item -ItemType Directory -Path $stagingProject -Force | Out-Null

Write-Host 'Copiando repositorio com filtros de seguranca...'
Copy-SanitizedRepository
Assert-SanitizedStaging
$manifestPath = Write-Sha256Manifest

if (Test-Path -LiteralPath $zipPath) { Remove-PackagePath -Path $zipPath }
New-Gate5Archive -SourceDirectory $stagingProject -DestinationZip $zipPath

$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
$fileCount = (Get-ChildItem -LiteralPath $stagingProject -Recurse -File -Force).Count

Write-Host ''
Write-Host 'Pacote Gate 5 criado com sucesso.' -ForegroundColor Green
Write-Host "Staging: $stagingProject"
Write-Host "Manifesto: $manifestPath"
Write-Host "ZIP: $zipPath"
Write-Host "Arquivos: $fileCount"
Write-Host "SHA-256 do ZIP: $zipHash"
