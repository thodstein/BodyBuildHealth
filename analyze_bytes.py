#!/usr/bin/env python3
"""
Analyze the actual bytes in the file to understand the encoding issue.
"""

with open('D:/V9/src/ui/screens/PlanScreen.tsx', 'rb') as f:
    content = f.read()

# Skip BOM
if content[:3] == b'\xef\xbb\xbf':
    content = content[3:]

# Find all positions with bytes that look like mixed encoding
# We expect: d0 9d d0 b0 d0 b1 d0 be d1 80 (Набор in UTF-8)
# But we see something else

# Look for the pattern d0 9d followed by other bytes
positions = []
for i in range(len(content) - 5):
    if content[i:i+2] == b'\xd0\x9d':  # 'Н' in UTF-8
        positions.append(i)
        print(f'Found Н at {i}: {content[i:i+10].hex()} -> {content[i:i+10]}')

print(f"\nFound {len(positions)} occurrences of 'Н'")
