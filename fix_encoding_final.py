#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix Cyrillic encoding in TypeScript/TSX files.

The corruption pattern:
- Box drawing characters (U+2568, U+2591, etc.) are inserted before Cyrillic letters
- Valid UTF-8 Cyrillic bytes (d0.., d1..) are preserved

The fix:
- Remove box drawing characters that appear before Cyrillic letters
- Keep valid UTF-8 Cyrillic bytes
"""

def fix_box_cyrillic(bytes_data):
    """Remove box drawing characters that appear before Cyrillic letters."""
    result = bytearray()
    i = 0
    
    while i < len(bytes_data):
        # Check if this is a box drawing character (U+2500-U+25FF range)
        if bytes_data[i:i+2] == b'\xe2\x95':
            # Check if the next byte is a Cyrillic UTF-8 start byte (d0 or d1)
            if i + 3 < len(bytes_data) and bytes_data[i+2] in (0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f,
                                                               0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xab, 0xac, 0xad, 0xae, 0xaf,
                                                               0xb0, 0xb1, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xbb, 0xbc, 0xbd, 0xbe, 0xbf,
                                                               0xc0, 0xc1, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xcb, 0xcc, 0xcd, 0xce, 0xcf,
                                                               0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde, 0xdf):
                # This is a box char before Cyrillic - skip the 3-byte box char
                i += 3
                continue
        elif bytes_data[i:i+2] == b'\xe2\x96':
            # Check if next byte is Cyrillic UTF-8 start
            if i + 3 < len(bytes_data) and bytes_data[i+2] in (0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8d, 0x8e, 0x8f,
                                                               0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f,
                                                               0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xab, 0xac, 0xad, 0xae, 0xaf,
                                                               0xb0, 0xb1, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xbb, 0xbc, 0xbd, 0xbe, 0xbf):
                # This is a box char before Cyrillic - skip the 3-byte box char
                i += 3
                continue
        elif bytes_data[i:i+2] == b'\xe2\x94':
            # Another box character pattern
            if i + 3 < len(bytes_data) and bytes_data[i+2] in (0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8d, 0x8e, 0x8f,
                                                               0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f,
                                                               0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xab, 0xac, 0xad, 0xae, 0xaf,
                                                               0xb0, 0xb1, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xbb, 0xbc, 0xbd, 0xbe, 0xbf):
                i += 3
                continue
        
        result.append(bytes_data[i])
        i += 1
    
    return bytes(result)

def fix_file(filepath):
    """Fix encoding in a single file."""
    with open(filepath, 'rb') as f:
        content = f.read()
    
    # Check if file has BOM
    has_bom = content[:3] == b'\xef\xbb\xbf'
    
    # Remove BOM for processing
    if has_bom:
        content = content[3:]
    
    # Fix the encoding
    fixed_content = fix_box_cyrillic(content)
    
    # Add BOM back if it was there
    if has_bom:
        fixed_content = b'\xef\xbb\xbf' + fixed_content
    
    # Write back
    with open(filepath, 'wb') as f:
        f.write(fixed_content)
    
    # Count fix
    original_count = sum(1 for i in range(len(content)-1) if content[i:i+2] == b'\xe2\x95' or content[i:i+2] == b'\xe2\x96' or content[i:i+2] == b'\xe2\x94')
    fixed_count = sum(1 for i in range(len(fixed_content)-1) if fixed_content[i:i+2] == b'\xe2\x95' or fixed_content[i:i+2] == b'\xe2\x96' or fixed_content[i:i+2] == b'\xe2\x94')
    
    return original_count, fixed_count

if __name__ == '__main__':
    files = [
        'src/ui/screens/PlanScreen.tsx',
        'src/engines/training.engine.ts',
        'src/engines/training-periodization.engine.ts',
        'src/core/exercise-catalog.ts'
    ]
    
    for filepath in files:
        print(f"Processing {filepath}...")
        try:
            original, fixed = fix_file(filepath)
            print(f"  Original box chars: {original}")
            print(f"  Fixed box chars: {fixed}")
            print(f"  Fixed: {original - fixed} characters")
        except Exception as e:
            print(f"  ERROR: {e}")
