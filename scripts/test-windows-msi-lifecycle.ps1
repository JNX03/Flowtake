[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("ValidateManifest", "ValidateDefender", "Lifecycle")]
    [string]$Mode,

    [Parameter(Mandatory = $true)]
    [string]$ManifestDirectory,

    [string]$EvidenceDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
if ($null -ne (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue)) {
    $PSNativeCommandUseErrorActionPreference = $false
}

$PackageIdentifier = "JNX03.Flowtake"
$ExpectedVersion = "1.6.0"
$ExpectedTag = "v1.6.0"
$ExpectedPublisher = "Jnx03"
$ExpectedProductName = "Flowtake"
$ExpectedProductCode = "{CEB7F435-02D2-41EF-8B21-28D9E7D3E5CB}"
$ExpectedUpgradeCode = "{CE51BD38-DC3B-53D2-881E-5413CF117167}"
$ExpectedMsiName = "Flowtake_1.6.0_x64_en-US.msi"
$ExpectedMsiUrl = "https://github.com/JNX03/Flowtake/releases/download/v1.6.0/Flowtake_1.6.0_x64_en-US.msi"
$ExpectedMsiSha256 = "497FE1454687EE1224FC839C2290A44471041DB7490E72F55EE14464ADD61B8D"
$ExpectedMsiSize = 92131328L
$ExpectedChecksumsSha256 = "34DFA1267068590F277E5A172E5538159FF809A94D364812CAF3DA6CFBCB3B16"
$ExpectedExecutable = "C:\Program Files\Flowtake\flowtake.exe"
$ExpectedInstallDirectory = "C:\Program Files\Flowtake"
$ExpectedFileVersion = "1.6.0.0"
$ExpectedVendorKey = "HKCU:\Software\Jnx03\Flowtake"
$ExpectedUninstallKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$ExpectedProductCode"
$UnexpectedWowUninstallKey = "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\$ExpectedProductCode"

if (-not (Test-Path -LiteralPath $ManifestDirectory -PathType Container)) {
    throw "Manifest directory does not exist: $ManifestDirectory"
}
$ManifestDirectory = (Resolve-Path -LiteralPath $ManifestDirectory).Path

if ([string]::IsNullOrWhiteSpace($EvidenceDirectory)) {
    $evidenceRoot = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [System.IO.Path]::GetTempPath() }
    $EvidenceDirectory = Join-Path $evidenceRoot "flowtake-msi-evidence"
}
New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null
$EvidenceDirectory = (Resolve-Path -LiteralPath $EvidenceDirectory).Path
$EvidenceLog = Join-Path $EvidenceDirectory "evidence.txt"

function Write-Evidence {
    param([Parameter(Mandatory = $true)][string]$Message)

    $line = "[{0}] {1}" -f ([DateTime]::UtcNow.ToString("o")), $Message
    Write-Host $line
    Add-Content -LiteralPath $EvidenceLog -Value $line -Encoding utf8
}

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)][bool]$Condition,
        [Parameter(Mandatory = $true)][string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Get-UniqueYamlScalar {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Key
    )

    $pattern = "(?m)^\s*(?:-\s*)?{0}:\s*(?<value>[^\r\n]+?)\s*$" -f [regex]::Escape($Key)
    $matches = [regex]::Matches($Source, $pattern)
    Assert-Condition ($matches.Count -eq 1) "Expected exactly one $Key value; found $($matches.Count)."
    return $matches[0].Groups["value"].Value.Trim().Trim("'", '"')
}

