# Health Engine v9 - Encoding Fix Script
# Runs before git commit to fix encoding issues

Write-Host "Проверка и исправление кодировки файлов..." -ForegroundColor Cyan

# Get all TypeScript files
$tsFiles = Get-ChildItem -Recurse -Path "src" -Include *.ts, *.tsx

foreach ($file in $tsFiles) {
    # Check if file is UTF-8 with BOM
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    
    # UTF-8 BOM is EF BB BF
    if ($bytes.Count -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        Write-Host "Исправление BOM: $($file.FullName)" -ForegroundColor Yellow
        
        # Remove BOM and save as UTF-8 without BOM
        $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
    }
}

Write-Host "Проверка завершена!" -ForegroundColor Green
