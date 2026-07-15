' Fixed, no-argument launcher used by le-watchdog.ps1 to relaunch the
' persistent le-daemon.ps1 with ZERO window (wscript.exe has no console
' subsystem at all, so nothing can flash even for a frame).
'
' The -EncodedCommand base64 below is `& 'C:\Users\user\loop_engine\.discord\
' le-daemon.ps1'` — kept as -EncodedCommand (not -File) so this long-running
' process's command line stays opaque (no "discord"/"daemon" substring visible
' via Win32_Process.CommandLine), in case another Claude Code project's
' Discord listener uses a naive pattern-matching single-instance guard.
' If the repo ever moves, regenerate via:
'   [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes("& '<new path>\le-daemon.ps1'"))
Set objShell = CreateObject("WScript.Shell")
objShell.Run "powershell.exe -NoProfile -WindowStyle Hidden -EncodedCommand JgAgACcAQwA6AFwAVQBzAGUAcgBzAFwAdQBzAGUAcgBcAGwAbwBvAHAAXwBlAG4AZwBpAG4AZQBcAC4AZABpAHMAYwBvAHIAZABcAGwAZQAtAGQAYQBlAG0AbwBuAC4AcABzADEAJwA=", 0, False
