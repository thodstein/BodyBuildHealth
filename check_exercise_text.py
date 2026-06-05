#!/usr/bin/env python3
# -*- coding: utf-8 -*-

content = open('src/core/exercise-catalog.ts', 'rb').read()

# Find the Cyrillic text in the file
# From the hex, I can see: d096d0b8d0bc = Жиб (Zhib)
# Let's find all Cyrillic sequences

print("Looking for Cyrillic text patterns...")

# Find first occurrence of valid Cyrillic after position 100
i = 100
while i < len(content) - 1:
    if content[i] == 0xd0 or content[i] == 0xd1:
        # Found start of Cyrillic UTF-8
        end = i
        while end < len(content) - 1:
            next_byte = content[end + 1]
            if next_byte == 0xd0 or next_byte == 0xd1:
                # Check if it's continuation of same character
                if end + 2 < len(content):
                    # d0* d1* sequences are valid
                    pass
                end += 2 if next_byte == 0xd0 else 2
            elif next_byte >= 0x80 and next_byte < 0xc0:
                # Continuation byte
                end += 1
            else:
                break
        break
    i += 1

print(f"First Cyrillic sequence at position {i}:")
# Print more context
start = max(0, i - 20)
end = min(len(content), i + 100)
raw = content[start:end]

print(f"Raw hex (first 200): {raw[:200].hex()}")

# Try to decode with error handling
try:
    decoded = raw.decode('utf-8', errors='replace')
    print(f"Decoded: {decoded[:100]}")
except Exception as e:
    print(f"Decode error: {e}")

# Let's look for specific Cyrillic characters
# Ж = d096, и = d0b8, б = d0b1, ч = d187, т = d182, а = d0b0, н = d0bd, г = d0b3, и = d0b8
# "Жибчтаниги" - this looks like it could be a exercise name

print("\n\nSearching for specific Cyrillic bytes in exercise names:")

# Search for "bench_bar" pattern (English) and see what comes before/after
bench_pattern = b"bench_bar"
pos = content.find(bench_pattern)
if pos >= 0:
    print(f"Found 'bench_bar' at pos {pos}")
    print(f"Context before: {content[pos-100:pos+100]}")
    
    # The exercise name should be in Cyrillic before the English name
    # Let's look for Cyrillic text around position 171-175
    cyrillic_area = content[170:200]
    print(f"\nCyrillic area (170-200): {cyrillic_area.hex()}")
    
    try:
        decoded = cyrillic_area.decode('utf-8')
        print(f"Decoded: {decoded}")
    except Exception as e:
        print(f"Decode error: {e}")
