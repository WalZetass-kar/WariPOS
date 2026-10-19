; Replaces electron-builder's stock CHECK_APP_RUNNING (24.x). The stock check matches
; any "WariPOS.exe" via `tasklist /FI "USERNAME eq %USERNAME%" | find`, which can miss or
; misreport processes and ends in the "cannot be closed" Retry loop. This version only
; closes processes whose executable lives in the install directory of this app.

!include LogicLib.nsh

; Prints how many WariPOS processes in the current session still block the install.
; WARIPOS_ACTION: "list" only counts, "close" sends WM_CLOSE, "kill" force-stops.
; Only processes whose path is inside WARIPOS_DIRS are closed or killed. A process with
; an unreadable path (usually started "Run as administrator") is counted but never touched.
!define WARIPOS_PS_SCRIPT "\
$$ErrorActionPreference='SilentlyContinue';\
$$dirs=@($$env:WARIPOS_DIRS.Split('|') | Where-Object { $$_ } | ForEach-Object { $$_.TrimEnd('\') + '\' });\
$$sid=(Get-Process -Id $$PID).SessionId;\
if (Get-Command Get-CimInstance) { $$all=Get-CimInstance Win32_Process } else { $$all=Get-WmiObject Win32_Process };\
$$procs=@($$all | Where-Object { $$_.Name -eq '${APP_EXECUTABLE_FILENAME}' -and $$_.SessionId -eq $$sid -and $$_.ProcessId -ne $$PID });\
$$own=@($$procs | Where-Object { $$p=$$_.ExecutablePath; $$p -and @($$dirs | Where-Object { $$p.StartsWith($$_, [StringComparison]::OrdinalIgnoreCase) }).Count -gt 0 });\
$$unknown=@($$procs | Where-Object { -not $$_.ExecutablePath });\
if ($$env:WARIPOS_ACTION -eq 'close') { foreach ($$p in $$own) { $$g=Get-Process -Id $$p.ProcessId; if ($$g) { [void]$$g.CloseMainWindow() } } };\
if ($$env:WARIPOS_ACTION -eq 'kill') { foreach ($$p in $$own) { Stop-Process -Id $$p.ProcessId -Force } };\
[Console]::Out.Write('WARIPOS:' + ($$own.Count + $$unknown.Count))"

; Out: $R0 = blocking process count, or -1 when PowerShell did not run the script
; (missing, blocked by policy, hung past the timeout, or a stub that exits 0 without output). Clobbers $R1, $R2.
!macro _WARIPOS_RUN_PS ACTION
  System::Call 'Kernel32::SetEnvironmentVariable(t "WARIPOS_DIRS", t "$R3")i'
  System::Call 'Kernel32::SetEnvironmentVariable(t "WARIPOS_ACTION", t "${ACTION}")i'
  nsExec::ExecToStack /TIMEOUT=30000 `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${WARIPOS_PS_SCRIPT}"`
  Pop $R1
  Pop $R2
  StrCpy $R0 -1
  ${If} $R1 == "0"
    StrCpy $R1 $R2 8
    ${If} $R1 == "WARIPOS:"
      StrCpy $R2 $R2 "" 8
      IntOp $R0 $R2 + 0
    ${EndIf}
  ${EndIf}
!macroend

