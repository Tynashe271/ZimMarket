param([string]$OutputDirectory = ".\backups")
$ErrorActionPreference = "Stop"
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $resolvedOutput "zimmarket-$stamp.sql"
docker exec zimmarket-postgres-1 pg_dump -U zimmarket --format=plain --no-owner zimmarket | Set-Content -Encoding utf8 $backupFile
if ((Get-Item -LiteralPath $backupFile).Length -eq 0) { throw "Backup file is empty" }
Write-Output $backupFile
