param(
    [string]$Configuration = "Release",
    [string]$Changelog,
    [switch]$Beta,
    # Local only builds release/; Server also installs into the Jellyfin plugin folder; Ask prompts when interactive.
    [ValidateSet("Ask", "Local", "Server")]
    [string]$Target = "Ask",
    # Jellyfin's plugins folder (e.g. a mounted share). Falls back to JELLYFIN_PLUGINS_PATH, then .env.deploy.local.
    [string]$ServerPluginsPath
)

$ErrorActionPreference = "Stop"

function Join-RepoPath {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Parts
    )

    $path = $Parts[0]

    for ($i = 1; $i -lt $Parts.Count; $i++) {
        $path = [System.IO.Path]::Combine($path, $Parts[$i])
    }

    return $path
}

function Run {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [Parameter(Mandatory = $true)]
        [string]$ErrorMessage
    )

    & $Command @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "$ErrorMessage Exit code: $LASTEXITCODE"
    }
}

function Get-ProjectProperty {
    param(
        [Parameter(Mandatory = $true)]
        [xml]$ProjectXml,

        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $node = $ProjectXml.SelectSingleNode("/*[local-name()='Project']/*[local-name()='PropertyGroup']/*[local-name()='$Name']")

    if ($null -eq $node) {
        return $null
    }

    return [string]$node.InnerText
}

function Get-PackageVersion {
    param(
        [Parameter(Mandatory = $true)]
        [xml]$ProjectXml,

        [Parameter(Mandatory = $true)]
        [string]$PackageName
    )

    $nodes = $ProjectXml.SelectNodes("/*[local-name()='Project']/*[local-name()='ItemGroup']/*[local-name()='PackageReference']")

    foreach ($node in $nodes) {
        if ($node.GetAttribute("Include") -ne $PackageName) {
            continue
        }

        $version = $node.GetAttribute("Version")

        if (-not [string]::IsNullOrWhiteSpace($version)) {
            return $version
        }

        $versionNode = $node.SelectSingleNode("*[local-name()='Version']")

        if ($null -ne $versionNode -and -not [string]::IsNullOrWhiteSpace($versionNode.InnerText)) {
            return [string]$versionNode.InnerText
        }
    }

    return $null
}

function Get-CurrentPowerShell {
    $processPath = (Get-Process -Id $PID).Path

    if (-not [string]::IsNullOrWhiteSpace($processPath) -and (Test-Path -LiteralPath $processPath)) {
        return $processPath
    }

    $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
    if ($pwsh) {
        return $pwsh.Source
    }

    $powershell = Get-Command powershell -ErrorAction SilentlyContinue
    if ($powershell) {
        return $powershell.Source
    }

    throw "Could not find PowerShell executable."
}

function Remove-TempBuild {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    try {
        Remove-Item -LiteralPath $Path -Recurse -Force
    } catch {
        Write-Warning "Could not remove temporary build folder: $Path"
        Write-Warning $_.Exception.Message
    }
}

function Test-Interactive {
    return [Environment]::UserInteractive -and -not [Console]::IsInputRedirected
}

function Read-DeployEnvFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $values = @{}

    if (-not (Test-Path -LiteralPath $Path)) {
        return $values
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
            $values[$Matches[1]] = $Matches[2].Trim('"')
        }
    }

    return $values
}

function Resolve-ServerPluginsPath {
    param(
        [string]$Requested,

        [Parameter(Mandatory = $true)]
        [string]$EnvFilePath
    )

    $path = $Requested

    if ([string]::IsNullOrWhiteSpace($path)) {
        $path = $env:JELLYFIN_PLUGINS_PATH
    }

    if ([string]::IsNullOrWhiteSpace($path)) {
        $path = (Read-DeployEnvFile -Path $EnvFilePath)["JELLYFIN_PLUGINS_PATH"]
    }

    if ([string]::IsNullOrWhiteSpace($path)) {
        if (-not (Test-Interactive)) {
            throw "No Jellyfin plugins folder configured. Pass -ServerPluginsPath or set JELLYFIN_PLUGINS_PATH."
        }

        $path = Read-Host "Jellyfin plugins folder (for example a mounted share such as X:\jellyfin\config\plugins)"

        if ([string]::IsNullOrWhiteSpace($path)) {
            throw "No Jellyfin plugins folder entered."
        }

        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($EnvFilePath, "JELLYFIN_PLUGINS_PATH=$path`n", $utf8NoBom)
        Write-Host "Saved the plugins folder to $EnvFilePath (git-ignored)."
    }

    if (-not (Test-Path -LiteralPath $path -PathType Container)) {
        throw "Jellyfin plugins folder not found: $path"
    }

    return [System.IO.Path]::GetFullPath($path)
}