function Invoke-NativeChecked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$LogPath,
        [int[]]$AllowedExitCodes = @(0)
    )

    $rendered = $Arguments | ForEach-Object {
        if ($_ -match "\s") { '"{0}"' -f $_ } else { $_ }
    }
    Write-Evidence ("Running: {0} {1}" -f $FilePath, ($rendered -join " "))
    $output = @(& $FilePath @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { $_.ToString() } | Set-Content -LiteralPath $LogPath -Encoding utf8
    $output | ForEach-Object { Write-Host $_ }

    if ($AllowedExitCodes -notcontains $exitCode) {
        throw "$FilePath exited with code $exitCode."
    }

    return [pscustomobject]@{
        ExitCode = $exitCode
        Output = ($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    }
}

function Release-ComObject {
    param([AllowNull()]$ComObject)

    if ($null -ne $ComObject -and [System.Runtime.InteropServices.Marshal]::IsComObject($ComObject)) {
        [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($ComObject)
    }
}

function Get-MsiProperty {
    param(
        [Parameter(Mandatory = $true)]$Database,
        [Parameter(Mandatory = $true)][string]$Name
    )

    Assert-Condition ($Name -match "^[A-Za-z0-9_]+$") "Unsafe MSI property name: $Name"
    $query = "SELECT ``Value`` FROM ``Property`` WHERE ``Property``='$Name'"
    $view = $null
    $record = $null
    try {
        $view = $Database.GetType().InvokeMember("OpenView", "InvokeMethod", $null, $Database, @($query))
        $view.GetType().InvokeMember("Execute", "InvokeMethod", $null, $view, $null) | Out-Null
        $record = $view.GetType().InvokeMember("Fetch", "InvokeMethod", $null, $view, $null)
        Assert-Condition ($null -ne $record) "MSI property is missing: $Name"
        return $record.GetType().InvokeMember("StringData", "GetProperty", $null, $record, @(1))
    }
    finally {
        Release-ComObject -ComObject $record
        if ($null -ne $view) {
            try {
                $view.GetType().InvokeMember("Close", "InvokeMethod", $null, $view, $null) | Out-Null
            }
            finally {
                Release-ComObject -ComObject $view
            }
        }
    }
}

function Get-FlowtakeProcesses {
    $expectedPath = [System.IO.Path]::GetFullPath($ExpectedExecutable)
    $processes = @(Get-Process -Name "flowtake" -ErrorAction SilentlyContinue)
    foreach ($process in $processes) {
        try {
            $actualPath = [System.IO.Path]::GetFullPath($process.Path)
        }
        catch {
            throw "Could not inspect flowtake process $($process.Id): $($_.Exception.Message)"
        }
        Assert-Condition ($actualPath -ieq $expectedPath) "Unexpected flowtake process path for PID $($process.Id): $actualPath"
    }
    return $processes
}

function Get-WinGetAdminSetting {
    param(
        [Parameter(Mandatory = $true)][string]$WinGetPath,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$LogPath
    )

    $result = Invoke-NativeChecked `
        -FilePath $WinGetPath `
        -Arguments @("settings", "export", "--disable-interactivity") `
        -LogPath $LogPath
    try {
        $settings = $result.Output | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw "Could not parse WinGet settings export: $($_.Exception.Message)"
    }
    Assert-Condition ($null -ne $settings.adminSettings) "WinGet settings export omitted adminSettings."
    $property = $settings.adminSettings.PSObject.Properties[$Name]
    Assert-Condition ($null -ne $property) "WinGet settings export omitted admin setting: $Name"
    return [bool]$property.Value
}

function Assert-CleanInstallState {
    param([switch]$AfterUninstall)

    $phase = if ($AfterUninstall) { "after uninstall" } else { "before install" }
    Assert-Condition (-not (Test-Path -LiteralPath $ExpectedUninstallKey)) "64-bit ARP product key exists $phase."
    Assert-Condition (-not (Test-Path -LiteralPath $UnexpectedWowUninstallKey)) "WOW6432Node ARP product key exists $phase."
    Assert-Condition (-not (Test-Path -LiteralPath $ExpectedExecutable)) "Installed executable exists $phase."
    Assert-Condition (-not (Test-Path -LiteralPath $ExpectedInstallDirectory)) "Install directory exists $phase."
    Assert-Condition (@(Get-FlowtakeProcesses).Count -eq 0) "A Flowtake process remains $phase."

    $shortcuts = @(
        (Join-Path $env:USERPROFILE "Desktop\Flowtake.lnk"),
        (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Flowtake\Flowtake.lnk")
    )
    Assert-Condition (-not (Test-Path -LiteralPath $ExpectedVendorKey)) "Installer-owned HKCU vendor key exists $phase."
    foreach ($shortcut in $shortcuts) {
        Assert-Condition (-not (Test-Path -LiteralPath $shortcut)) "Installer-owned shortcut exists $phase`: $shortcut"
    }

    if ($AfterUninstall) {
        Write-Evidence "Installer-owned ARP, HKCU, shortcut, file, directory, and process state is absent after uninstall."
    }
}

function Get-MpCmdRunPath {
    $candidates = [System.Collections.Generic.List[string]]::new()
    $platformRoot = Join-Path $env:ProgramData "Microsoft\Windows Defender\Platform"
    if (Test-Path -LiteralPath $platformRoot -PathType Container) {
        foreach ($directory in @(Get-ChildItem -LiteralPath $platformRoot -Directory | Sort-Object Name -Descending)) {
            $candidates.Add((Join-Path $directory.FullName "MpCmdRun.exe"))
        }
    }
    $candidates.Add((Join-Path $env:ProgramFiles "Windows Defender\MpCmdRun.exe"))
    $mpCmdRunPath = @($candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1)
    Assert-Condition ($mpCmdRunPath.Count -eq 1) "MpCmdRun.exe is unavailable."
    return $mpCmdRunPath[0]
}

function Test-DefenderSignatureFresh {
    param([Parameter(Mandatory = $true)]$Status)

    if ([string]::IsNullOrWhiteSpace([string]$Status.AntivirusSignatureVersion)) {
        return $false
    }
    if ($null -eq $Status.AntivirusSignatureLastUpdated) {
        return $false
    }
    $ageProperty = $Status.PSObject.Properties["AntivirusSignatureAge"]
    if ($null -eq $ageProperty -or $null -eq $ageProperty.Value) {
        return $false
    }
    try {
        $age = [uint64]$ageProperty.Value
        $updatedUtc = ([datetime]$Status.AntivirusSignatureLastUpdated).ToUniversalTime()
    }
    catch {
        return $false
    }
    $nowUtc = [DateTime]::UtcNow
    return (
        $age -le [uint64]1 -and
        $updatedUtc -ge $nowUtc.AddHours(-48) -and
        $updatedUtc -le $nowUtc.AddMinutes(5)
    )
}

function Get-DefenderStatusWithRetry {
    $lastFailure = "no error was reported"
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            return Get-MpComputerStatus -ErrorAction Stop
        }
        catch {
            $lastFailure = $_.Exception.Message
            Write-Evidence "Get-MpComputerStatus attempt $attempt of 3 failed: $lastFailure"
            if ($attempt -lt 3) {
                Start-Sleep -Seconds 2
            }
        }
    }
    throw "Could not read Defender status after 3 attempts: $lastFailure"
}

