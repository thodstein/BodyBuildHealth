#!/usr/bin/env python3
"""
Fix Cyrillic encoding by replacing garbled UTF-8 byte sequences with correct ones.
"""

import os

# Map of garbled byte patterns to correct Cyrillic UTF-8 bytes
# These are the exact byte sequences that need to be replaced
REPLACEMENTS = [
    # Goal: Набор (BULK)
    (b'\xe2\x95\xa8\xd0\xad\xe2\x95\xa8\xe2\x96\x91\xe2\x95\xa8\xe2\x96\x92\xe2\x95\xa8\xe2\x95\x9b\xe2\x95\xa4\xd0\x90', b'\xd0\x9d\xd0\xb0\xd0\xb1\xd0\xbe\xd1\x80'),
    # Goal: склада (CUT)
    (b'\xd1\x81\xd0\xba\xd0\xbb\xd0\xb0\xd0\xba\xd0\xb0', b'\xd1\x81\xd0\xba\xd0\xbb\xd0\xb0\xd0\xb4\xd0\xb0'),
    # Goal: maintenance (already correct)
    # Goal: стренгтх (STRENGTH)
    (b'\xd1\x81\xd1\x82\xd1\x80\xd0\xb5\xd0\xbd\xd0\xb3\xd1\x82\xd1\x85', b'\xd1\x81\xd1\x82\xd1\x80\xd0\xb5\xd0\xbd\xd0\xb3\xd1\x82'),
    # Goal: рекомп (RECOMP)
    (b'\xd1\x80\xd0\xb5\xd0\xba\xd0\xbe\xd0\xbc\xd0\xbf', b'\xd1\x80\xd0\xb5\xd0\xba\xd0\xbe\xd0\xbc\xd0\xbf'),
    # Goal: рехаб (REHAB)
    (b'\xd1\x80\xd0\xb5\xd1\x85\xd0\xb0\xd0\xb1', b'\xd1\x80\xd0\xb5\xd1\x85\xd0\xb0\xd0\xb1'),
]

# Muscle groups patterns
REPLACEMENTS.extend([
    (b'\xd1\x81\xd1\x82\xd0\xb5\xd0\xb3\xd0\xbd\xd1\x8f', b'\xd1\x81\xd1\x82\xd0\xb5\xd0\xb3\xd0\xbd\xd1\x8f'),  # chest
    (b'\xd1\x81\xd0\xbf\xd0\xb8\xd0\xbd\xd0\xb0', b'\xd1\x81\xd0\xbf\xd0\xb8\xd0\xbd\xd0\xb0'),  # back
    (b'\xd0\xbd\xd0\xbe\xd0\xb3\xd0\xb8', b'\xd0\xbd\xd0\xbe\xd0\xb3\xd0\xb8'),  # legs
    (b'\xd1\x81\xd0\xbe\xd1\x87\xd0\xb8', b'\xd1\x81\xd0\xbe\xd1\x87\xd0\xb8'),  # shoulders
    (b'\xd1\x80\xd1\x83\xd0\xba\xd0\xb8', b'\xd1\x80\xd1\x83\xd0\xba\xd0\xb8'),  # arms
    (b'\xd0\xba\xd0\xbe\xd1\x80', b'\xd0\xba\xd0\xbe\xd1\x80'),  # core
])

# Level patterns
REPLACEMENTS.extend([
    (b'\xd0\xbd\xd0\xbe\xd0\xb2\xd0\xb8\xd1\x87\xd0\xbe\xd0\xba', b'\xd0\xbd\xd0\xbe\xd0\xb2\xd0\xb8\xd1\x87\xd0\xbe\xd0\xba'),  # beginner
    (b'\xd1\x81\xd1\x80\xd0\xb5\xd0\xb4\xd0\xbd\xd0\xb8\xd0\xb9', b'\xd1\x81\xd1\x80\xd0\xb5\xd0\xb4\xd0\xbd\xd0\xb8\xd0\xb9'),  # intermediate
    (b'\xd0\xbf\xd1\x80\xd0\xbe\xd0\xb4\xd0\xbe\xd0\xb2\xd0\xb8\xd0\xbd\xd0\xb8\xd0\xb9', b'\xd0\xbf\xd1\x80\xd0\xbe\xd0\xb4\xd0\xb2\xd0\xb8\xd0\xbd\xd1\x83\xd1\x82\xd1\x8b\xd0\xb9'),  # advanced
    (b'\xd1\x83\xd1\x81\xd0\xb8\xd0\xbb\xd0\xb5\xd0\xbd\xd0\xbd\xd1\x8b\xd0\xb9', b'\xd1\x83\xd1\x81\xd0\xb8\xd0\xbb\xd0\xb5\xd0\xbd\xd0\xbd\xd1\x8b\xd0\xb9'),  # enhanced
])

def fix_file(filepath):
    try:
        with open(filepath, 'rb') as f:
            content = f.read()
        
        has_bom = content.startswith(b'\xef\xbb\xbf')
        if has_bom:
            content = content[3:]
        
        # Apply replacements
        for old_bytes, new_bytes in REPLACEMENTS:
            count = content.count(old_bytes)
            if count > 0:
                content = content.replace(old_bytes, new_bytes)
                print(f"  Replaced {len(old_bytes)} -> {len(new_bytes)} bytes ({count} times)")
        
        # Write back with BOM
        with open(filepath, 'wb') as f:
            if has_bom:
                f.write(b'\xef\xbb\xbf')
            f.write(content)
        
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

print("Starting encoding fix...")
for f in files:
    path = f'D:/V9/{f}'
    if os.path.exists(path):
        fix_file(path)
    else:
        print(f"Not found: {path}")

print("\nDone!")
