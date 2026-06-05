#!/usr/bin/env python3
# Read the file as UTF-8 and just save it again

with open('D:/V9/src/ui/screens/PlanScreen.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Save back
with open('D:/V9/src/ui/screens/PlanScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Done')
