#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Check a specific example from the files
with open('src/ui/screens/PlanScreen.tsx', 'rb') as f:
    content = f.read()

# Decode to get the text
text = content.decode('utf-8')

# Find the section with exercise labels
import re
pattern = r"value:\s*'([^']+)',\s*label:\s*'([^']+)'"
matches = re.findall(pattern, text)

# Show some examples
print('Sample exercise labels (first 10):')
for v, l in matches[:10]:
    print(f'  value={v}, label={l}')

# Also check training.engine.ts
with open('src/engines/training.engine.ts', 'rb') as f:
    content = f.read()
text2 = content.decode('utf-8')

print('\n\nChecking training.engine.ts for key phrases:')
phrases = ['Жим', 'ГРУДЬ', 'спит', 'присед', 'ровка', 'LEVEL_CONFIGS', 'TRAINING_LEVELS']
for p in phrases:
    if p in text2:
        print(f'  Found: {p}')
    else:
        print(f'  Not found: {p}')
