#!/usr/bin/env python3
"""
Proper fix for Cyrillic encoding issues.
The file contains UTF-8 bytes that were incorrectly decoded and re-encoded.
We need to:
1. Read the file as raw bytes
2. Decode the bytes as Latin-1 (which preserves byte values)
3. The Latin-1 string represents the misencoded Cyrillic
4. Re-encode to Windows-1251 bytes
5. Decode as Windows-1251 to get proper Cyrillic
6. Save as UTF-8
"""

def fix_file(filepath):
    try:
        with open(filepath, 'rb') as f:
            content = f.read()
        
        # Remove BOM if present
        has_bom = content.startswith(b'\xef\xbb\xbf')
        if has_bom:
            content = content[3:]
        
        # Decode as Latin-1 (preserves all byte values 0-255)
        # This gives us the misencoded text
        text_latin1 = content.decode('latin-1')
        
        # The text_latin1 contains characters that correspond to Windows-1251 bytes
        # Encode to get the Windows-1251 bytes
        bytes_win1251 = text_latin1.encode('windows-1251')
        
        # Decode as Windows-1251 to get proper Cyrillic
        text_cyrillic = bytes_win1251.decode('windows-1251')
        
        # Save as UTF-8 with BOM
        with open(filepath, 'wb') as f:
            if has_bom:
                f.write(b'\xef\xbb\xbf')
            f.write(text_cyrillic.encode('utf-8'))
        
        print(f"Fixed: {filepath}")
        return True
    except Exception as e:
        print(f"Error: {filepath} - {e}")
        import traceback
        traceback.print_exc()
        return False

# Files to fix
files = [
    'src/engines/training.engine.ts',
    'src/engines/training-periodization.engine.ts',
    'src/engines/split-selector.engine.ts',
    'src/engines/rir-matrix.engine.ts',
    'src/engines/progression.engine.ts',
    'src/ui/screens/PlanScreen.tsx',
    'src/core/exercise-catalog.ts',
    'src/engines/support.engine.ts',
    'src/engines/risk.engine.ts',
    'src/core/constants.ts',
    'src/core/risk-info.ts',
    'src/core/pharma-database.ts',
    'src/core/nutrition-database.ts',
    'src/core/data-link.ts',
    'src/core/types.ts',
]

for f in files:
    path = f'D:/V9/{f}'
    fix_file(path)

print("\nDone!")
