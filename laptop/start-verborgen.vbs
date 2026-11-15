' Start het aanvragenprogramma zonder zichtbaar venster.
Set fso = CreateObject("Scripting.FileSystemObject")
map = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & map & "\aanvragen.ps1""", 0, False