function Assert-DefenderCoreReady {
    param([Parameter(Mandatory = $true)]$Status)

    Assert-Condition ([bool]$Status.AMServiceEnabled) "Defender antimalware service is not enabled."
    Assert-Condition ([bool]$Status.AntivirusEnabled) "Defender antivirus is not enabled."
    Assert-Condition ($Status.AMRunningMode -eq "Normal") "Defender is not running in Normal mode: $($Status.AMRunningMode)"
    Assert-Condition (-not [string]::IsNullOrWhiteSpace([string]$Status.AMEngineVersion)) "Defender engine version is unavailable."
}

function Prepare-DefenderScan {
    param([Parameter(Mandatory = $true)][string]$TargetPath)

    Assert-Condition (Test-Path -LiteralPath $TargetPath) "Defender target is missing: $TargetPath"
    foreach ($requiredCommand in @("Get-MpComputerStatus", "Update-MpSignature")) {
        Assert-Condition ($null -ne (Get-Command $requiredCommand -ErrorAction SilentlyContinue)) "Required Defender command is unavailable: $requiredCommand"
    }

    $status = Get-DefenderStatusWithRetry
    Assert-DefenderCoreReady -Status $status
    $updateFailures = [System.Collections.Generic.List[string]]::new()

    if (Test-DefenderSignatureFresh -Status $status) {
        Write-Evidence "Defender signatures are already fresh; no network signature update is required."
    }
    else {
        Write-Evidence "Attempting Defender signature update with the explicit MMPC source."
        try {
            Update-MpSignature -UpdateSource MMPC -ErrorAction Stop | Out-Null
        }
        catch {
            $message = "Update-MpSignature MMPC attempt failed: $($_.Exception.Message)"
            $updateFailures.Add($message)
            Write-Evidence $message
        }
        $status = Get-DefenderStatusWithRetry

        if (-not (Test-DefenderSignatureFresh -Status $status)) {
            Write-Evidence "PowerShell signature updates did not establish freshness; trying the official MpCmdRun MMPC fallback."
            try {
                Invoke-NativeChecked `
                    -FilePath (Get-MpCmdRunPath) `
                    -Arguments @("-SignatureUpdate", "-MMPC") `
                    -LogPath (Join-Path $EvidenceDirectory "defender-signature-update-mmpc.log") `
                    -AllowedExitCodes @(0) | Out-Null
            }
            catch {
                $message = "MpCmdRun MMPC signature update failed: $($_.Exception.Message)"
                $updateFailures.Add($message)
                Write-Evidence $message
            }

            for ($poll = 1; $poll -le 6; $poll++) {
                $status = Get-DefenderStatusWithRetry
                if (Test-DefenderSignatureFresh -Status $status) {
                    break
                }
                if ($poll -lt 6) {
                    Start-Sleep -Seconds 2
                }
            }
        }
    }

    $status = Get-DefenderStatusWithRetry
    Assert-DefenderCoreReady -Status $status
    Assert-Condition (-not [string]::IsNullOrWhiteSpace([string]$status.AntivirusSignatureVersion)) "Defender signature version is unavailable."
    Assert-Condition ($null -ne $status.AntivirusSignatureLastUpdated) "Defender signature timestamp is unavailable."
    $failureSummary = if ($updateFailures.Count -gt 0) { $updateFailures -join " | " } else { "no updater error was reported" }
    Assert-Condition (Test-DefenderSignatureFresh -Status $status) "Defender signatures are stale or missing after bounded update attempts; age $($status.AntivirusSignatureAge) day(s); $failureSummary."
    Write-Evidence "Defender on-demand scan prerequisites are ready for $TargetPath; mode Normal, engine $($status.AMEngineVersion), signature $($status.AntivirusSignatureVersion), updated $($status.AntivirusSignatureLastUpdated.ToUniversalTime().ToString('o')). Real-time status is $([bool]$status.RealTimeProtectionEnabled) and is observed only, not used as a custom-scan prerequisite or claimed as installer-write coverage."
}

function Invoke-DefenderScan {
    param(
        [Parameter(Mandatory = $true)][string]$TargetPath,
        [Parameter(Mandatory = $true)][string]$Label
    )

    Assert-Condition (Test-Path -LiteralPath $TargetPath) "Defender scan target is missing: $TargetPath"
    $resolvedTarget = (Resolve-Path -LiteralPath $TargetPath).Path
    $safeLabel = ($Label -replace "[^A-Za-z0-9.-]", "-").Trim("-")
    Assert-Condition (-not [string]::IsNullOrWhiteSpace($safeLabel)) "Defender scan label is invalid."
    $result = Invoke-NativeChecked `
        -FilePath (Get-MpCmdRunPath) `
        -Arguments @("-Scan", "-ScanType", "3", "-File", $resolvedTarget, "-DisableRemediation") `
        -LogPath (Join-Path $EvidenceDirectory "defender-scan-$safeLabel.log") `
        -AllowedExitCodes @(0)
    Assert-Condition ($result.Output -match "(?im)^\s*Scan finished\.\s*$") "Defender did not report a completed scan for $Label."
    $cleanTargetPattern = "(?im)^\s*Scanning\s+{0}\s+found no threats\.\s*$" -f [regex]::Escape($resolvedTarget)
    Assert-Condition ($result.Output -match $cleanTargetPattern) "Defender did not report a clean scan for the exact target: $Label."
    Assert-Condition (Test-Path -LiteralPath $TargetPath) "Defender scan target disappeared: $Label."
    Write-Evidence "Defender exclusion-independent custom scan completed with no threats: $Label."
}

