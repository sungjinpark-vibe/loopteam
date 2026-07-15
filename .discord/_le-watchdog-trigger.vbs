' Fixed, no-argument launcher for the 1-minute Task Scheduler trigger
' (task LoopEngine-DiscordDaemon-Watchdog). Runs le-watchdog.ps1 with ZERO
' window — wscript.exe has no console subsystem, and WshShell.Run(...,0,False)
' never allocates one for the child either, so nothing can ever flash.
Set objShell = CreateObject("WScript.Shell")
objShell.Run "powershell.exe -NoProfile -WindowStyle Hidden -File ""C:\Users\user\loop_engine\.discord\le-watchdog.ps1""", 0, False
