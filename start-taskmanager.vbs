Set WshShell = CreateObject("WScript.Shell")

WshShell.Run "cmd /c cd /d D:\TaskManager && npm start", 0, False

WScript.Sleep 5000

WshShell.Run "cmd /c nport 3000 -s redflagteam", 0, False