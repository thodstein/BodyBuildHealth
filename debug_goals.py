#!/usr/bin/env python3
import re

with open('D:/V9/src/ui/screens/PlanScreen.tsx', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Find GOALS section
lines = content.split('\n')
for i, line in enumerate(lines):
    if 'GOALS' in line:
        print(f'Line {i}: {line}')
