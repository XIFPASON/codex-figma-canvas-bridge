$ErrorActionPreference = 'Stop'
try {
    foreach ($skillName in @('figma-export-to-code', 'figma-local-canvas')) {
    $source = Join-Path $PSScriptRoot ('..\skill\' + $skillName)
    $skillRoot = if ($env:CODEX_HOME) { Join-Path $env:CODEX_HOME 'skills' } else { Join-Path $env:USERPROFILE '.codex\skills' }
    $destination = Join-Path $skillRoot $skillName
    New-Item -ItemType Directory -Force -Path $skillRoot | Out-Null
    if (Test-Path -LiteralPath $destination) {
        $backup = "$destination.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')-$([Guid]::NewGuid().ToString('N').Substring(0,6))"
        Move-Item -LiteralPath $destination -Destination $backup
        Write-Host "Existing skill backed up: $backup"
    }
    Copy-Item -LiteralPath $source -Destination $destination -Recurse
    Write-Host "Skill installed: $destination"
    }
    Write-Host 'Open a new Codex chat to use the installed skills.'
} catch {
    Write-Host "Installation failed: $_" -ForegroundColor Red
    exit 1
}
