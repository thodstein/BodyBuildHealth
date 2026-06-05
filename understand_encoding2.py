#!/usr/bin/env python3
"""
Understand the exact byte patterns and fix them.
"""

with open('D:/V9/src/ui/screens/PlanScreen.tsx', 'rb') as f:
    content = f.read()

# Skip BOM
if content[:3] == b'\xef\xbb\xbf':
    content = content[3:]

# Position 1205 has correct 'Набор' (5 bytes)
# Position 1210 starts the garbled section

# The garbled text at 1210 is: e295a8e2959de295a8...
# Let's find where this garbled section ends

# Look for the pattern that indicates end of garbled section
# We expect to see d0 b0 (а) which would be the start of the next word

for i in range(1210, 1240):
    print(f"Position {i}: {content[i]} (0x{content[i]:02x}) {'valid UTF-8' if content[i] < 128 or (content[i] >= 0xc0 and content[i] < 0xf0) else 'invalid'}")

# Let me check if the garbled bytes, when interpreted as Latin-1 and encoded as Windows-1251, 
# would give us the correct bytes

garbled_section = content[1210:1240]
print(f"\nGarbled bytes at 1210: {garbled_section.hex()}")

# Decode as Latin-1
latin1 = garbled_section.decode('latin-1')
print(f"As Latin-1: {latin1}")

# Try to encode to Windows-1251
try:
    win1251 = latin1.encode('windows-1251')
    print(f"As Windows-1251: {win1251.hex()}")
except Exception as e:
    print(f"Error encoding to Windows-1251: {e}")
    
    # Try with error handling
    win1251 = latin1.encode('windows-1251', errors='replace')
    print(f"As Windows-1251 (with replace): {win1251.hex()}")
