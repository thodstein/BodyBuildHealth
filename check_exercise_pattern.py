#!/usr/bin/env python3
# -*- coding: utf-8 -*-

content = open('src/core/exercise-catalog.ts', 'rb').read()
# Find all box drawing character sequences
box_positions = []
i = 0
while i < len(content) - 2:
    if content[i:i+2] == b'\xe2\x95' and content[i+2] == 0x90:
        box_positions.append(i)
    i += 1

print(f"Total U+2550 box chars: {len(box_positions)}")
print(f"First 5 positions: {box_positions[:5]}")

# Check context around first box char
if box_positions:
    pos = box_positions[0]
    print(f"\nContext at pos {pos}:")
    print(f"Bytes: {content[pos:pos+50].hex()}")
    
    # Check what comes after
    after_box = content[pos+3:pos+5]
    print(f"After box (2 bytes): {after_box.hex()}")
    
    # Check if these are Cyrillic bytes
    if after_box[0] == 0xd0:
        # Cyrillic UTF-8 2-byte sequence
        try:
            decoded = bytes([after_box[0], after_box[1]]).decode('utf-8')
            print(f"Decoded after box: '{decoded}'")
        except:
            print("Cannot decode")
