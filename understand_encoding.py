#!/usr/bin/env python3
"""
Understand the exact byte patterns and fix them.
"""

with open('D:/V9/src/ui/screens/PlanScreen.tsx', 'rb') as f:
    content = f.read()

# Skip BOM
if content[:3] == b'\xef\xbb\xbf':
    content = content[3:]

# Position 1205 has: d09dd0b0d0b1d0bed180 (Набор)
# Then at position 1210 we have garbage
# Let's look at what SHOULD be there

# The line is: { value: 'bulk', label: 'Набор скилла' }
# But the garbled text is: '╨Э╨░╨▒╨╛╤А ╨╝╨░╤Б╤Б╤Л'

# Let's decode the garbled text as UTF-8 to see what bytes it contains
garbled = '╨Э╨░╨▒╨╛╤А ╨╝╨░╤Б╤Б╤Л'
garbled_bytes = garbled.encode('utf-8')
print(f"Garbled '╨Э╨░╨▒╨╛╤А ╨╝╨░╤Б╤Б╤Л':")
print(f"  Hex: {garbled_bytes.hex()}")
print(f"  Expected: d09dd0b0d0b1d0bed18020d181d0bcd0bed0b6d0bed182d0b0 (Набор скилла)")

# Let's check what's at position 1205+5=1210
print(f"\nBytes at 1210: {content[1210:1230].hex()}")

# The correct bytes for ' скилла' would be: 20d181d0bcd0bed0b6d0bed182d0b0
# But we have garbage: e295a8e2959de295a8...

# Let me check if maybe the garbled text bytes are actually UTF-8 of UTF-8
# i.e., the original was Windows-1251, read as UTF-8, written as UTF-8

# Try to decode the garbled bytes as if they were Windows-1251
garbled_at_1210 = content[1210:1230]
print(f"\nTrying to interpret bytes at 1210 as Windows-1251:")
try:
    decoded = garbled_at_1210.decode('windows-1251')
    print(f"  As Windows-1251: {repr(decoded)}")
except Exception as e:
    print(f"  Error: {e}")

# Try to interpret as Latin-1 then re-encode to Windows-1251
try:
    latin1_str = garbled_at_1210.decode('latin-1')
    print(f"  As Latin-1: {repr(latin1_str)}")
    # Now encode these characters to Windows-1251 bytes
    win1251_bytes = latin1_str.encode('windows-1251')
    print(f"  Windows-1251 bytes: {win1251_bytes.hex()}")
except Exception as e:
    print(f"  Error: {e}")