function Find-InstalledPluginFolder {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PluginsPath,

        [Parameter(Mandatory = $true)]
        [string]$Guid
    )

    $installed = foreach ($folder in Get-ChildItem -LiteralPath $PluginsPath -Directory) {
        $metaPath = Join-Path $folder.FullName "meta.json"

        if (-not (Test-Path -LiteralPath $metaPath)) {
            continue
        }

        try {
            $meta = Get-Content -LiteralPath $metaPath -Raw | ConvertFrom-Json
        } catch {
            continue
        }

        if ($meta.guid -ne $Guid) {
            continue
        }

        $version = [Version]"0.0.0.0"
        [void][Version]::TryParse([string]$meta.version, [ref]$version)

        [pscustomobject]@{
            Folder = $folder.FullName
            Meta = $meta
            Version = $version
            Active = $meta.status -eq "Active"
        }
    }

    # Jellyfin loads the active, highest version; that is the folder to replace.
    return $installed | Sort-Object -Property @{ Expression = "Active"; Descending = $true }, @{ Expression = "Version"; Descending = $true } | Select-Object -First 1
}

function Install-ToServer {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PluginsPath,

        [Parameter(Mandatory = $true)]
        [string]$StageDir,

        [Parameter(Mandatory = $true)]
        [System.Collections.IDictionary]$StagedMeta,

        [Parameter(Mandatory = $true)]
        [string]$BackupRoot,

        [switch]$KeepChangelog
    )

    $existing = Find-InstalledPluginFolder -PluginsPath $PluginsPath -Guid $StagedMeta.guid

    if ($existing) {
        $targetDir = $existing.Folder
        $backupDir = Join-Path $BackupRoot ("{0}_{1}" -f (Split-Path -Leaf $targetDir), [DateTime]::Now.ToString("yyyyMMdd-HHmmss"))
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        Get-ChildItem -LiteralPath $targetDir -File | Copy-Item -Destination $backupDir
        Write-Host "Replacing $($existing.Meta.version) in: $targetDir"
        Write-Host "Backup of the previous files: $backupDir"
    } else {
        $targetDir = Join-Path $PluginsPath ("{0}_{1}" -f $StagedMeta.name, $StagedMeta.version)
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        Write-Host "No installed copy found; installing into: $targetDir"
    }

    try {
        Get-ChildItem -LiteralPath $StageDir | Where-Object { $_.Name -ne "meta.json" } |
            Copy-Item -Destination $targetDir -Recurse -Force
    } catch {
        throw "Could not copy into $targetDir. If the DLL is locked, stop the Jellyfin container and run again. $($_.Exception.Message)"
    }

    # Keep the state Jellyfin manages itself (status, autoUpdate, imagePath) and refresh what the build defines.
    # Without -Changelog the installed changelog stays instead of the "Initial release." placeholder.
    $preserved = @("status", "autoUpdate", "imagePath")
    if ($KeepChangelog) {
        $preserved += "changelog"
    }
    $meta = [ordered]@{}
    foreach ($key in $StagedMeta.Keys) {
        $meta[$key] = $StagedMeta[$key]
    }

    if ($existing) {
        foreach ($property in $existing.Meta.PSObject.Properties) {
            if ($property.Name -in $preserved) {
                $meta[$property.Name] = $property.Value
            }
        }
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Join-Path $targetDir "meta.json"), ($meta | ConvertTo-Json -Depth 5), $utf8NoBom)

    Write-Host ""
    Write-Host "Installed $($StagedMeta.name) $($StagedMeta.version) into:"
    Write-Host "  $targetDir"
    Write-Host "Restart the Jellyfin server (for example the container in Dockhand) to load it."
}

function Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    Write-Host ""
    Write-Host "==> $Text"
}

