import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import yaml from "js-yaml"

const workflowSource = await readFile(
    new URL("../.github/workflows/windows-msi-lifecycle.yml", import.meta.url),
    "utf8"
)
const lifecycleScript = await readFile(
    new URL("../scripts/test-windows-msi-lifecycle.ps1", import.meta.url),
    "utf8"
)
const manifestRoot = new URL("../packaging/winget/JNX03.Flowtake/1.6.0/", import.meta.url)
const versionManifestSource = await readFile(new URL("JNX03.Flowtake.yaml", manifestRoot), "utf8")
const localeManifestSource = await readFile(new URL("JNX03.Flowtake.locale.en-US.yaml", manifestRoot), "utf8")
const installerManifestSource = await readFile(new URL("JNX03.Flowtake.installer.yaml", manifestRoot), "utf8")
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))

const workflow = yaml.load(workflowSource)
const versionManifest = yaml.load(versionManifestSource)
const localeManifest = yaml.load(localeManifestSource)
const installerManifest = yaml.load(installerManifestSource)

const expected = {
    identifier: "JNX03.Flowtake",
    version: "1.6.0",
    productCode: "{CEB7F435-02D2-41EF-8B21-28D9E7D3E5CB}",
    upgradeCode: "{CE51BD38-DC3B-53D2-881E-5413CF117167}",
    msiName: "Flowtake_1.6.0_x64_en-US.msi",
    msiUrl: "https://github.com/JNX03/Flowtake/releases/download/v1.6.0/Flowtake_1.6.0_x64_en-US.msi",
    msiSha256: "497FE1454687EE1224FC839C2290A44471041DB7490E72F55EE14464ADD61B8D",
}

test("tracked WinGet manifests describe the exact reviewed release", () => {
    assert.equal(packageJson.version, expected.version)

    for (const manifest of [versionManifest, localeManifest, installerManifest]) {
        assert.equal(manifest.PackageIdentifier, expected.identifier)
        assert.equal(manifest.PackageVersion, expected.version)
        assert.equal(manifest.ManifestVersion, "1.12.0")
    }

    assert.equal(versionManifest.DefaultLocale, "en-US")
    assert.equal(versionManifest.ManifestType, "version")
    assert.equal(localeManifest.Publisher, "Jnx03")
    assert.equal(localeManifest.PackageName, "Flowtake")
    assert.equal(localeManifest.License, "MIT")
    assert.equal(
        localeManifest.PrivacyUrl,
        "https://github.com/JNX03/Flowtake/blob/v1.6.0/README.md#privacy-and-open-source-boundary"
    )
    assert.equal(localeManifest.ManifestType, "defaultLocale")

    assert.equal(installerManifest.InstallerType, "wix")
    assert.equal(installerManifest.Scope, "machine")
    assert.equal(installerManifest.ProductCode, expected.productCode)
    assert.equal(installerManifest.ManifestType, "installer")
    assert.equal(installerManifest.Installers.length, 1)
    assert.deepEqual(installerManifest.Installers[0], {
        Architecture: "x64",
        InstallerUrl: expected.msiUrl,
        InstallerSha256: expected.msiSha256,
    })
})

