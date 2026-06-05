#!/usr/bin/env python3
# -*- coding: utf-8 -*-

content = open('src/core/exercise-catalog.ts', 'rb').read()

# Check the full context around position 113
pos = 113
print(f"Context starting at pos {pos}:")
raw_bytes = content[pos:pos+200]
print(f"Hex: {raw_bytes.hex()}")

# Try to decode
try:
    decoded = raw_bytes.decode('utf-8', errors='replace')
    print(f"Decoded (with replace): {decoded[:100]}")
except Exception as e:
    print(f"Decode error: {e}")

# Check what the original should look like by searching for Cyrillic
# The comment starts with // and should have Cyrillic text
print("\n\nSearching for Cyrillic bytes (d0.., d1..) after position 113:")
i = 0
cyrillic_positions = []
while i < len(content):
    if content[i] == 0xd0 or content[i] == 0xd1:
        cyrillic_positions.append(i)
    i += 1

print(f"Total Cyrillic start bytes: {len(cyrillic_positions)}")
print(f"First 10 positions: {cyrillic_positions[:10]}")

# Check if there are Cyrillic bytes anywhere
# Looking for the actual Cyrillic text in comments
print("\n\nSearching for 'Каталог' (Catalog in Cyrillic) in bytes:")
catalog_bytes = 'Каталог'.encode('utf-8')
print(f"'Каталог' UTF-8 bytes: {catalog_bytes.hex()}")

pos = content.find(catalog_bytes)
print(f"Found at pos: {pos}")

# Let's look for the actual text by searching for patterns
# // Каталог упражнений
print("\n\nSearching for 'Каталог' bytes in file:")
# К = d09a, а = d0b0, т = d182, а = d0b0, л = d0bb, о = d0be, г = d0b3
catalog_pattern = bytes([0xd0, 0x9a, 0xd0, 0xb0, 0xd1, 0x82, 0xd0, 0xb0, 0xd0, 0xbb, 0xd0, 0xbe, 0xd0, 0xb3])
pos = content.find(catalog_pattern)
print(f"Found pattern at pos: {pos}")
if pos >= 0:
    print(f"Context: {content[pos:pos+50]}")
