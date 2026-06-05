#!/usr/bin/env python3
"""
Fix Cyrillic encoding by converting from Windows-1251 to UTF-8.
The file was saved as Windows-1251 but read as UTF-8 (double encoding).
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
        
        # Decode as Windows-1251 (the original encoding)
        # Then encode as UTF-8
        text = content.decode('windows-1251')
        utf8_bytes = text.encode('utf-8')
        
        # Write back with BOM
        with open(filepath, 'wb') as f:
            if has_bom:
                f.write(b'\xef\xbb\xbf')
            f.write(utf8_bytes)
        
        print(f"Fixed: {filepath}")
        return True
    except UnicodeDecodeError as e:
        print(f"Decode error in {filepath}: {e}")
        return False
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
