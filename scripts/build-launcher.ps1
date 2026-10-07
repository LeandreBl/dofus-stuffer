# Rebuild the Windows launcher using the .NET Framework compiler already on Windows.
# No package download, Node.js, Python or separate .NET SDK is required.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$sourceFile = Join-Path $projectDirectory 'launcher\Program.cs'
$manifestFile = Join-Path $projectDirectory 'launcher\app.manifest'
$outputFile = Join-Path $projectDirectory 'DofusStuffer.exe'
$compilerCandidates = @(
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
)
$compiler = $compilerCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1

if (-not $compiler) {
    throw 'Compilateur .NET Framework 4 introuvable. Activez .NET Framework 4.x dans Windows pour reconstruire le lanceur.'
}

foreach ($inputFile in @($sourceFile, $manifestFile)) {
    if (-not (Test-Path -LiteralPath $inputFile -PathType Leaf)) {
        throw "Fichier source introuvable : $inputFile"
    }
}

$compilerArguments = @(
    '/nologo',
    '/target:winexe',
    '/platform:anycpu',
    '/optimize+',
    '/checked+',
    '/warnaserror+',
    '/utf8output',
    '/reference:System.dll',
    '/reference:System.Drawing.dll',
    '/reference:System.Windows.Forms.dll',
    "/win32manifest:$manifestFile",
    "/out:$outputFile",
    $sourceFile
)

& $compiler @compilerArguments
if ($LASTEXITCODE -ne 0) {
    throw "La compilation a echoue (code $LASTEXITCODE)."
}

Write-Output "Lanceur reconstruit : $outputFile"
