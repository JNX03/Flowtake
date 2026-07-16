# Installation

## Download

Download the latest installer from the [Releases page](https://github.com/Jnx03/Flowtake/releases).

Available installer formats:

| Platform | Format |
|----------|--------|
| Windows 10/11 | `.exe` (NSIS installer) or `.msi` |
| macOS | `.dmg` |

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **OS** | Windows 10 64-bit / macOS 11 | Windows 11 / macOS 13+ |
| **RAM** | 4 GB | 8 GB |
| **Storage** | 200 MB | 500 MB (for projects) |
| **GPU** | Any | Hardware-accelerated GPU for smooth preview |

## Windows Installation

Install from the public WinGet catalog:

```powershell
winget install --id JNX03.Flowtake -e --source winget
```

Alternatively, download the `.exe` or `.msi` from the official GitHub release and verify the published checksum before running it. Flowtake will appear in your Start Menu after installation.

> **Note**: Current Windows artifacts are not Authenticode-signed. If Windows blocks execution, stop and verify that the package came from WinGet or the official GitHub release and that its checksum matches. Do not bypass a warning for an unverified copy.

## macOS Installation

1. Download the `.dmg` file
2. Open the DMG and drag Flowtake to your Applications folder
3. Current builds are ad-hoc signed and not notarized. If Gatekeeper blocks the app, stop and verify the official release source and checksum before deciding whether to proceed.

## Uninstall

**Windows**: Use **Add or Remove Programs** in Settings and search for Flowtake.

**macOS**: Drag Flowtake from Applications to the Trash.
