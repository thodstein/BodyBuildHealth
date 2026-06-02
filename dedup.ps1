 = Get-Content -Path src/core/lab-auto-parser.ts -Raw
# Process MARKER_ALIASES
 = ''const MARKER_ALIASES: Record<string, string> = {''
 = ''};''
 = .IndexOf()
if ( -ge 0) {
     += .Length
     = .IndexOf(, )
    if ( -ge 0) {
         = .Substring(,  - )
         =  -split "?
"
         = @{}
         = @()
        foreach ( in ) {
             = .Trim()
            if ( -eq '''') { continue }
            if ( -contains '':'') {
                 = .Split('':'')
                 = [0].Trim()
                if (.Length -ge 2) {
                     = .Substring(0,1)
                     = .Substring(.Length-1,1)
                    if (( -eq "''" -or  -eq ''"'') -and ( -eq )) {
                         = .Substring(1, .Length-2)
                    } else {
                         = 
                    }
                    if (.ContainsKey()) {
                        continue
                    }
                    [] = True
                }
            }
             += 
        }
         = ( -join "
")
         =  +  + 
         = .Remove( - .Length,  - ( - .Length) + .Length).Insert( - .Length, )
    }
}
# Process UNIT_ALIASES
 = ''const UNIT_ALIASES: Record<string, string> = {''
 = .IndexOf()
if ( -ge 0) {
     += .Length
     = .IndexOf(''};'', )
    if ( -ge 0) {
         = .Substring(,  - )
         =  -split "?
"
         = @{}
         = @()
        foreach ( in ) {
             = .Trim()
            if ( -eq '''') { continue }
            if ( -contains '':'') {
                 = .Split('':'')
                 = [0].Trim()
                if (.Length -ge 2) {
                     = .Substring(0,1)
                     = .Substring(.Length-1,1)
                    if (( -eq "''" -or  -eq ''"'') -and ( -eq )) {
                         = .Substring(1, .Length-2)
                    } else {
                         = 
                    }
                    if (.ContainsKey()) {
                        continue
                    }
                    [] = True
                }
            }
             += 
        }
         = ( -join "
")
         =  +  + ''};''
         = .Remove( - .Length,  - ( - .Length) + 2).Insert( - .Length, )
    }
}
Set-Content -Path src/core/lab-auto-parser.ts -Value  -Encoding UTF8
Write-Host "Deduplication done."