function Write-FailureLogTails {
    foreach ($log in @(Get-ChildItem -LiteralPath $EvidenceDirectory -Filter "*.log" -File -ErrorAction SilentlyContinue)) {
        Write-Host "--- bounded tail: $($log.Name) ---"
        Get-Content -LiteralPath $log.FullName -Tail 80 -ErrorAction SilentlyContinue | Write-Host
    }
}

$manifestNames = @(
    "$PackageIdentifier.yaml",
    "$PackageIdentifier.locale.en-US.yaml",
    "$PackageIdentifier.installer.yaml"
)
$actualManifestNames = @(Get-ChildItem -LiteralPath $ManifestDirectory -Filter "*.yaml" -File | Select-Object -ExpandProperty Name | Sort-Object)
Assert-Condition (($actualManifestNames -join "|") -eq (($manifestNames | Sort-Object) -join "|")) "The manifest directory must contain exactly the three expected YAML files."

$versionManifestPath = Join-Path $ManifestDirectory "$PackageIdentifier.yaml"
$localeManifestPath = Join-Path $ManifestDirectory "$PackageIdentifier.locale.en-US.yaml"
$installerManifestPath = Join-Path $ManifestDirectory "$PackageIdentifier.installer.yaml"
$versionManifest = Get-Content -Raw -LiteralPath $versionManifestPath
$localeManifest = Get-Content -Raw -LiteralPath $localeManifestPath
$installerManifest = Get-Content -Raw -LiteralPath $installerManifestPath

foreach ($source in @($versionManifest, $localeManifest, $installerManifest)) {
    Assert-Condition ((Get-UniqueYamlScalar -Source $source -Key "PackageIdentifier") -eq $PackageIdentifier) "Manifest PackageIdentifier drifted."
    Assert-Condition ((Get-UniqueYamlScalar -Source $source -Key "PackageVersion") -eq $ExpectedVersion) "Manifest PackageVersion drifted."
    Assert-Condition ((Get-UniqueYamlScalar -Source $source -Key "ManifestVersion") -eq "1.12.0") "Manifest schema version drifted."
}
Assert-Condition ((Get-UniqueYamlScalar -Source $installerManifest -Key "InstallerType") -eq "wix") "InstallerType must remain wix."
Assert-Condition ((Get-UniqueYamlScalar -Source $installerManifest -Key "Scope") -eq "machine") "Installer scope must remain machine."
Assert-Condition ((Get-UniqueYamlScalar -Source $installerManifest -Key "ProductCode") -eq $ExpectedProductCode) "Manifest ProductCode drifted."
Assert-Condition ((Get-UniqueYamlScalar -Source $installerManifest -Key "Architecture") -eq "x64") "Manifest architecture must remain x64."
Assert-Condition ((Get-UniqueYamlScalar -Source $installerManifest -Key "InstallerUrl") -eq $ExpectedMsiUrl) "Manifest installer URL drifted."
$manifestInstallerSha256 = (Get-UniqueYamlScalar -Source $installerManifest -Key "InstallerSha256").ToUpperInvariant()
Assert-Condition ($manifestInstallerSha256 -eq $ExpectedMsiSha256) "Manifest installer SHA-256 drifted."
Assert-Condition ((Get-UniqueYamlScalar -Source $localeManifest -Key "Publisher") -eq $ExpectedPublisher) "Manifest publisher drifted."
Assert-Condition ((Get-UniqueYamlScalar -Source $localeManifest -Key "PackageName") -eq $ExpectedProductName) "Manifest package name drifted."
Assert-Condition ((Get-UniqueYamlScalar -Source $localeManifest -Key "License") -eq "MIT") "Manifest license drifted."

$wingetCommand = Get-Command "winget" -ErrorAction SilentlyContinue
Assert-Condition ($null -ne $wingetCommand) "winget is unavailable."
$wingetPath = $wingetCommand.Source
$wingetVersion = @(& $wingetPath --version 2>&1) -join " "
Assert-Condition ($LASTEXITCODE -eq 0) "winget --version failed."
Write-Evidence "Runner image: $($env:ImageOS) $($env:ImageVersion); OS: $([Environment]::OSVersion.VersionString); WinGet: $wingetVersion."

$validateLog = Join-Path $EvidenceDirectory "winget-validate.log"
Invoke-NativeChecked -FilePath $wingetPath -Arguments @("validate", "--manifest", $ManifestDirectory) -LogPath $validateLog | Out-Null
Write-Evidence "Tracked WinGet manifest passed static validation."

if ($Mode -eq "ValidateManifest") {
    Write-Evidence "PASS: static manifest validation only; no Flowtake installer was downloaded or executed."
    exit 0
}