$repoRoot = if ($PSScriptRoot) {
    $PSScriptRoot
} else {
    Split-Path -Parent $MyInvocation.MyCommand.Path
}

$repoRoot = [System.IO.Path]::GetFullPath($repoRoot)

$projectDir = Join-RepoPath @($repoRoot, "Jellyfin.Plugin.Featured")
$projectFile = Join-RepoPath @($projectDir, "Jellyfin.Plugin.Featured.csproj")

$pluginName = "Featured"
$pluginDisplayName = "Jellyfin Featured"
$pluginGuid = "08880a95-8467-4538-bab9-da69c7f4793f"
$pluginOwner = "spkesDE"
$pluginCategory = "General"
$pluginOverview = "A Netflix-style featured-content carousel for the Jellyfin Web home page."
$pluginDescription = "Adds a configurable featured-content carousel with curated favourites, collections, recent releases, random picks, hero layouts, and local background trailers to Jellyfin Web."
$pluginImageUrl = if ($Beta) {
    "https://raw.githubusercontent.com/spkesDE/jellyfin-featured-plugin/main/logo-beta.png"
} else {
    "https://raw.githubusercontent.com/spkesDE/jellyfin-featured-plugin/main/logo.png"
}

if ($Beta -and -not (Test-Path -LiteralPath (Join-RepoPath @($repoRoot, "logo-beta.png")))) {
    throw "Beta logo not found: $(Join-RepoPath @($repoRoot, 'logo-beta.png'))"
}

$releaseRoot = Join-RepoPath @($repoRoot, "release")
$deployEnvPath = Join-RepoPath @($repoRoot, ".env.deploy.local")
$serverBackupRoot = Join-RepoPath @($releaseRoot, "server-backup")
$changelogProvided = -not [string]::IsNullOrWhiteSpace($Changelog)
$buildOutput = Join-RepoPath @($releaseRoot, ".build-$([Guid]::NewGuid().ToString("N"))")
$stageDir = Join-RepoPath @($releaseRoot, $pluginName)
$zipPath = Join-RepoPath @($releaseRoot, "$pluginName.zip")
$bundlePath = Join-RepoPath @($repoRoot, "dist", "featured.bundle.js")
$configBundlePath = Join-RepoPath @($repoRoot, "dist", "config.bundle.js")
$bootstrapBundlePath = Join-RepoPath @($repoRoot, "dist", "bootstrap.bundle.js")
$verifyScript = Join-RepoPath @($repoRoot, "scripts", "verify-embedded-bundle.ps1")
$syncFrontendVersionScript = Join-RepoPath @($repoRoot, "scripts", "sync-frontend-version.mjs")

if ($Target -eq "Ask") {
    if (Test-Interactive) {
        $choices = [System.Management.Automation.Host.ChoiceDescription[]]@(
            [System.Management.Automation.Host.ChoiceDescription]::new("&Local", "Build release/Featured and release/Featured.zip only."),
            [System.Management.Automation.Host.ChoiceDescription]::new("&Server", "Build, then replace the installed plugin in the Jellyfin plugins folder.")
        )
        $Target = @("Local", "Server")[$Host.UI.PromptForChoice("Build target", "Build locally only, or also deploy to the Jellyfin server?", $choices, 0)]
    } else {
        $Target = "Local"
    }
}

# Resolve the server folder before the build so a missing share fails fast.
$resolvedPluginsPath = if ($Target -eq "Server") {
    Resolve-ServerPluginsPath -Requested $ServerPluginsPath -EnvFilePath $deployEnvPath
} else {
    $null
}

