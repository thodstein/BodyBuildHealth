#!/usr/bin/env python3
"""
Analyze the actual bytes in the file to understand the encoding issue.
"""

with open('D:/V9/src/ui/screens/PlanScreen.tsx', 'rb') as f:
    content = f.read()

# Skip BOM
if content[:3] == b'\xef\xbb\xbf':
    content = content[3:]

# Position 1205 has 'Набор' (d09dd0b0d0b1d0bed180)
# Then at position 1210 we have: e295a8e2959de295a8
# Let's decode this as UTF-8

print(f'Bytes at 1210: {content[1210:1215].hex()}')
print(f'Bytes at 1210-1220: {content[1210:1220].hex()}')

# Decode as UTF-8
try:
    decoded = content[1210:1215].decode('utf-8')
    print(f'Decoded: {repr(decoded)}')
except Exception as e:
    print(f'Error: {e}')

# Let's try to understand what the original garbled text was
# by looking at the byte patterns
# e295a8 = U+2568 (BOX DRAWINGS LIGHT ARC UP) - this is a box drawing character
# e2959d = U+255D (BOX DRAWINGS DOUBLE UP AND RIGHT) - another box drawing character

# So the garbled text is actually box drawing characters that were placed incorrectly
# The original text was probably Cyrillic that got encoded/decoded wrong

# Let me try: the bytes might be UTF-8 of UTF-8 (double encoding)
# If we have UTF-8 bytes and we read them as Latin-1 then encode back to UTF-8
# we get double encoding

# Let's check if that's the case
garbled_bytes = content[1210:1215]
print(f'\nTrying to decode as Latin-1 then encode to UTF-8:')
latin1_str = garbled_bytes.decode('latin-1')
print(f'Latin-1: {repr(latin1_str)}')

# Try to encode as UTF-8
try:
    utf8_back = latin1_str.encode('utf-8')
    print(f'UTF-8 back: {utf8_back.hex()}')
except Exception as e:
    print(f'Error: {e}')