if ($Mode -eq "ValidateDefender") {
    Assert-Condition ($env:GITHUB_EVENT_NAME -eq "pull_request") "ValidateDefender mode is restricted to pull_request."
    $probePath = "C:\FlowtakeDefenderProbe-$([guid]::NewGuid().ToString('N')).txt"
    try {
        [System.IO.File]::WriteAllText($probePath, "Harmless Flowtake Defender scan-path probe.")
        Prepare-DefenderScan -TargetPath $probePath
        Invoke-DefenderScan -TargetPath $probePath -Label "harmless PR probe"
        Assert-Condition (Test-Path -LiteralPath $probePath -PathType Leaf) "Defender probe file disappeared after scanning."
        Write-Evidence "PASS: exclusion-independent Defender custom scan validated on a harmless file; no Flowtake installer was downloaded or executed."
    }
    finally {
        if (Test-Path -LiteralPath $probePath) {
            Remove-Item -LiteralPath $probePath -Force
        }
    }
    exit 0
}

Assert-Condition ($env:GITHUB_REF -eq "refs/heads/main") "Lifecycle mode is restricted to refs/heads/main."
Assert-Condition ($env:GITHUB_EVENT_NAME -eq "workflow_dispatch") "Lifecycle mode is restricted to workflow_dispatch."

$smokeRoot = "C:\FlowtakeSmoke-$([guid]::NewGuid().ToString('N'))"
$msiPath = Join-Path $smokeRoot $ExpectedMsiName
$checksumsPath = Join-Path $smokeRoot "SHA256SUMS.txt"
$wingetInstallLog = Join-Path $EvidenceDirectory "winget-install.log"
$wingetUninstallLog = Join-Path $EvidenceDirectory "winget-uninstall.log"
$fallbackUninstallLog = Join-Path $EvidenceDirectory "msi-fallback-uninstall.log"
$trackedProcess = $null
$primaryFailure = $null
$cleanupFailure = $null
$installObserved = $false

