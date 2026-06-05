#!/usr/bin/env python3
"""
Analyze the actual bytes in the file to understand the encoding issue.
"""

with open('D:/V9/src/ui/screens/PlanScreen.tsx', 'rb') as f:
    content = f.read()

# Skip BOM
if content[:3] == b'\xef\xbb\xbf':
    content = content[3:]

# Look for the pattern d0 9d followed by other bytes
positions = []
for i in range(len(content) - 15):
    if content[i:i+2] == b'\xd0\x9d':  # 'Н' in UTF-8
        # Show 20 bytes
        byte_seq = content[i:i+20]
        print(f'Found Н at {i}: {byte_seq.hex()}')
        
        # Try to decode as UTF-8
        try:
            decoded = byte_seq.decode('utf-8')
            print(f'  As UTF-8: {repr(decoded)}')
        except Exception as e:
            print(f'  UTF-8 decode error: {e}')
        
        positions.append(i)
        if len(positions) >= 4:
            break

print(f"\nTotal: {len(positions)} occurrences")
