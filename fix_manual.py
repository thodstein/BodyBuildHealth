#!/usr/bin/env python3
"""
Manual Cyrillic encoding fix by replacing garbled UTF-8 byte patterns.
"""

import os

def fix_file(filepath):
    try:
        with open(filepath, 'rb') as f:
            content = f.read()
        
        # Remove BOM if present
        has_bom = content.startswith(b'\xef\xbb\xbf')
        if has_bom:
            content = content[3:]
        
        # Define replacement patterns as byte sequences
        # Pattern: garbled UTF-8 bytes -> correct UTF-8 bytes
        replacements = [
            # Goal: Набор (BULK)
            (b'\xe2\x95\xa8\xd0\xad\xe2\x95\xa8\xe2\x96\x91\xe2\x95\xa8\xe2\x96\x92\xe2\x95\xa8\xe2\x95\x9b\xe2\x95\xa4\xd0\x90', b'\xd0\x9d\xd0\xb0\xd0\xb1\xd0\xbe\xd1\x80'),
            
            # Goal: скилла (CUT - wrong encoding, should be склада)
            (b'\xd1\x81\xd0\xba\xd0\xbb\xd0\xb0\xd0\xba\xd0\xb0', b'\xd1\x81\xd0\xba\xd0\xbb\xd0\xb0\xd0\xb4\xd0\xb0'),
            
            # Goal: галасса (MAINTENANCE - wrong encoding)
            (b'\xd0\xb3\xd0\xb0\xd0\xbb\xd0\xba\xd0\xb0', b'\xd0\xbc\xd0\xb0\xd0\xb9\xd1\x82\xd0\xb5\xd0\xb9\xd0\xbd\xd1\x81'),
            
            # Goal: стренгтх (STRENGTH)
            (b'\xd1\x81\xd1\x82\xd1\x80\xd0\xb5\xd0\xbd\xd0\xb3\xd1\x82\xd1\x85', b'\xd1\x81\xd1\x82\xd1\x80\xd0\xb5\xd0\xbd\xd0\xb3\xd1\x82'),
            
            # Goal: рекомп (RECOMP)
            (b'\xd1\x80\xd0\xb5\xd0\xba\xd0\xbe\xd0\xbc\xd0\xbf', b'\xd1\x80\xd0\xb5\xd0\xba\xd0\xbe\xd0\xbc\xd0\xbf'),
            
            # Goal: рехаб (REHAB)
            (b'\xd1\x80\xd0\xb5\xd1\x85\xd0\xb0\xd0\xb1', b'\xd1\x80\xd0\xb5\xd0\xb1\xd0\xb0\xd0\xb1'),
            
            # Muscle: стегня (CHEST)
            (b'\xd1\x81\xd1\x82\xd0\xb5\xd0\xb3\xd0\xbd\xd1\x8f', b'\xd1\x81\xd1\x82\xd0\xb5\xd0\xb3\xd0\xbd\xd1\x8f'),
            
            # Muscle: спина (BACK)
            (b'\xd1\x81\xd0\xbf\xd0\xb8\xd0\xbd\xd0\xb0', b'\xd1\x81\xd0\xbe\xd1\x80\xd0\xbe\xd1\x82\xd0\xba\xd0\xb0'),
            
            # Muscle: ноги (LEGS)
            (b'\xd0\xbd\xd0\xbe\xd0\xb3\xd0\xb8', b'\xd0\xbd\xd0\xbe\xd0\xb3\xd0\xb8'),
            
            # Muscle: плечи (SHOULDERS)
            (b'\xd1\x81\xd0\xbe\xd1\x87\xd0\xb8', b'\xd1\x81\xd0\xbe\xd1\x87\xd0\xb8'),
            
            # Muscle: руки (ARMS)
            (b'\xd1\x80\xd1\x83\xd0\xba\xd0\xb8', b'\xd1\x80\xd1\x83\xd0\xba\xd0\xb8'),
            
            # Muscle: кор (CORE)
            (b'\xd0\xba\xd0\xbe\xd1\x80', b'\xd0\xba\xd0\xbe\xd1\x80'),
        ]
        
        # Apply replacements
        for old_bytes, new_bytes in replacements:
            count = content.count(old_bytes)
            if count > 0:
                content = content.replace(old_bytes, new_bytes)
        
        # Save back with BOM
        with open(filepath, 'wb') as f:
            if has_bom:
                f.write(b'\xef\xbb\xbf')
            f.write(content)
        
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

print("Starting manual encoding fix...")
for f in files:
    path = f'D:/V9/{f}'
    fix_file(path)

print("\nDone!")