try {
    Assert-CleanInstallState
    New-Item -ItemType Directory -Path $smokeRoot | Out-Null
    Prepare-DefenderScan -TargetPath $smokeRoot

    $releaseHeaders = @{
        Accept = "application/vnd.github+json"
        "User-Agent" = "Flowtake-WinGet-Lifecycle-Proof"
        "X-GitHub-Api-Version" = "2022-11-28"
    }
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/JNX03/Flowtake/releases/tags/$ExpectedTag" -Headers $releaseHeaders
    Assert-Condition ($release.tag_name -eq $ExpectedTag) "GitHub release tag drifted."
    Assert-Condition (-not [bool]$release.draft) "GitHub release is a draft."
    Assert-Condition (-not [bool]$release.prerelease) "GitHub release is a prerelease."

    $msiAssets = @($release.assets | Where-Object { $_.name -eq $ExpectedMsiName })
    $checksumAssets = @($release.assets | Where-Object { $_.name -eq "SHA256SUMS.txt" })
    Assert-Condition ($msiAssets.Count -eq 1) "Expected exactly one MSI release asset."
    Assert-Condition ($checksumAssets.Count -eq 1) "Expected exactly one checksum release asset."
    $msiAsset = $msiAssets[0]
    $checksumAsset = $checksumAssets[0]
    Assert-Condition ($msiAsset.browser_download_url -eq $ExpectedMsiUrl) "GitHub MSI asset URL drifted."
    Assert-Condition ([int64]$msiAsset.size -eq $ExpectedMsiSize) "GitHub MSI asset size drifted."
    Assert-Condition ($msiAsset.digest -eq "sha256:$($ExpectedMsiSha256.ToLowerInvariant())") "GitHub MSI asset digest drifted."
    Assert-Condition ($checksumAsset.digest -eq "sha256:$($ExpectedChecksumsSha256.ToLowerInvariant())") "GitHub checksum asset digest drifted."

    Invoke-WebRequest -UseBasicParsing -MaximumRetryCount 3 -RetryIntervalSec 2 -Uri $checksumAsset.browser_download_url -OutFile $checksumsPath
    Invoke-WebRequest -UseBasicParsing -MaximumRetryCount 3 -RetryIntervalSec 2 -Uri $msiAsset.browser_download_url -OutFile $msiPath

    Assert-Condition ((Get-Item -LiteralPath $msiPath).Length -eq $ExpectedMsiSize) "Downloaded MSI size mismatch."
    $actualMsiSha256 = (Get-FileHash -LiteralPath $msiPath -Algorithm SHA256).Hash.ToUpperInvariant()
    Assert-Condition ($actualMsiSha256 -eq $ExpectedMsiSha256) "Downloaded MSI SHA-256 mismatch."
    $actualChecksumsSha256 = (Get-FileHash -LiteralPath $checksumsPath -Algorithm SHA256).Hash.ToUpperInvariant()
    Assert-Condition ($actualChecksumsSha256 -eq $ExpectedChecksumsSha256) "Downloaded checksum manifest SHA-256 mismatch."
    $checksumSource = Get-Content -Raw -LiteralPath $checksumsPath
    $escapedMsiName = [regex]::Escape($ExpectedMsiName)
    $checksumMatches = [regex]::Matches($checksumSource, "(?im)^(?<hash>[a-f0-9]{64})\s+\*?$escapedMsiName\s*$")
    Assert-Condition ($checksumMatches.Count -eq 1) "SHA256SUMS.txt must contain exactly one row for the MSI."
    Assert-Condition ($checksumMatches[0].Groups["hash"].Value.ToUpperInvariant() -eq $ExpectedMsiSha256) "SHA256SUMS.txt MSI digest mismatch."
    Write-Evidence "Exact published MSI verified before execution: $ExpectedMsiSha256, $ExpectedMsiSize bytes."

    $windowsInstaller = $null
    $database = $null
    try {
        $windowsInstaller = New-Object -ComObject WindowsInstaller.Installer
        $database = $windowsInstaller.OpenDatabase($msiPath, 0)
        $expectedProperties = @{
            ProductName = $ExpectedProductName
            ProductVersion = $ExpectedVersion
            Manufacturer = $ExpectedPublisher
            ProductCode = $ExpectedProductCode
            UpgradeCode = $ExpectedUpgradeCode
            ALLUSERS = "1"
        }
        foreach ($property in $expectedProperties.GetEnumerator()) {
            $actual = Get-MsiProperty -Database $database -Name $property.Key
            Assert-Condition ($actual -eq $property.Value) "MSI property $($property.Key) mismatch: $actual"
        }
    }
    finally {
        try {
            Release-ComObject -ComObject $database
        }
        finally {
            Release-ComObject -ComObject $windowsInstaller
        }
    }
    $signatureStatus = (Get-AuthenticodeSignature -LiteralPath $msiPath).Status.ToString()
    Assert-Condition ($signatureStatus -eq "NotSigned") "v1.6.0 MSI signing status drifted: $signatureStatus"
    Write-Evidence "MSI metadata matches product, version, publisher, product/upgrade codes, machine scope, and disclosed unsigned status."

    Prepare-DefenderScan -TargetPath $msiPath
    Invoke-DefenderScan -TargetPath $msiPath -Label "published Flowtake MSI"
    Assert-Condition (Test-Path -LiteralPath $msiPath -PathType Leaf) "MSI disappeared after Defender scan."
    Assert-Condition ((Get-Item -LiteralPath $msiPath).Length -eq $ExpectedMsiSize) "MSI size changed after Defender scan."
    $scannedMsiSha256 = (Get-FileHash -LiteralPath $msiPath -Algorithm SHA256).Hash.ToUpperInvariant()
    Assert-Condition ($scannedMsiSha256 -eq $ExpectedMsiSha256) "MSI changed after Defender scan."
    Assert-Condition ($scannedMsiSha256 -eq $manifestInstallerSha256) "Defender-scanned MSI SHA-256 does not match the tracked manifest."

    $localManifestSetting = Get-WinGetAdminSetting `
        -WinGetPath $wingetPath `
        -Name "LocalManifestFiles" `
        -LogPath (Join-Path $EvidenceDirectory "winget-settings-before-enable.log")
    Assert-Condition (-not $localManifestSetting) "LocalManifestFiles was already enabled before the lifecycle proof."
    Invoke-NativeChecked -FilePath $wingetPath -Arguments @("settings", "--enable", "LocalManifestFiles") -LogPath (Join-Path $EvidenceDirectory "winget-enable-local-manifests.log") | Out-Null
    $localManifestSetting = Get-WinGetAdminSetting `
        -WinGetPath $wingetPath `
        -Name "LocalManifestFiles" `
        -LogPath (Join-Path $EvidenceDirectory "winget-settings-after-enable.log")
    Assert-Condition $localManifestSetting "LocalManifestFiles did not become enabled."
    $installerHashOverride = Get-WinGetAdminSetting `
        -WinGetPath $wingetPath `
        -Name "InstallerHashOverride" `
        -LogPath (Join-Path $EvidenceDirectory "winget-settings-hash-override.log")
    Assert-Condition (-not $installerHashOverride) "WinGet InstallerHashOverride is enabled."
    Assert-Condition (Test-Path -LiteralPath $msiPath -PathType Leaf) "Scanned MSI is missing immediately before WinGet install."
    Assert-Condition ((Get-Item -LiteralPath $msiPath).Length -eq $ExpectedMsiSize) "Scanned MSI size changed immediately before WinGet install."
    $preInstallMsiSha256 = (Get-FileHash -LiteralPath $msiPath -Algorithm SHA256).Hash.ToUpperInvariant()
    Assert-Condition ($preInstallMsiSha256 -eq $scannedMsiSha256) "Scanned MSI changed immediately before WinGet install."
    Write-Evidence "Defender scanned published MSI content SHA-256 $scannedMsiSha256; the tracked manifest pins WinGet's installer download to that digest."
    $installResult = Invoke-NativeChecked -FilePath $wingetPath -Arguments @(
        "install", "--manifest", $ManifestDirectory,
        "--silent", "--scope", "machine", "--disable-interactivity",
        "--accept-package-agreements", "--accept-source-agreements",
        "--verbose-logs", "--log", $wingetInstallLog
    ) -LogPath (Join-Path $EvidenceDirectory "winget-install-command.log")
    Assert-Condition ($installResult.Output -match "(?i)\bSuccessfully verified installer hash\b") "WinGet did not report successful installer hash verification."
    Assert-Condition ($installResult.Output -notmatch "(?i)hash\s+(?:mismatch|override)|ignore-security-hash") "WinGet reported an installer hash mismatch or override."
    Write-Evidence "WinGet verified downloaded installer content SHA-256 $manifestInstallerSha256 before execution."
    $installObserved = $true

    Assert-Condition (Test-Path -LiteralPath $ExpectedUninstallKey) "Expected 64-bit ARP product key is missing after install."
    Assert-Condition (-not (Test-Path -LiteralPath $UnexpectedWowUninstallKey)) "Product was registered unexpectedly under WOW6432Node."
    $arp = Get-ItemProperty -LiteralPath $ExpectedUninstallKey
    Assert-Condition ($arp.DisplayName -eq $ExpectedProductName) "ARP DisplayName mismatch."
    Assert-Condition ($arp.DisplayVersion -eq $ExpectedVersion) "ARP DisplayVersion mismatch."
    Assert-Condition ($arp.Publisher -eq $ExpectedPublisher) "ARP Publisher mismatch."
    Assert-Condition ([int]$arp.WindowsInstaller -eq 1) "ARP WindowsInstaller marker mismatch."
    Assert-Condition ($arp.UninstallString -match [regex]::Escape($ExpectedProductCode)) "ARP uninstall command does not contain the expected product code."

    Assert-Condition (Test-Path -LiteralPath $ExpectedVendorKey) "Installer-owned HKCU vendor key is missing."
    $recordedInstallDir = (Get-ItemProperty -LiteralPath $ExpectedVendorKey -Name "InstallDir").InstallDir
    Assert-Condition ([System.IO.Path]::GetFullPath($recordedInstallDir).TrimEnd('\') -ieq $ExpectedInstallDirectory) "Installer HKCU InstallDir mismatch."
    Assert-Condition (Test-Path -LiteralPath $ExpectedExecutable -PathType Leaf) "Installed Flowtake executable is missing."
    $fileVersion = (Get-Item -LiteralPath $ExpectedExecutable).VersionInfo.FileVersion
    Assert-Condition ($fileVersion -eq $ExpectedFileVersion) "Installed executable version mismatch: $fileVersion"

    $requiredShortcuts = @(
        (Join-Path $env:USERPROFILE "Desktop\Flowtake.lnk"),
        (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Flowtake\Flowtake.lnk"),
        (Join-Path $ExpectedInstallDirectory "Uninstall Flowtake.lnk")
    )
    foreach ($shortcut in $requiredShortcuts) {
        Assert-Condition (Test-Path -LiteralPath $shortcut -PathType Leaf) "Expected installer shortcut is missing: $shortcut"
    }

    $listResult = Invoke-NativeChecked -FilePath $wingetPath -Arguments @(
        "list", "--name", $ExpectedProductName, "--exact", "--scope", "machine",
        "--accept-source-agreements", "--disable-interactivity"
    ) -LogPath (Join-Path $EvidenceDirectory "winget-list-installed.log")
    Assert-Condition ($listResult.Output -match "Flowtake") "WinGet list did not correlate the installed package name."
    Assert-Condition ($listResult.Output -match [regex]::Escape($ExpectedVersion)) "WinGet list did not correlate the installed version."
    Write-Evidence "Installation correlated across WinGet inventory, 64-bit ARP, MSI ProductCode, HKCU installer key, shortcuts, and executable metadata."

    Prepare-DefenderScan -TargetPath $ExpectedInstallDirectory
    Invoke-DefenderScan -TargetPath $ExpectedInstallDirectory -Label "installed Flowtake directory"
    Invoke-DefenderScan -TargetPath $ExpectedExecutable -Label "installed Flowtake executable"
    Assert-Condition (Test-Path -LiteralPath $ExpectedExecutable -PathType Leaf) "Installed executable disappeared after Defender scan."

    $trackedProcess = Start-Process -FilePath $ExpectedExecutable -PassThru
    Start-Sleep -Seconds 2
    $trackedProcess.Refresh()
    Assert-Condition (-not $trackedProcess.HasExited) "Flowtake exited during bounded startup."
    Assert-Condition ([System.IO.Path]::GetFullPath($trackedProcess.Path) -ieq $ExpectedExecutable) "Started process path mismatch."
    Start-Sleep -Seconds 10
    $trackedProcess.Refresh()
    Assert-Condition (-not $trackedProcess.HasExited) "Flowtake did not remain alive for the bounded startup interval."
    $launchedPid = $trackedProcess.Id
    Invoke-NativeChecked -FilePath "taskkill.exe" -Arguments @("/PID", "$launchedPid", "/T", "/F") -LogPath (Join-Path $EvidenceDirectory "taskkill.log") | Out-Null
    Start-Sleep -Seconds 2
    Assert-Condition (@(Get-FlowtakeProcesses).Count -eq 0) "Flowtake process remained after bounded startup cleanup."
    $trackedProcess = $null
    Write-Evidence "Exact installed executable remained alive for 10 seconds and its tracked PID tree was terminated."

    Invoke-NativeChecked -FilePath $wingetPath -Arguments @(
        "uninstall", "--manifest", $ManifestDirectory,
        "--silent", "--disable-interactivity", "--accept-source-agreements",
        "--verbose-logs", "--log", $wingetUninstallLog
    ) -LogPath (Join-Path $EvidenceDirectory "winget-uninstall-command.log") | Out-Null
    $installObserved = $false
    Start-Sleep -Seconds 3
    Assert-CleanInstallState -AfterUninstall
    Write-Evidence "WinGet manifest uninstall removed the MSI product, installer-owned registry state, shortcuts, files, and process."
}
catch {
    $primaryFailure = $_
}
finally {
    $cleanupErrors = [System.Collections.Generic.List[string]]::new()

    try {
        if ($null -ne $trackedProcess) {
            $trackedProcess.Refresh()
            if (-not $trackedProcess.HasExited) {
                Invoke-NativeChecked `
                    -FilePath "taskkill.exe" `
                    -Arguments @("/PID", "$($trackedProcess.Id)", "/T", "/F") `
                    -LogPath (Join-Path $EvidenceDirectory "taskkill-finally.log") | Out-Null
            }
        }
    }
    catch {
        $cleanupErrors.Add("tracked process termination: $($_.Exception.Message)")
    }

    try {
        if (
            $installObserved -or
            (Test-Path -LiteralPath $ExpectedUninstallKey) -or
            (Test-Path -LiteralPath $UnexpectedWowUninstallKey) -or
            (Test-Path -LiteralPath $ExpectedExecutable) -or
            (Test-Path -LiteralPath $ExpectedInstallDirectory) -or
            (Test-Path -LiteralPath $ExpectedVendorKey)
        ) {
            Invoke-NativeChecked -FilePath "msiexec.exe" -Arguments @(
                "/x", $ExpectedProductCode, "/qn", "/norestart", "/L*V", $fallbackUninstallLog
            ) -LogPath (Join-Path $EvidenceDirectory "msi-fallback-uninstall-command.log") -AllowedExitCodes @(0, 1605, 3010) | Out-Null
        }
    }
    catch {
        $cleanupErrors.Add("fallback MSI uninstall: $($_.Exception.Message)")
    }

    foreach ($runtimePath in @(
        (Join-Path $env:APPDATA "com.flowtake.desktop"),
        (Join-Path $env:LOCALAPPDATA "com.flowtake.desktop")
    )) {
        try {
            if (Test-Path -LiteralPath $runtimePath) {
                Remove-Item -LiteralPath $runtimePath -Recurse -Force
            }
        }
        catch {
            $cleanupErrors.Add("runtime path removal ($runtimePath): $($_.Exception.Message)")
        }
    }

    try {
        if (Test-Path -LiteralPath $smokeRoot) {
            Remove-Item -LiteralPath $smokeRoot -Recurse -Force
        }
    }
    catch {
        $cleanupErrors.Add("smoke directory removal: $($_.Exception.Message)")
    }

    try {
        Invoke-NativeChecked `
            -FilePath $wingetPath `
            -Arguments @("settings", "--disable", "LocalManifestFiles") `
            -LogPath (Join-Path $EvidenceDirectory "winget-disable-local-manifests.log") | Out-Null
        $localManifestSetting = Get-WinGetAdminSetting `
            -WinGetPath $wingetPath `
            -Name "LocalManifestFiles" `
            -LogPath (Join-Path $EvidenceDirectory "winget-settings-after-disable.log")
        Assert-Condition (-not $localManifestSetting) "LocalManifestFiles remained enabled after cleanup."
    }
    catch {
        $cleanupErrors.Add("LocalManifestFiles restoration: $($_.Exception.Message)")
    }

    try {
        Assert-CleanInstallState -AfterUninstall
    }
    catch {
        $cleanupErrors.Add("final install-state assertion: $($_.Exception.Message)")
    }

    if ($cleanupErrors.Count -gt 0) {
        try {
            throw "Cleanup failed: $($cleanupErrors -join ' | ')"
        }
        catch {
            $cleanupFailure = $_
        }
    }
}

