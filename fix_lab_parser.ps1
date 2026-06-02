 = Get-Content -Raw -Path src/core/lab-auto-parser.ts

function Deduplicate-ObjectLiteral {
    param(
        [string],
        [string]
    )
     = [regex]::Escape("const $objectName: Record<string, string> = {")
     = .IndexOf()
    if ( -eq -1) {
        Write-Warning "Object $objectName not found"
        return 
    }
     += .Length
     = 1
     = 
    while ( -lt .Length -and  -gt 0) {
         = []
        if ( -eq '{') { ++ }
        elseif ( -eq '}') { -- }
        ++
    }
    if ( -ne 0) {
        Write-Warning "Could not find matching closing brace for $objectName"
        return 
    }
     = 
     = .Substring(,  -  - 1)
    # Split by commas outside quotes
     = @()
     = ''
     = False
     = 
    foreach ( in .ToCharArray()) {
        if (-not  -and ( -eq '"' -or  -eq "'")) {
             = True
             = 
             += 
        }
        elseif ( -and  -eq ) {
             = False
             += 
        }
        elseif (-not  -and  -eq ',') {
            .Add()
             = ''
        }
        else {
             += 
        }
    }
    if ( -ne '') {
        .Add()
    }
     = @{}
     = @()
    foreach ( in ) {
         = .Trim()
        if ( -eq '') { continue }
         = .IndexOf(':')
        if ( -eq -1) {
            .Add()
            continue
        }
         = .Substring(0, ).Trim()
        if (.Length -ge 2 -and ((.StartsWith("'") -and .EndsWith("'")) -or (.StartsWith('"') -and .EndsWith('"')))) {
             = .Substring(1, .Length - 2)
        }
        else {
             = 
        }
        if (.ContainsKey()) {
            continue
        }
        [] = True
        .Add()
    }
     = ( -join ", 
")
     = "const $objectName: Record<string, string> = {

};"
     = .Substring(0, .IndexOf()) +  + .Substring()
    return 
}

 = Deduplicate-ObjectLiteral -content  -objectName 'MARKER_ALIASES'
 = Deduplicate-ObjectLiteral -content  -objectName 'UNIT_ALIASES'

Set-Content -Path src/core/lab-auto-parser.ts -Value  -Encoding UTF8
Write-Host "Deduplicated MARKER_ALIASES and UNIT_ALIASES."
