#!/usr/bin/env python3
"""
Find and fix the exact byte patterns in the file.
"""

with open('D:/V9/src/ui/screens/PlanScreen.tsx', 'rb') as f:
    content = f.read()

# Skip BOM
if content[:3] == b'\xef\xbb\xbf':
    content = content[3:]

# The correct bytes for Набор are at position 1205
# After that, there's garbled text starting at position 1210

# Let's find where the garbled section ends
# The garbled section appears to be: e295a8e2959de295a8e29691e295a8e29692e295a8e2959be295a4d090

# Find all occurrences of e2 95 a8 (which is U+2568 - BOX DRAWINGS LIGHT ARC UP)
positions = []
for i in range(len(content) - 2):
    if content[i:i+3] == b'\xe2\x95\xa8':
        positions.append(i)

print(f"Found {len(positions)} occurrences of \\xe2\\x95\\xa8")
for pos in positions[:10]:
    print(f"  Position {pos}: {content[pos:pos+30].hex()}")

# Let's also look for d0 9d (Н)
n_positions = []
for i in range(len(content) - 1):
    if content[i:i+2] == b'\xd0\x9d':
        n_positions.append(i)

print(f"\nFound {len(n_positions)} occurrences of \\xd0\\x9d (Н)")
for pos in n_positions:
    print(f"  Position {pos}: {content[pos:pos+30].hex()}")