try {
    Step "Reading project metadata"

    if (-not (Test-Path -LiteralPath $projectFile)) {
        throw "Project file not found: $projectFile"
    }

    [xml]$projectXml = Get-Content -LiteralPath $projectFile

    $pluginVersion = Get-ProjectProperty -ProjectXml $projectXml -Name "Version"
    $assemblyVersion = Get-ProjectProperty -ProjectXml $projectXml -Name "AssemblyVersion"
    $fileVersion = Get-ProjectProperty -ProjectXml $projectXml -Name "FileVersion"

    if ([string]::IsNullOrWhiteSpace($pluginVersion)) {
        throw "Could not determine plugin version from $projectFile"
    }

    if ($pluginVersion -notmatch '^\d+\.\d+\.\d+\.\d+$') {
        throw "Plugin version must use <Jellyfin major>.<plugin major>.<minor>.<patch>: $pluginVersion"
    }

    if ($assemblyVersion -ne $pluginVersion -or $fileVersion -ne $pluginVersion) {
        throw "Project versions must match before packaging. Version=$pluginVersion AssemblyVersion=$assemblyVersion FileVersion=$fileVersion"
    }

    if (-not (Test-Path -LiteralPath $syncFrontendVersionScript)) {
        throw "Frontend version sync script not found: $syncFrontendVersionScript"
    }

    Run "node" @($syncFrontendVersionScript, $pluginVersion, "--check") "Frontend package versions do not match plugin version."

    $controllerVersion = Get-PackageVersion -ProjectXml $projectXml -PackageName "Jellyfin.Controller"

    if ([string]::IsNullOrWhiteSpace($controllerVersion)) {
        throw "Could not determine Jellyfin.Controller package version from $projectFile"
    }

    $controllerVersion = $controllerVersion.Split("-")[0]
    $versionParts = @($controllerVersion.Split("."))

    while ($versionParts.Count -lt 4) {
        $versionParts += "0"
    }

    if ($pluginVersion.Split('.')[0] -ne $versionParts[0]) {
        throw "Plugin version '$pluginVersion' must start with Jellyfin major version '$($versionParts[0])'."
    }

    $targetAbi = ($versionParts | Select-Object -First 4) -join "."

    if ([string]::IsNullOrWhiteSpace($Changelog)) {
        $Changelog = "Initial release."
    }

    Write-Host "Plugin version: $pluginVersion"
    Write-Host "Target ABI:     $targetAbi"

    Step "Installing frontend dependencies"

    if (Test-Path -LiteralPath (Join-RepoPath @($repoRoot, "package-lock.json"))) {
        npm --prefix $repoRoot ci

        if ($LASTEXITCODE -ne 0) {
            Write-Warning "npm ci failed. Removing node_modules and retrying once..."

            $nodeModulesPath = Join-RepoPath @($repoRoot, "node_modules")

            if (Test-Path -LiteralPath $nodeModulesPath) {
                Remove-Item -LiteralPath $nodeModulesPath -Recurse -Force
            }

            Run "npm" @("--prefix", $repoRoot, "ci") "npm ci failed."
        }
    } else {
        Run "npm" @("--prefix", $repoRoot, "install") "npm install failed."
    }

    Step "Building frontend bundle"

    Run "npm" @("--prefix", $repoRoot, "run", "build") "npm run build failed."

    if (-not (Test-Path -LiteralPath $bundlePath)) {
        throw "Frontend bundle not found: $bundlePath"
    }

    if (-not (Test-Path -LiteralPath $configBundlePath)) {
        throw "Configuration bundle not found: $configBundlePath"
    }

    if (-not (Test-Path -LiteralPath $bootstrapBundlePath)) {
        throw "Bootstrap bundle not found: $bootstrapBundlePath"
    }

    Run "node" @("--check", $bundlePath) "Frontend bundle syntax check failed."
    Run "node" @("--check", $configBundlePath) "Configuration bundle syntax check failed."
    Run "node" @("--check", $bootstrapBundlePath) "Bootstrap bundle syntax check failed."

    Step "Building plugin"

    New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null

    Run "dotnet" @(
        "build",
        $projectFile,
        "-c",
        $Configuration,
        "-p:UseSharedCompilation=false",
        "--output",
        $buildOutput
    ) "dotnet build failed."

    $builtAssemblyPath = Join-RepoPath @($buildOutput, "Jellyfin.Plugin.Featured.dll")

    if (-not (Test-Path -LiteralPath $builtAssemblyPath)) {
        throw "Built plugin assembly not found: $builtAssemblyPath"
    }

    $builtAssemblyVersion = [System.Reflection.AssemblyName]::GetAssemblyName($builtAssemblyPath).Version.ToString()
    $builtFileVersion = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($builtAssemblyPath).FileVersion

    if ($builtAssemblyVersion -ne $pluginVersion -or $builtFileVersion -ne $pluginVersion) {
        throw "Built plugin versions do not match package version. Package=$pluginVersion Assembly=$builtAssemblyVersion File=$builtFileVersion"
    }

    Step "Verifying embedded frontend bundle"

    if (-not (Test-Path -LiteralPath $verifyScript)) {
        throw "Verify script not found: $verifyScript"
    }

    $powerShellExe = Get-CurrentPowerShell

    if ($env:OS -eq "Windows_NT") {
        Run $powerShellExe @(
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            $verifyScript,
            "-AssemblyPath",
            $builtAssemblyPath,
            "-BundlePath",
            $bundlePath,
            "-ConfigBundlePath",
            $configBundlePath,
            "-BootstrapBundlePath",
            $bootstrapBundlePath
        ) "Embedded frontend bundle verification failed."
    } else {
        Run $powerShellExe @(
            "-NoProfile",
            "-File",
            $verifyScript,
            "-AssemblyPath",
            $builtAssemblyPath,
            "-BundlePath",
            $bundlePath,
            "-ConfigBundlePath",
            $configBundlePath,
            "-BootstrapBundlePath",
            $bootstrapBundlePath
        ) "Embedded frontend bundle verification failed."
    }

    Step "Preparing release folder"

    if (Test-Path -LiteralPath $stageDir) {
        Remove-Item -LiteralPath $stageDir -Recurse -Force
    }

    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }

    New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

    $includeFiles = @(
        "Jellyfin.Plugin.Featured.dll",
        "Jellyfin.Plugin.Featured.deps.json",
        "Jellyfin.Plugin.Featured.runtimeconfig.json",
        "Newtonsoft.Json.dll"
    )

    foreach ($file in $includeFiles) {
        $sourcePath = Join-RepoPath @($buildOutput, $file)

        if (Test-Path -LiteralPath $sourcePath) {
            Copy-Item -LiteralPath $sourcePath -Destination $stageDir
        }
    }

    $readmePath = Join-RepoPath @($repoRoot, "README.md")
    $licensePath = Join-RepoPath @($repoRoot, "LICENSE")
    $issueAuditPath = Join-RepoPath @($repoRoot, "docs", "original-issue-audit.md")

    if (Test-Path -LiteralPath $readmePath) {
        Copy-Item -LiteralPath $readmePath -Destination $stageDir
    }

    if (Test-Path -LiteralPath $licensePath) {
        Copy-Item -LiteralPath $licensePath -Destination $stageDir
    }

    if (Test-Path -LiteralPath $issueAuditPath) {
        $stageDocsDir = Join-RepoPath @($stageDir, "docs")
        New-Item -ItemType Directory -Path $stageDocsDir -Force | Out-Null
        Copy-Item -LiteralPath $issueAuditPath -Destination $stageDocsDir
    }

    Step "Writing meta.json"

    $timestamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")

    $meta = [ordered]@{
        category = $pluginCategory
        changelog = $Changelog
        description = $pluginDescription
        guid = $pluginGuid
        imageUrl = $pluginImageUrl
        name = $pluginDisplayName
        overview = $pluginOverview
        owner = $pluginOwner
        targetAbi = $targetAbi
        timestamp = $timestamp
        version = $pluginVersion
        status = "Active"
        autoUpdate = $true
        assemblies = @(
            "Jellyfin.Plugin.Featured.dll"
        )
    }

    $metaJsonPath = Join-RepoPath @($stageDir, "meta.json")
    $metaJson = $meta | ConvertTo-Json -Depth 5
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)

    [System.IO.File]::WriteAllText($metaJsonPath, $metaJson, $utf8NoBom)

    Step "Creating ZIP"

    Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $zipPath -Force

    Write-Host ""
    Write-Host "Release folder:"
    Write-Host "  $stageDir"
    Write-Host "Release zip:"
    Write-Host "  $zipPath"

    if ($Target -eq "Server") {
        Step "Deploying to the Jellyfin server"
        Install-ToServer -PluginsPath $resolvedPluginsPath -StageDir $stageDir -StagedMeta $meta -BackupRoot $serverBackupRoot -KeepChangelog:(-not $changelogProvided)
    }
} finally {
    Remove-TempBuild -Path $buildOutput
}
