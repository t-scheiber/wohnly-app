# Build MSIX package from Tauri build output
# Usage: powershell -ExecutionPolicy Bypass -File build-msix.ps1 -Version "1.0.0.0"
#
# Identity values are hardcoded in AppxManifest.xml from Partner Center.
# Requires: Windows SDK (makeappx.exe available on GitHub Actions windows-latest runners)

param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TauriTarget = Join-Path $ScriptDir "tauri\target\release"
$MsixDir = Join-Path $ScriptDir "msix"
$StagingDir = Join-Path $ScriptDir "msix-staging"
$OutputDir = Join-Path $ScriptDir "msix-output"

# Clean staging
if (Test-Path $StagingDir) { Remove-Item -Recurse -Force $StagingDir }
if (Test-Path $OutputDir) { Remove-Item -Recurse -Force $OutputDir }
New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null
New-Item -ItemType Directory -Path "$StagingDir\assets" -Force | Out-Null
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# Copy the Tauri executable
$ExePath = Join-Path $TauriTarget "wohnly-desktop.exe"
if (-not (Test-Path $ExePath)) {
    Write-Error "Wohnly.exe not found at $ExePath"
    exit 1
}
Copy-Item $ExePath $StagingDir
Write-Host "Copied wohnly-desktop.exe"

# Copy WebView2Loader.dll if present
$WebView2Dll = Join-Path $TauriTarget "WebView2Loader.dll"
if (Test-Path $WebView2Dll) {
    Copy-Item $WebView2Dll $StagingDir
    Write-Host "Copied WebView2Loader.dll"
}

# Copy MSIX icon assets
$AssetsDir = Join-Path $MsixDir "assets"
if (Test-Path $AssetsDir) {
    Copy-Item "$AssetsDir\*" "$StagingDir\assets\" -Recurse
    Write-Host "Copied MSIX icon assets"
} else {
    Write-Error "MSIX assets not found at $AssetsDir"
    exit 1
}

# Generate AppxManifest.xml with substituted values
$ManifestTemplate = Join-Path $MsixDir "AppxManifest.xml"
$ManifestContent = Get-Content $ManifestTemplate -Raw

# Version must be in x.x.x.x format (4 parts, last must be 0 for Store)
if ($Version -match '^\d+\.\d+\.\d+$') {
    $Version = "$Version.0"
}

$ManifestContent = $ManifestContent -replace 'REPLACE_VERSION', $Version

$ManifestContent | Out-File -FilePath "$StagingDir\AppxManifest.xml" -Encoding utf8
Write-Host "Generated AppxManifest.xml (Version=$Version)"

# Find makeappx.exe from Windows SDK
$SdkPaths = @(
    "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\makeappx.exe",
    "${env:ProgramFiles}\Windows Kits\10\bin\*\x64\makeappx.exe"
)

$MakeAppx = $null
foreach ($pattern in $SdkPaths) {
    $found = Get-Item $pattern -ErrorAction SilentlyContinue | Sort-Object -Descending | Select-Object -First 1
    if ($found) {
        $MakeAppx = $found.FullName
        break
    }
}

if (-not $MakeAppx) {
    Write-Error "makeappx.exe not found. Install the Windows SDK."
    exit 1
}

Write-Host "Using: $MakeAppx"

# Create the MSIX package
$OutputMsix = Join-Path $OutputDir "Wohnly.msix"
& $MakeAppx pack /d $StagingDir /p $OutputMsix /o

if ($LASTEXITCODE -ne 0) {
    Write-Error "makeappx.exe failed with exit code $LASTEXITCODE"
    exit 1
}

Write-Host ""
Write-Host "MSIX package created: $OutputMsix"
Write-Host "Upload this to Microsoft Partner Center for free Store signing."

# Clean up staging
Remove-Item -Recurse -Force $StagingDir
