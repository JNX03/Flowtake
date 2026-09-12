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

Windows 10/11 x64 is the primary validated target. macOS and Linux packages
are previews, and pure Wayland screen capture is not currently supported.

## Required FFmpeg Setup

Flowtake release packages do not include FFmpeg. Install a compatible system
FFmpeg before opening Flowtake; the first-launch readiness screen checks it and
keeps recording and media-processing options off until it is available.

- **Windows:** `winget install --id Gyan.FFmpeg --exact --source winget`
- **macOS:** `brew install ffmpeg`
- **Debian/Ubuntu:** `sudo apt-get install ffmpeg`
- **Other Linux distributions:** install `ffmpeg` with the distribution package manager

Restart Flowtake after installation so it can discover the `ffmpeg` command.

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
3. Verify the downloaded checksum, then right-click the app and choose **Open**
   if macOS shows the expected unverified-developer warning

## Uninstall

**Windows**: Use **Add or Remove Programs** in Settings and search for Flowtake.

**macOS**: Drag Flowtake from Applications to the Trash.
