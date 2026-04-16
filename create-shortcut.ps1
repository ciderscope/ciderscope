# Crée un raccourci CiderScope sur le bureau
param(
    [string]$Url = "https://senso.vercel.app"
)

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\CiderScope.url")
$Shortcut.TargetPath = $Url
$Shortcut.Save()

Write-Host "Raccourci créé sur le bureau : CiderScope -> $Url"
