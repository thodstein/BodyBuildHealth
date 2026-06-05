#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('src/ui/screens/PlanScreen.tsx', 'rb') as f:
    content = f.read()
    
# Count remaining box characters
box_count = sum(1 for i in range(len(content)-1) if content[i:i+2] == b'\xe2\x95' or content[i:i+2] == b'\xe2\x96')
print(f'Remaining box chars: {box_count}')

# Find first remaining box char
for i in range(len(content)-2):
    if content[i:i+2] == b'\xe2\x95':
        char_code = 0x2500 + (content[i+2] - 0x90) if content[i+2] >= 0x90 and content[i+2] <= 0x9f else None
        print(f'First at pos {i}: {content[i:i+5].hex()} -> U+{0x2500 + (content[i+2] - 0x90):04X}' if char_code else f'First at pos {i}: {content[i:i+5].hex()}')
        break

# Check the remaining bytes
for i in range(len(content)-2):
    if content[i:i+2] == b'\xe2\x95':
        byte3 = content[i+2]
        print(f'Box char at {i}: e2 95 {byte3:02x}')
        