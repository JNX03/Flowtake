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
    assert.equal(workflow.env.WINGET_BOOTSTRAP_VERSION, "1.29.280")
    assert.equal(
        workflow.env.WINGET_MODULE_URL,
        "https://www.powershellgallery.com/api/v2/package/Microsoft.WinGet.Client/1.29.280"
    )
    assert.equal(workflow.env.WINGET_MODULE_SIZE, "20883488")
    assert.equal(
        workflow.env.WINGET_MODULE_SHA512,
        "DE5818DA64D4362904FFE35737A2D7DFC7179CB4D248E5816CE89AFE7E08C0A8AC63012F5489095F49724E1BEC0EAA2E53A90593AEF204979DE6CB27534A91A6"
    )
    assert.equal(workflowSource.match(/Microsoft\.WinGet\.Client/g)?.length >= 6, true)
    assert.equal(workflowSource.match(/Get-FileHash[^\n]+-Algorithm SHA512/g)?.length, 2)
    assert.equal(workflowSource.match(/Test-ModuleManifest -Path \$moduleManifest/g)?.length, 2)
    assert.match(workflowSource, /Repair-WinGetPackageManager/g)
    assert.match(workflowSource, /\$module\.Author -ne "Microsoft Corporation"/m)
    assert.doesNotMatch(
        workflowSource,
        /continue-on-error|contents:\s*write|secrets\.|pull_request_target|Add-AppxPackage|Install-Module|Install-PackageProvider|Set-PSRepository/
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
    const firstInstallerExecution = lifecycleScript.indexOf('"install", "--manifest"')
    const msiDefenderIndex = lifecycleScript.indexOf('Invoke-DefenderScan -TargetPath $msiPath')
    const installedDefenderIndex = lifecycleScript.indexOf('Invoke-DefenderScan -TargetPath $ExpectedInstallDirectory')
    const launchIndex = lifecycleScript.indexOf("Start-Process -FilePath $ExpectedExecutable")
    const uninstallIndex = lifecycleScript.indexOf('"uninstall", "--manifest"')
    const finallyIndex = lifecycleScript.indexOf("finally {")
    const fallbackUninstallIndex = lifecycleScript.indexOf('"msiexec.exe"', finallyIndex)

    assert.ok(checksumIndex >= 0 && checksumIndex < msiDefenderIndex)
    assert.ok(msiDefenderIndex < firstInstallerExecution)
    assert.ok(firstInstallerExecution < installedDefenderIndex)
    assert.ok(installedDefenderIndex < launchIndex)
    assert.ok(launchIndex < uninstallIndex)
    assert.ok(finallyIndex >= 0 && fallbackUninstallIndex > finallyIndex)

    for (const requiredBoundary of [
        'GITHUB_REF -eq "refs/heads/main"',
        'GITHUB_EVENT_NAME -eq "workflow_dispatch"',
        "Get-MpComputerStatus",
        "Remove-MpPreference -ExclusionPath",
        "-DisableRealtimeMonitoring $false",
        "Update-MpSignature",
        "AntivirusEnabled",
        "RealTimeProtectionEnabled",
        "AMRunningMode",
        "Start-MpScan -ScanType CustomScan",
        "Get-MpThreatDetection",
        "Get-MpThreatDetection -ErrorAction Stop",
        '"-CheckExclusion", "-Path", $TargetPath',
        "-AllowedExitCodes @(1)",
        "is not excluded",
        "Enable-DefenderForTarget -TargetPath $msiPath",
        "Enable-DefenderForTarget -TargetPath $ExpectedInstallDirectory",
        "Assert-DefenderTargetNotExcluded -TargetPath $ExpectedExecutable",
        "WindowsInstaller",
        "$windowsInstaller.OpenDatabase($msiPath, 0)",
        "FinalReleaseComObject",
        'InvokeMember("Close", "InvokeMethod"',
        "DisplayVersion",
        "UninstallString",
        "WinGet list did not correlate",
        "Start-Sleep -Seconds 10",
        "Assert-CleanInstallState -AfterUninstall",
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
        /continue-on-error|ignore-security-hash|LocalArchiveMalwareScanOverride|InstallerHashOverride|Win32_Product|\|\|\s*true|"--product-code"/
    )
    assert.doesNotMatch(lifecycleScript, /Get-MpThreatDetection[^\r\n]*SilentlyContinue/)
    assert.doesNotMatch(lifecycleScript, /&\s+\$wingetPath\s+settings\s+--disable/)
    assert.doesNotMatch(lifecycleScript, /InvokeMember\("OpenDatabase"/)

    const exclusionCheck = lifecycleScript.slice(
        lifecycleScript.indexOf("function Assert-DefenderTargetNotExcluded"),
        lifecycleScript.indexOf("function Enable-DefenderForTarget")
    )
    assert.match(exclusionCheck, /-AllowedExitCodes @\(1\)/)
    assert.doesNotMatch(exclusionCheck, /-AllowedExitCodes @\([^)]*0/)
})