test("MSI execution is restricted to a manual main-branch dispatch", () => {
    assert.deepEqual(Object.keys(workflow.on).sort(), ["pull_request", "workflow_dispatch"])
    assert.equal(workflow.on.pull_request.branches[0], "main")
    assert.equal(workflow.on.pull_request.paths.includes("packaging/winget/**"), true)
    assert.equal(workflow.push, undefined)
    assert.equal(workflow.schedule, undefined)
    assert.doesNotMatch(workflowSource, /pull_request_target|\bschedule\s*:|\bpush\s*:/)
    assert.deepEqual(workflow.permissions, { contents: "read" })

    const validationJob = workflow.jobs["validate-manifest"]
    const lifecycleJob = workflow.jobs["installer-lifecycle"]
    assert.equal(validationJob["runs-on"], "windows-2025")
    assert.equal(lifecycleJob["runs-on"], "windows-2025")
    assert.equal(
        lifecycleJob.if,
        "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'"
    )
    assert.match(
        validationJob.steps.find(step => step.name === "Require main for a lifecycle dispatch").run,
        /GITHUB_REF -ne "refs\/heads\/main"/
    )
    assert.match(
        validationJob.steps.find(step => step.name === "Validate immutable package metadata").run,
        /-Mode ValidateManifest/
    )
    const defenderProbe = validationJob.steps.find(
        step => step.name === "Verify exclusion-independent Defender custom scan"
    )
    assert.equal(defenderProbe.if, "github.event_name == 'pull_request'")
    assert.equal(defenderProbe.shell, "pwsh")
    assert.match(defenderProbe.run, /-Mode ValidateDefender/)
    assert.match(
        lifecycleJob.steps.find(step => step.name === "Prove the exact published MSI lifecycle").run,
        /-Mode Lifecycle/
    )
})

