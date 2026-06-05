#!/usr/bin/env python3
"""
Check the actual bytes at position 1205.
"""

with open('D:/V9/src/ui/screens/PlanScreen.tsx', 'rb') as f:
    content = f.read()
    
# Skip BOM
if content[:3] == b'\xef\xbb\xbf':
    content = content[3:]

# Find position 1205
print(f'Bytes at 1205: {content[1205:1230].hex()}')

# Try to decode as UTF-8
try:
    decoded = content[1205:1230].decode('utf-8')
    print(f'As UTF-8: {decoded}')
except Exception as e:
    print(f'UTF-8 decode error: {e}')

# The correct UTF-8 for 'Набор' is: d0 9d d0 b0 d0 b1 d0 be d1 80
correct_nabor = b'\xd0\x9d\xd0\xb0\xd0\xb1\xd0\xbe\xd1\x80'
print(f'Correct Набор bytes: {correct_nabor.hex()}')

# Check if this pattern exists in the file
count = content.count(correct_nabor)
print(f'Found {count} occurrences of correct Набор')

# Find the garbled pattern
# e2 95 a8 is U+2568 (box drawing)
garbled_pattern = b'\xe2\x95\xa8\xd0\xad\xe2\x95\xa8\xe2\x96\x91\xe2\x95\xa8\xe2\x96\x92\xe2\x95\xa8\xe2\x95\x9b\xe2\x95\xa4\xd0\x90'
count = content.count(garbled_pattern)
print(f'Garbled pattern count: {count}')
