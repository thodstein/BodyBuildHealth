#!/usr/bin/env python3
"""
Fix Cyrillic encoding by identifying and replacing garbled patterns.
The pattern is: UTF-8 of garbled text (like ╨Э╨░╨▒╨╛╤А) should be replaced with UTF-8 of correct text (like Набор).
"""

import re

# Map of garbled UTF-8 byte sequences to correct Cyrillic text
# These are the patterns we need to find and replace

REPLACEMENTS = [
    # Goal labels
    (b'\xe2\x95\xa8\xd0\xad\xe2\x95\xa8\xe2\x96\x91\xe2\x95\xa8\xe2\x96\x92\xe2\x95\xa8\xe2\x95\x9b\xe2\x95\xa4\xd0\x90', 'Набор'),  # ╨Э╨░╨▒╨╛╤А -> Набор
    (b'\xd1\x81\xd0\xba\xd0\xbb\xd0\xb0\xd0\xba\xd0\xb0', 'скласса'),  # скилла -> БULK (wrong encoding)
    (b'\xd0\xb3\xd0\xb0\xd0\xbb\xd0\xba\xd0\xb0', 'галасс'),  # галасса -> CUT (wrong encoding)
    (b'\xd0\xbc\xd0\xb0\xd0\xb9\xd1\x82\xd0\xb5\xd0\xb9\xd0\xbd\xd1\x81', 'майнтейнанс'),  # maintenance
    (b'\xd1\x81\xd1\x82\xd1\x80\xd0\xb5\xd0\xbd\xd0\xb3\xd1\x82\xd1\x85', 'стренгтх'),  # strength
    (b'\xd1\x80\xd0\xb5\xd0\xba\xd0\xbe\xd0\xbc\xd0\xbf', 'рекомп'),  # recomp
    (b'\xd1\x80\xd0\xb5\xd1\x85\xd0\xb0\xd0\xb1', 'рехаб'),  # rehab
    
    # Level labels  
    (b'\xd0\xbd\xd0\xbe\xd0\xb2\xd0\xb8\xd1\x87\xd0\xbe\xd0\xba', 'новичок'),  # beginner
    (b'\xd1\x81\xd1\x80\xd0\xb5\xd0\xb4\xd0\xbd\xd0\xb8\xd0\xb9', 'средний'),  # intermediate
    (b'\xd0\xbf\xd1\x80\xd0\xbe\xd0\xb4\xd0\xbe\xd0\xb2\xd0\xb8\xd0\xbd\xd0\xb8\xd0\xb9', 'продвинутый'),  # advanced
    (b'\xd1\x83\xd1\x81\xd0\xb8\xd0\xbb\xd0\xb5\xd0\xbd\xd0\xbd\xd1\x8b\xd0\xb9', 'усиленный'),  # enhanced
    
    # Muscle groups
    (b'\xd1\x81\xd1\x82\xd0\xb5\xd0\xb3\xd0\xbd\xd1\x8f', 'стегня'),  # chest
    (b'\xd1\x81\xd0\xbf\xd0\xb8\xd0\xbd\xd0\xb0', 'спина'),  # back
    (b'\xd0\xbd\xd0\xbe\xd0\xb3\xd0\xb8', 'ноги'),  # legs
    (b'\xd1\x81\xd0\xbe\xd1\x87\xd0\xb8', 'плечи'),  # shoulders
    (b'\xd1\x80\xd1\x83\xd0\xba\xd0\xb8', 'руки'),  # arms
    (b'\xd0\xba\xd0\xbe\xd1\x80', 'кор'),  # core
]

def fix_content(content_bytes):
    """Replace garbled UTF-8 byte sequences with correct Cyrillic."""
    result = content_bytes
    
    for old_bytes, correct_text in REPLACEMENTS:
        # Find all occurrences
        start = 0
        count = 0
        while True:
            pos = result.find(old_bytes, start)
            if pos == -1:
                break
            # Replace with correct UTF-8 bytes
            new_bytes = correct_text.encode('utf-8')
            result = result[:pos] + new_bytes + result[pos + len(old_bytes):]
            start = pos + len(new_bytes)
            count += 1
        # Skip printing to avoid console encoding issues
    
    return result

def fix_file(filepath):
    try:
        with open(filepath, 'rb') as f:
            content = f.read()
        
        # Remove BOM if present
        has_bom = content.startswith(b'\xef\xbb\xbf')
        if has_bom:
            content = content[3:]
        
        # Fix the content
        fixed_content = fix_content(content)
        
        # Save back with BOM
        with open(filepath, 'wb') as f:
            if has_bom:
                f.write(b'\xef\xbb\xbf')
            f.write(fixed_content)
        
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

print("Starting encoding fix...")
for f in files:
    path = f'D:/V9/{f}'
    fix_file(path)

print("\nDone!")