test("installer proof uses immutable actions and a pinned official WinGet bootstrap", () => {
    const actionRefs = [...workflowSource.matchAll(/uses:\s+([^@\s]+)@([^\s#]+)/g)]
    assert.deepEqual(
        actionRefs.map(([, action, ref]) => ({ action, ref })),
        [
            { action: "actions/checkout", ref: "9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0" },
            { action: "actions/checkout", ref: "9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0" },
        ]
    )
    assert.equal(workflowSource.match(/persist-credentials: false/g)?.length, 2)
    const bootstrapSteps = Object.values(workflow.jobs).map(job =>
        job.steps.find(step => step.name === "Provision the pinned Microsoft WinGet client")
    )
    assert.equal(bootstrapSteps.length, 2)
    assert.equal(bootstrapSteps.every(step => step?.shell === "powershell"), true)
    assert.equal(bootstrapSteps.every(step => step?.run.includes('$ProgressPreference = "SilentlyContinue"')), true)
    assert.doesNotMatch(bootstrapSteps.map(step => step.run).join("\n"), /MaximumRetryCount|RetryIntervalSec/)
    assert.equal(workflow.env.WINGET_BOOTSTRAP_VERSION, "1.29.280")
    assert.equal(workflow.env.WINGET_PACKAGE_VERSION, "1.29.280.0")
    assert.equal(
        workflow.env.WINGET_BUNDLE_URL,
        "https://github.com/microsoft/winget-cli/releases/download/v1.29.280/Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle"
    )
    assert.equal(workflow.env.WINGET_BUNDLE_SIZE, "216775738")
    assert.equal(
        workflow.env.WINGET_BUNDLE_SHA256,
        "0809FA9F52E395D6E7DE692331DCE847AC991952675116BB4D8AAE2DDCC20946"
    )
    assert.equal(
        workflow.env.WINGET_DEPENDENCIES_URL,
        "https://github.com/microsoft/winget-cli/releases/download/v1.29.280/DesktopAppInstaller_Dependencies.zip"
    )
    assert.equal(workflow.env.WINGET_DEPENDENCIES_SIZE, "97760717")
    assert.equal(
        workflow.env.WINGET_DEPENDENCIES_SHA256,
        "3BBFCAA5CB011C48FAC48D896D64A5C7C6898859A9F3D01555C8CD000F4E2962"
    )
    assert.equal(workflowSource.match(/Get-FileHash[^\n]+-Algorithm SHA256/g)?.length, 4)
    assert.equal(workflowSource.match(/Add-AppxPackage/g)?.length, 2)
    assert.equal(workflowSource.match(/-DependencyPath \$dependencyPaths/g)?.length, 2)
    assert.equal(workflowSource.match(/Get-AppxPackage -Name Microsoft\.DesktopAppInstaller/g)?.length, 2)
    assert.equal(workflowSource.match(/PackageFamilyName -eq "Microsoft\.DesktopAppInstaller_8wekyb3d8bbwe"/g)?.length, 2)
    assert.equal(workflowSource.match(/PublisherId -eq "8wekyb3d8bbwe"/g)?.length, 2)
    for (const dependencyName of [
        "Microsoft.VCLibs.140.00_14.0.33519.0_x64.appx",
        "Microsoft.VCLibs.140.00.UWPDesktop_14.0.33728.0_x64.appx",
        "Microsoft.WindowsAppRuntime.1.8_8000.616.304.0_x64.appx",
    ]) {
        assert.equal(workflowSource.match(new RegExp(dependencyName.replaceAll(".", "\\."), "g"))?.length, 2)
    }
    assert.doesNotMatch(
        workflowSource,
        /continue-on-error|contents:\s*write|secrets\.|pull_request_target|RegisterByFamilyName|Repair-WinGetPackageManager|WINGET_MODULE|Install-Module|Install-PackageProvider|Set-PSRepository/
    )
})

test("lifecycle script fails closed around integrity, Defender, install, and cleanup", () => {
    for (const immutableValue of [
        expected.identifier,
        expected.version,
        expected.productCode,
        expected.upgradeCode,
        expected.msiUrl,
        expected.msiSha256,
        "92131328",
        "34DFA1267068590F277E5A172E5538159FF809A94D364812CAF3DA6CFBCB3B16",
    ]) {
        assert.ok(lifecycleScript.includes(immutableValue), `missing immutable lifecycle value: ${immutableValue}`)
    }

    const checksumIndex = lifecycleScript.indexOf("Downloaded MSI SHA-256 mismatch")
    const preDownloadDefenderIndex = lifecycleScript.indexOf('Prepare-DefenderScan -TargetPath $smokeRoot')
    const firstFlowtakeDownloadIndex = lifecycleScript.indexOf("Invoke-WebRequest -UseBasicParsing -MaximumRetryCount")
    const firstInstallerExecution = lifecycleScript.indexOf('"install", "--manifest"')
    const msiDefenderIndex = lifecycleScript.indexOf('Invoke-DefenderScan -TargetPath $msiPath')
    const scannedHashIndex = lifecycleScript.indexOf("$scannedMsiSha256 =")
    const manifestHashCorrelationIndex = lifecycleScript.indexOf("$scannedMsiSha256 -eq $manifestInstallerSha256")
    const installerHashOverrideIndex = lifecycleScript.indexOf('-Name "InstallerHashOverride"')
    const preInstallHashIndex = lifecycleScript.indexOf("$preInstallMsiSha256 =")
    const installedDefenderIndex = lifecycleScript.indexOf('Invoke-DefenderScan -TargetPath $ExpectedInstallDirectory')
    const executableDefenderIndex = lifecycleScript.indexOf('Invoke-DefenderScan -TargetPath $ExpectedExecutable')
    const launchIndex = lifecycleScript.indexOf("Start-Process -FilePath $ExpectedExecutable")
    const uninstallIndex = lifecycleScript.indexOf('"uninstall", "--manifest"')
    const outerCatchIndex = lifecycleScript.indexOf("$primaryFailure = $_")
    const finallyIndex = lifecycleScript.indexOf("finally {", outerCatchIndex)
    const fallbackUninstallIndex = lifecycleScript.indexOf("Invoke-MsiUninstallChecked", finallyIndex)
    const finalCleanStateIndex = lifecycleScript.lastIndexOf("Wait-CleanInstallState")

    assert.ok(preDownloadDefenderIndex >= 0 && preDownloadDefenderIndex < firstFlowtakeDownloadIndex)
    assert.ok(firstFlowtakeDownloadIndex < checksumIndex)
    assert.ok(checksumIndex < msiDefenderIndex)
    assert.ok(msiDefenderIndex < scannedHashIndex)
    assert.ok(scannedHashIndex < manifestHashCorrelationIndex)
    assert.ok(manifestHashCorrelationIndex < installerHashOverrideIndex)
    assert.ok(installerHashOverrideIndex < preInstallHashIndex)
    assert.ok(preInstallHashIndex < firstInstallerExecution)
    assert.ok(firstInstallerExecution < installedDefenderIndex)
    assert.ok(installedDefenderIndex < executableDefenderIndex)
    assert.ok(executableDefenderIndex < launchIndex)
    assert.ok(launchIndex < uninstallIndex)
    assert.ok(outerCatchIndex > uninstallIndex)
    assert.ok(finallyIndex > outerCatchIndex && fallbackUninstallIndex > finallyIndex)
    assert.ok(finalCleanStateIndex > fallbackUninstallIndex)

    for (const requiredBoundary of [
        'GITHUB_REF -eq "refs/heads/main"',
        'GITHUB_EVENT_NAME -eq "workflow_dispatch"',
        'GITHUB_EVENT_NAME -eq "pull_request"',
        "Get-MpComputerStatus",
        "Update-MpSignature",
        "function Test-DefenderSignatureFresh",
        "[uint64]$ageProperty.Value",
        "AddHours(-48)",
        "AddMinutes(5)",
        "function Get-DefenderStatusWithRetry",
        "for ($attempt = 1; $attempt -le 3; $attempt++)",
        "Update-MpSignature -UpdateSource MMPC -ErrorAction Stop",
        '"-SignatureUpdate", "-MMPC"',
        "for ($poll = 1; $poll -le 6; $poll++)",
        "Defender signatures are stale or missing after bounded update attempts",
        "AntivirusEnabled",
        "AMRunningMode",
        "AMEngineVersion",
        "RealTimeProtectionEnabled",
        "observed only, not used as a custom-scan prerequisite or claimed as installer-write coverage",
        '"-Scan", "-ScanType", "3", "-File", $resolvedTarget, "-DisableRemediation"',
        "-AllowedExitCodes @(0)",
        "Scan finished",
        '[regex]::Escape($resolvedTarget)',
        "found no threats",
        "PASS: exclusion-independent Defender custom scan validated on a harmless file; no Flowtake installer was downloaded or executed",
        "Prepare-DefenderScan -TargetPath $msiPath",
        "Prepare-DefenderScan -TargetPath $ExpectedInstallDirectory",
        "Invoke-DefenderScan -TargetPath $ExpectedExecutable",
        "Defender-scanned MSI SHA-256 does not match the tracked manifest",
        '-Name "InstallerHashOverride"',
        "WinGet InstallerHashOverride is enabled",
        "Scanned MSI size changed immediately before WinGet install",
        "Scanned MSI changed immediately before WinGet install",
        "Successfully verified installer hash",
        "WinGet did not report successful installer hash verification",
        "WindowsInstaller",
        "$windowsInstaller.OpenDatabase($msiPath, 0)",
        "FinalReleaseComObject",
        'InvokeMember("Close", "InvokeMethod"',
        "DisplayVersion",
        "$ExpectedFileVersion = $ExpectedVersion",
        "Assert-Condition ($fileVersion -eq $ExpectedFileVersion)",
        "[Environment+SpecialFolder]::CommonDesktopDirectory",
        "[Environment+SpecialFolder]::CommonPrograms",
        "$ExpectedUninstallShortcut = Join-Path $ExpectedInstallDirectory",
        "UninstallString",
        "WinGet list did not correlate",
        "Start-Sleep -Seconds 10",
        "Assert-CleanInstallState -AfterUninstall",
        "function Invoke-MsiUninstallChecked",
        'Join-Path $env:SystemRoot "System32\\msiexec.exe"',
        "The trusted System32 msiexec.exe is unavailable",
        "[System.Diagnostics.ProcessStartInfo]::new()",
        "$startInfo.FileName = $msiExecPath",
        "$startInfo.UseShellExecute = $false",
        "$startInfo.ArgumentList.Add($argument)",
        "$process.WaitForExit(120000)",
        "msiexec.exe did not exit within 120 seconds",
        "$exitCode = $process.ExitCode",
        "$AllowedExitCodes -notcontains $exitCode",
        "msiexec.exe completed with exit code",
        "function Wait-CleanInstallState",
        "for ($attempt = 1; $attempt -le $Attempts; $attempt++)",
        "Install state did not become clean after $Attempts bounded checks",
        '-Arguments @("settings", "--disable", "LocalManifestFiles")',
        'winget-settings-after-disable.log',
        "Could not inspect flowtake process",
        'Write-Error "Lifecycle proof failed: $($primaryFailure.Exception.Message)" -ErrorAction Continue',
        'Write-Error "Cleanup also failed: $($cleanupFailure.Exception.Message)" -ErrorAction Continue',
    ]) {
        assert.ok(lifecycleScript.includes(requiredBoundary), `missing fail-closed boundary: ${requiredBoundary}`)
    }

    assert.doesNotMatch(
        lifecycleScript,
        /continue-on-error|LocalArchiveMalwareScanOverride|Win32_Product|\|\|\s*true|"--product-code"|-ReturnHR|Start-MpScan|Get-MpThreatDetection|Remove-MpPreference|Set-MpPreference|Get-MpPreference|-CheckExclusion/
    )
    assert.doesNotMatch(lifecycleScript, /["']--ignore-security-hash["']/)
    assert.doesNotMatch(lifecycleScript, /while\s*\(/)
    assert.doesNotMatch(lifecycleScript, /&\s+\$wingetPath\s+settings\s+--disable/)
    assert.doesNotMatch(lifecycleScript, /InvokeMember\("OpenDatabase"/)
    assert.doesNotMatch(lifecycleScript, /Invoke-NativeChecked\s+-FilePath\s+["']msiexec\.exe["']/)
    assert.doesNotMatch(lifecycleScript, /\$ExpectedFileVersion\s*=\s*["'][^"']+["']/)

    const msiUninstallHelper = lifecycleScript.slice(
        lifecycleScript.indexOf("function Invoke-MsiUninstallChecked"),
        lifecycleScript.indexOf("function Release-ComObject")
    )
    assert.doesNotMatch(msiUninstallHelper, /3010/)

    const fallbackInvocation = lifecycleScript.slice(fallbackUninstallIndex, finalCleanStateIndex)
    assert.match(fallbackInvocation, /-AllowedExitCodes @\(0, 1605\)/)
    assert.doesNotMatch(fallbackInvocation, /3010/)

    const cleanStateAssertion = lifecycleScript.slice(
        lifecycleScript.indexOf("function Assert-CleanInstallState"),
        lifecycleScript.indexOf("function Wait-CleanInstallState")
    )
    assert.match(cleanStateAssertion, /\$ExpectedDesktopShortcut,\r?\n\s*\$ExpectedStartMenuShortcut/)

    const installedShortcutAssertion = lifecycleScript.slice(
        lifecycleScript.indexOf("$requiredShortcuts = @("),
        lifecycleScript.indexOf("foreach ($shortcut in $requiredShortcuts)")
    )
    assert.match(
        installedShortcutAssertion,
        /\$ExpectedDesktopShortcut,\r?\n\s*\$ExpectedStartMenuShortcut,\r?\n\s*\$ExpectedUninstallShortcut/
    )
    assert.doesNotMatch(
        lifecycleScript,
        /\$env:USERPROFILE\s+"Desktop\\Flowtake\.lnk"|\$env:APPDATA\s+"Microsoft\\Windows\\Start Menu\\Programs\\Flowtake\\Flowtake\.lnk"/
    )

    const defenderScan = lifecycleScript.slice(
        lifecycleScript.indexOf("function Invoke-DefenderScan"),
        lifecycleScript.indexOf("function Write-FailureLogTails")
    )
    assert.match(defenderScan, /-AllowedExitCodes @\(0\)/)
    assert.doesNotMatch(defenderScan, /-AllowedExitCodes @\([^)]*[1-9]/)
})
