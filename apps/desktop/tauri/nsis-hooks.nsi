; Add Windows Firewall exception so the app can make HTTPS requests
; without users getting blocked by firewall prompts.

!macro CUSTOM_INSTALL_HOOK
  ; Add firewall rule for the main executable
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Wohnly" dir=out action=allow program="$INSTDIR\wohnly-desktop.exe" enable=yes profile=any'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Wohnly" dir=in action=allow program="$INSTDIR\wohnly-desktop.exe" enable=yes profile=any'
!macroend

!macro CUSTOM_UNINSTALL_HOOK
  ; Remove firewall rules on uninstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Wohnly" program="$INSTDIR\wohnly-desktop.exe"'
!macroend
