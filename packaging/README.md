# Flowtake package-manager preparation

This directory contains local packaging and submission-preparation assets. It
does not publish Flowtake, open catalog pull requests, or imply that a package
has been accepted by an external catalog.

## Current package status

| Channel | Status | Source artifact |
| --- | --- | --- |
| WinGet | Published as `JNX03.Flowtake` | Windows x64 MSI |
| Scoop | Local manifest prepared; external package request not submitted | Windows x64 portable ZIP |
| Chocolatey | Local package prepared; community package not submitted | Windows x64 MSI |
| Homebrew | Deferred | Requires a Developer ID-signed and notarized macOS release |

The WinGet package is already published. Do not create a second package ID or
resubmit version `1.6.0`; future releases should update `JNX03.Flowtake`.

## Important release gates

- Release URLs must remain immutable, and every package checksum must match the
  corresponding GitHub release asset.
- Windows installers are not currently Authenticode-signed. Treat code signing
  and reputation checks as a gate before broadly promoting the Scoop or
  Chocolatey packages.
- Do not prepare or submit a Homebrew Cask until the macOS application is signed
  with a Developer ID certificate, notarized by Apple, stapled, and verified
  with both `codesign` and `spctl`.
- Flowtake currently offers to download and launch a GitHub release installer
  from inside the application. A package-manager install must not silently
  switch installation channels. Before publishing the Scoop or Chocolatey
  packages, add and test a managed-update mode that reports available releases
  but tells users to update through their package manager.
- Opening Scoop, Chocolatey, Homebrew, or other external submissions requires a
  separate, explicit release decision.

## Scoop

The manifest is at [`scoop/flowtake.json`](scoop/flowtake.json). It installs the
portable release and creates a Start menu shortcut to
`Flowtake\Flowtake.exe`.

Validate in a disposable Windows environment with Scoop installed:

```powershell
ConvertFrom-Json (Get-Content -LiteralPath .\packaging\scoop\flowtake.json -Raw) | Out-Null
scoop install .\packaging\scoop\flowtake.json

# Launch Flowtake and verify recording, preview, export, and managed-update UX.

scoop uninstall flowtake
```

Before any Scoop Extras submission, open the required package-request issue,
wait for approval, then validate `checkver` and `autoupdate` from a Scoop bucket:

```powershell
.\bin\checkver.ps1 flowtake <bucket-directory>
.\bin\checkver.ps1 flowtake <bucket-directory> -u
```

Confirm that the `SHA256SUMS.txt` lookup selects the checksum for
`Flowtake-windows-x64-portable.zip`.

## Chocolatey

The package sources are under [`chocolatey`](chocolatey). Chocolatey's automatic
uninstaller should use the MSI registration, so an explicit uninstall script is
not included.

Validate in a disposable, elevated Windows virtual machine:

```powershell
[xml](Get-Content -LiteralPath .\packaging\chocolatey\flowtake.nuspec -Raw) | Out-Null
choco pack .\packaging\chocolatey\flowtake.nuspec --output-directory .\artifacts\packaging\chocolatey
choco install flowtake --source .\artifacts\packaging\chocolatey --debug --verbose

# Launch Flowtake and verify recording, preview, export, and managed-update UX.

choco uninstall flowtake
```

After uninstalling, verify that the MSI registration and installed application
files have been removed. Add Chocolatey verification documentation and complete
its package validator and moderation checks before any community submission.

## Updating these package files

For each release:

1. Publish immutable release assets and `SHA256SUMS.txt`.
2. Download the assets independently and verify their SHA-256 digests.
3. Update the package version, asset URLs, and checksums together.
4. Run local install, launch, core recording/export, upgrade, and uninstall
   tests in disposable environments.
5. Submit externally only after the release owner explicitly approves the
   channel and the relevant signing and updater gates are satisfied.
