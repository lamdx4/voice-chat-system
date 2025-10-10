; Custom NSIS installer script
; This file is included in the NSIS installer

; Custom page to show additional information
!macro customInstall
  ; Add custom installation steps here
  DetailPrint "Installing Voice Chat App..."
!macroend

; Custom uninstallation steps
!macro customUnInstall
  ; Add custom uninstallation steps here
  DetailPrint "Uninstalling Voice Chat App..."
!macroend

; Custom installer initialization
!macro customInit
  ; Check for previous installation
  ; MessageBox MB_OK "Welcome to Voice Chat App installer!"
!macroend

