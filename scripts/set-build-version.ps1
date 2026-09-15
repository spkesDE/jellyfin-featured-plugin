param(
    [Parameter(Mandatory = $true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

if ($Version -notmatch '^\d+\.\d+\.\d+\.\d+$') {
    throw "Version must contain four numeric parts: $Version"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$projectPath = Join-Path $repoRoot "Jellyfin.Plugin.Featured/Jellyfin.Plugin.Featured.csproj"
$syncFrontendVersionScript = Join-Path $repoRoot "scripts/sync-frontend-version.mjs"

[xml]$project = Get-Content -LiteralPath $projectPath
$propertyGroup = $project.Project.PropertyGroup | Select-Object -First 1

foreach ($propertyName in @("Version", "AssemblyVersion", "FileVersion")) {
    if ($null -eq $propertyGroup.$propertyName) {
        throw "Project property '$propertyName' was not found in $projectPath"
    }

    $propertyGroup.$propertyName = $Version
}

$settings = New-Object System.Xml.XmlWriterSettings
$settings.Indent = $true
$settings.OmitXmlDeclaration = $true
$settings.Encoding = New-Object System.Text.UTF8Encoding($false)
$writer = [System.Xml.XmlWriter]::Create($projectPath, $settings)
try {
    $project.Save($writer)
} finally {
    $writer.Dispose()
}

& node $syncFrontendVersionScript $Version
if ($LASTEXITCODE -ne 0) {
    throw "Failed to synchronize the frontend version to $Version."
}

Write-Host "Build version set to $Version."
