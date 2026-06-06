# PowerShell script to detect encoding
$filePath = "D:\V9\src\engines\training.engine.ts"
$content = Get-Content -Encoding Byte -Path $filePath -TotalCount 100

Write-Host "First 100 bytes (hex):"
$content | ForEach-Object { $_.ToString("X2") } | Write-Host -NoNewline
Write-Host ""

# Check BOM
if ($content.Length -ge 3 -and $content[0] -eq 0xEF -and $content[1] -eq 0xBB -and $content[2] -eq 0xBF) {
    Write-Host "UTF-8 BOM detected"
} elseif ($content.Length -ge 2 -and $content[0] -eq 0xFF -and $content[1] -eq 0xFE) {
    Write-Host "UTF-16 LE BOM detected"
} elseif ($content.Length -ge 2 -and $content[0] -eq 0xFE -and $content[1] -eq 0xFF) {
    Write-Host "UTF-16 BE BOM detected"
} else {
    Write-Host "No BOM detected"
}
