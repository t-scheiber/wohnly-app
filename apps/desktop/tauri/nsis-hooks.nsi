; Add Windows Firewall exception so the app can make HTTPS requests
; without users getting blocked by firewall prompts.

!macro CUSTOM_INSTALL_HOOK
  ; Add firewall rule for the main executable
  ; Tauri names the binary after productName in tauri.conf.json → "Wohnly.exe"
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Wohnly" dir=out action=allow program="$INSTDIR\Wohnly.exe" enable=yes profile=any'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Wohnly" dir=in action=allow program="$INSTDIR\Wohnly.exe" enable=yes profile=any'
!macroend

!macro CUSTOM_UNINSTALL_HOOK
  ; Remove firewall rules on uninstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Wohnly" program="$INSTDIR\Wohnly.exe"'
!macroend