if ($null -ne $primaryFailure) {
    Write-Error "Lifecycle proof failed: $($primaryFailure.Exception.Message)" -ErrorAction Continue
    if ($null -ne $cleanupFailure) {
        Write-Error "Cleanup also failed: $($cleanupFailure.Exception.Message)" -ErrorAction Continue
    }
    Write-FailureLogTails
    throw $primaryFailure
}

if ($null -ne $cleanupFailure) {
    Write-FailureLogTails
    throw $cleanupFailure
}

Write-Evidence "PASS: exact-manifest validation, published-asset integrity, exclusion-independent Defender on-demand scans, silent install, correlation, bounded startup, WinGet uninstall, and cleanup all passed."

if ($env:GITHUB_STEP_SUMMARY) {
    @(
        "## Flowtake Windows MSI lifecycle proof",
        "",
        "- Result: PASS",
        "- Package: ``$PackageIdentifier $ExpectedVersion``",
        "- MSI SHA-256: ``$ExpectedMsiSha256``",
        "- ProductCode: ``$ExpectedProductCode``",
        "- Runner: ``$($env:ImageOS) $($env:ImageVersion)``",
        "- WinGet: ``$wingetVersion``",
        "- Evidence: manifest validation, release digest/checksum, MSI metadata, exclusion-independent Defender on-demand scans, install/registry correlation, 10-second startup, uninstall, and cleanup"
    ) | Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Encoding utf8
}
