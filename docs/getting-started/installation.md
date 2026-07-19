# Installation

## Download

Download the latest installer from the [Releases page](https://github.com/JNX03/Flowtake/releases).

Available installer formats:

| Platform | Format |
|----------|--------|
| Windows 10/11 | `.exe` (NSIS installer) or `.msi` |
| macOS | `.dmg` |
| Linux | `.AppImage`, `.deb`, or `.rpm` |

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **OS** | Windows 10 64-bit / macOS 11 | Windows 11 / macOS 13+ |
| **RAM** | 4 GB | 8 GB |
| **Storage** | 200 MB | 500 MB (for projects) |
| **GPU** | Any | Hardware-accelerated GPU for smooth preview |

## Windows Installation

Install the published [WinGet package](https://github.com/microsoft/winget-pkgs/tree/master/manifests/j/JNX03/Flowtake/1.6.0):

```powershell
winget install --id JNX03.Flowtake --exact
```

Alternatively:

1. Download the `.exe` or `.msi` installer from the official Releases page
2. Run the installer and follow the on-screen steps
3. Flowtake will appear in your Start Menu

> **Note**: The current Windows artifacts are not Authenticode-signed, so Windows may show a SmartScreen warning. Install only a copy obtained from the official Releases page or through the published WinGet manifest.

## macOS Installation

1. Download the `.dmg` file
2. Open the DMG and drag Flowtake to your Applications folder
3. On first launch, right-click the app and choose **Open** to bypass Gatekeeper

## Uninstall

**Windows**: Use **Add or Remove Programs** in Settings and search for Flowtake.

**macOS**: Drag Flowtake from Applications to the Trash.
