; Flowtake NSIS Installer Hooks
; Branded installer experience for Flowtake.

!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Checking system requirements..."
  DetailPrint "Installing Flowtake - Screen recorder with automatic zoom animations"
  DetailPrint "Publisher: Jnx03"
  DetailPrint "Website: https://github.com/JNX03/Flowtake"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Verify FFmpeg sidecar was installed correctly
  DetailPrint "Verifying FFmpeg installation..."

  IfFileExists "$INSTDIR\ffmpeg-x86_64-pc-windows-msvc.exe" FFmpegFound FFmpegCheck2

  FFmpegCheck2:
    IfFileExists "$INSTDIR\ffmpeg.exe" FFmpegFound FFmpegMissing

  FFmpegFound:
    DetailPrint "FFmpeg sidecar verified successfully."
    Goto FFmpegDone

  FFmpegMissing:
    DetailPrint "WARNING: FFmpeg binary not found in installation directory."
    DetailPrint "Screen recording may not work without FFmpeg."
    MessageBox MB_OK|MB_ICONINFORMATION "FFmpeg was not found in the installation.$\n$\nScreen recording requires FFmpeg. If recording doesn't work, please download FFmpeg from https://ffmpeg.org and place ffmpeg.exe in:$\n$INSTDIR"

  FFmpegDone:
    DetailPrint "Flowtake installation complete!"
    DetailPrint "Visit https://github.com/JNX03/Flowtake for help and documentation."
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Preparing to uninstall Flowtake..."
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DetailPrint "Flowtake has been uninstalled."
  DetailPrint "Thank you for using Flowtake!"
!macroend
