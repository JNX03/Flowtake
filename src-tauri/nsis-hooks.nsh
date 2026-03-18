; Flowtake NSIS Installer Hooks
; These hooks run during the NSIS installer on Windows.

!macro NSIS_HOOK_PREINSTALL
  ; Check if WebView2 Runtime is available (Tauri handles this automatically,
  ; but we log a message for debugging)
  DetailPrint "Checking system requirements..."
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Verify FFmpeg sidecar was installed correctly
  DetailPrint "Verifying FFmpeg installation..."

  IfFileExists "$INSTDIR\ffmpeg-x86_64-pc-windows-msvc.exe" FFmpegFound FFmpegCheck2

  FFmpegCheck2:
    IfFileExists "$INSTDIR\ffmpeg.exe" FFmpegFound FFmpegMissing

  FFmpegFound:
    DetailPrint "FFmpeg sidecar verified."
    Goto FFmpegDone

  FFmpegMissing:
    DetailPrint "WARNING: FFmpeg binary not found in installation directory."
    DetailPrint "Screen recording may not work without FFmpeg."
    MessageBox MB_OK|MB_ICONINFORMATION "FFmpeg was not found in the installation.$\n$\nScreen recording requires FFmpeg. If recording doesn't work, please download FFmpeg from https://ffmpeg.org and place ffmpeg.exe in:$\n$INSTDIR"

  FFmpegDone:
    DetailPrint "Flowtake installation complete."
!macroend
