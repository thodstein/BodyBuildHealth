#!/usr/bin/env python3
import os

def fix_file(filepath):
    """Fix Cyrillic encoding by converting from misencoded UTF-8 back to proper UTF-8."""
    try:
        # Read as binary
        with open(filepath, 'rb') as f:
            content = f.read()
        
        # Remove BOM if present
        if content.startswith(b'\xef\xbb\xbf'):
            content = content[3:]
        
        # The content was originally Windows-1251 Cyrillic
        # But was saved as UTF-8 (incorrectly decoded)
        # We need to:
        # 1. Decode as Latin-1 (preserves byte values)
        # 2. Encode as Windows-1251 bytes
        # 3. Decode as Windows-1251 to get proper Cyrillic
        # 4. Save as UTF-8
        
        # Step 1: Get bytes as Latin-1 (each byte = 1 char)
        latin1_str = content.decode('latin-1')
        
        # Step 2: Encode to get the original Windows-1251 bytes
        win1251_bytes = latin1_str.encode('windows-1251')
        
        # Step 3: Decode as Windows-1251 to get proper Cyrillic text
        proper_cyrillic = win1251_bytes.decode('windows-1251')
        
        # Step 4: Save as UTF-8
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(proper_cyrillic)
        
        print(f"Fixed: {filepath}")
        return True
    except Exception as e:
        print(f"Error: {filepath} - {e}")
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
    if os.path.exists(path):
        fix_file(path)
    else:
        print(f"Not found: {path}")

print("\nDone!")
