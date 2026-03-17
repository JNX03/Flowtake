# Download FFmpeg binary for Windows and place it in src-tauri/binaries/
# Run this before `tauri build` if ffmpeg-x86_64-pc-windows-msvc.exe is missing.

$ErrorActionPreference = "Stop"

$BinDir = Join-Path $PSScriptRoot "..\src-tauri\binaries"
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null

$Arch = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture
$Target = if ($Arch -eq "Arm64") { "aarch64-pc-windows-msvc" } else { "x86_64-pc-windows-msvc" }
$Dest = Join-Path $BinDir "ffmpeg-$Target.exe"

if (Test-Path $Dest) {
    Write-Host "[download-ffmpeg] FFmpeg already exists at $Dest"
    exit 0
}

Write-Host "[download-ffmpeg] Downloading FFmpeg for Windows ($Target)..."
$Url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$TmpDir = Join-Path $env:TEMP "ffmpeg-download-$(Get-Random)"
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null

$ZipPath = Join-Path $TmpDir "ffmpeg.zip"
Invoke-WebRequest -Uri $Url -OutFile $ZipPath -UseBasicParsing

Expand-Archive -Path $ZipPath -DestinationPath $TmpDir -Force

# Find ffmpeg.exe inside extracted directory
$FfmpegExe = Get-ChildItem -Path $TmpDir -Recurse -Filter "ffmpeg.exe" |
    Where-Object { $_.DirectoryName -like "*bin*" } |
    Select-Object -First 1

if (-not $FfmpegExe) {
    Write-Error "[download-ffmpeg] ERROR: ffmpeg.exe not found in archive"
    Remove-Item -Recurse -Force $TmpDir
    exit 1
}

Copy-Item $FfmpegExe.FullName $Dest
Remove-Item -Recurse -Force $TmpDir

Write-Host "[download-ffmpeg] Installed FFmpeg to $Dest"
