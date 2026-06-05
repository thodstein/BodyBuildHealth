#!/usr/bin/env python3
import os

def fix_file(filepath):
    """Fix Cyrillic encoding by converting from Windows-1251 to UTF-8."""
    try:
        # Read as binary
        with open(filepath, 'rb') as f:
            content = f.read()
        
        # Remove BOM if present
        if content.startswith(b'\xef\xbb\xbf'):
            content = content[3:]
            print(f"  Removed BOM")
        
        # The content is actually Windows-1251 encoded
        # Decode as Windows-1251 to get proper text
        text = content.decode('windows-1251')
        
        # Re-encode as UTF-8
        utf8_bytes = text.encode('utf-8')
        
        # Save as UTF-8
        with open(filepath, 'wb') as f:
            f.write(b'\xef\xbb\xbf')  # Add BOM for UTF-8
            f.write(utf8_bytes)
        
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
    if os.path.exists(path):
        fix_file(path)
    else:
        print(f"Not found: {path}")

print("\nDone!")
