#!/usr/bin/env python3
"""
Fix Cyrillic encoding by using Latin-1 as intermediate.
"""

import os

def fix_encoding(filepath):
    try:
        # Read as binary
        with open(filepath, 'rb') as f:
            content = f.read()
        
        # Remove BOM
        has_bom = content.startswith(b'\xef\xbb\xbf')
        if has_bom:
            content = content[3:]
        
        # Decode as Latin-1 (preserves all byte values 0-255)
        # Then encode as Windows-1251 bytes
        # Then decode as Windows-1251 to get Cyrillic
        # Then encode as UTF-8
        
        latin1_text = content.decode('latin-1')
        win1251_bytes = latin1_text.encode('windows-1251', errors='replace')
        cyrillic_text = win1251_bytes.decode('windows-1251', errors='replace')
        utf8_bytes = cyrillic_text.encode('utf-8')
        
        # Write back with BOM
        with open(filepath, 'wb') as f:
            if has_bom:
                f.write(b'\xef\xbb\xbf')
            f.write(utf8_bytes)
        
        print(f"Fixed: {filepath}")
        return True
    except Exception as e:
        print(f"Error in {filepath}: {e}")
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

print("Starting encoding fix...")
for f in files:
    path = f'D:/V9/{f}'
    if os.path.exists(path):
        fix_encoding(path)
    else:
        print(f"Not found: {path}")

print("\nDone!")
