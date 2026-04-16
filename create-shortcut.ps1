# Crée un raccourci CiderScope sur le bureau
param(
    [string]$Url = "https://senso.vercel.app"
)

$WshShell = New-Object -ComObject WScript.Shell
$ShortcutPath = "$env:USERPROFILE\Desktop\CiderScope.url"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Url
$Shortcut.Save()

# Ajouter l'icône au fichier .url (nécessite une modification directe du fichier car l'objet COM ne le gère pas bien pour les .url)
$IconPath = "$PSScriptRoot\public\Logo.ico"
Add-Content $ShortcutPath "IconFile=$IconPath"
Add-Content $ShortcutPath "IconIndex=0"

Write-Host "Raccourci créé sur le bureau : CiderScope -> $Url (avec icône)"
