# Install or verify the separately installed FFmpeg used by Flowtake.
# Flowtake release packages do not include FFmpeg executables or libraries.

$ErrorActionPreference = "Stop"

$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($ffmpeg) {
    & $ffmpeg.Source -hide_banner -version *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[flowtake-ffmpeg] Ready: $($ffmpeg.Source)"
        exit 0
    }
}

$winget = Get-Command winget -ErrorAction SilentlyContinue
if (-not $winget) {
    throw "FFmpeg is required. Install it from https://ffmpeg.org/download.html and add it to PATH."
}

Write-Host "[flowtake-ffmpeg] Installing FFmpeg with WinGet..."
& $winget.Source install --id Gyan.FFmpeg --exact --source winget --accept-package-agreements --accept-source-agreements
if ($LASTEXITCODE -ne 0) {
    throw "WinGet could not install FFmpeg (exit code $LASTEXITCODE)."
}

Write-Host "[flowtake-ffmpeg] FFmpeg installed. Restart your terminal and Flowtake before continuing."