!macro customCheckAppRunning
  Push $R0
  Push $R1
  Push $R2
  Push $R3
  Push $R4
  Push $R5

  ; The install dir chosen now, plus wherever an older version was installed.
  StrCpy $R3 "$INSTDIR"
  ReadRegStr $R4 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $R4 != ""
    StrCpy $R3 "$R3|$R4"
  ${EndIf}
  ReadRegStr $R4 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $R4 != ""
    StrCpy $R3 "$R3|$R4"
  ${EndIf}

  StrCpy $R4 0 ; set to 1 once the user agreed to close the app
  waripos_check:
    !insertmacro _WARIPOS_RUN_PS "list"
    ${If} $R0 == 0
      Goto waripos_done
    ${EndIf}
    ${If} $R0 < 0
      Goto waripos_fallback
    ${EndIf}

    ${If} $R4 == 0
    ${AndIfNot} ${isUpdated}
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK waripos_agreed
      Quit
    ${EndIf}
    waripos_agreed:
    StrCpy $R4 1

    DetailPrint `Closing running "${PRODUCT_NAME}"...`
    ; Graceful first so SQLite can checkpoint its WAL, then force after ~8 checks.
    !insertmacro _WARIPOS_RUN_PS "close"
    StrCpy $R5 0
    ${Do}
      Sleep 500
      !insertmacro _WARIPOS_RUN_PS "list"
      ${If} $R0 == 0
        Goto waripos_done
      ${EndIf}
      IntOp $R5 $R5 + 1
    ${LoopUntil} $R5 >= 8

    !insertmacro _WARIPOS_RUN_PS "kill"
    StrCpy $R5 0
    ${Do}
      Sleep 500
      !insertmacro _WARIPOS_RUN_PS "list"
      ${If} $R0 == 0
        Goto waripos_done
      ${EndIf}
      IntOp $R5 $R5 + 1
    ${LoopUntil} $R5 >= 6

    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "${PRODUCT_NAME} masih berjalan dan tidak bisa ditutup otomatis.$\r$\n$\r$\nBiasanya karena ${PRODUCT_NAME} dibuka dengan $\"Run as administrator$\".$\r$\n$\r$\n1. Simpan pekerjaan lalu tutup semua jendela ${PRODUCT_NAME}.$\r$\n2. Jika masih ada, buka Task Manager, pilih ${APP_EXECUTABLE_FILENAME}, klik End task.$\r$\n3. Klik Retry untuk melanjutkan instalasi.$\r$\n$\r$\nData penjualan dan pengaturan tidak akan dihapus." /SD IDCANCEL IDRETRY waripos_check
    Quit

  ; PowerShell unavailable: we cannot verify which process is ours, so never force-kill.
  waripos_fallback:
    nsExec::Exec /TIMEOUT=15000 `"$SYSDIR\cmd.exe" /c tasklist /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO csv | "$SYSDIR\find.exe" /I "${APP_EXECUTABLE_FILENAME}"`
    Pop $R0
    ; Only a positive match (exit 0) blocks. If the check itself fails we cannot tell, and the
    ; file copy step still stops with its own Retry dialog when a file is really locked.
    ${If} $R0 != 0
      Goto waripos_done
    ${EndIf}
    ${If} $R4 == 0
    ${AndIfNot} ${isUpdated}
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK waripos_fallback_agreed
      Quit
    ${EndIf}
    waripos_fallback_agreed:
    StrCpy $R4 1
    nsExec::Exec /TIMEOUT=15000 `"$SYSDIR\cmd.exe" /c taskkill /IM "${APP_EXECUTABLE_FILENAME}" /FI "USERNAME eq %USERNAME%"`
    Pop $R0
    Sleep 3000
    nsExec::Exec /TIMEOUT=15000 `"$SYSDIR\cmd.exe" /c tasklist /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO csv | "$SYSDIR\find.exe" /I "${APP_EXECUTABLE_FILENAME}"`
    Pop $R0
    ${If} $R0 != 0
      Goto waripos_done
    ${EndIf}
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "${PRODUCT_NAME} masih berjalan.$\r$\n$\r$\nTutup ${PRODUCT_NAME} (atau End task ${APP_EXECUTABLE_FILENAME} di Task Manager), lalu klik Retry.$\r$\n$\r$\nData penjualan dan pengaturan tidak akan dihapus." /SD IDCANCEL IDRETRY waripos_fallback
    Quit

  waripos_done:
  Pop $R5
  Pop $R4
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0
!macroend
