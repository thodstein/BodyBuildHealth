#!/usr/bin/env python3

with open('D:/V9/src/ui/screens/PlanScreen.tsx', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Show lines 12-20
lines = content.split('\n')
for i in range(12, min(20, len(lines))):
    print(f'Line {i}: {repr(lines[i])}')
