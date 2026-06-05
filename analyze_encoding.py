#!/usr/bin/env python3
# -*- coding: utf-8 -*-

def analyze_file(filepath):
    with open(filepath, 'rb') as f:
        content = f.read()
    
    # Find all box drawing character sequences
    box_positions = []
    i = 0
    while i < len(content) - 2:
        if content[i:i+2] == b'\xe2\x95':
            box_positions.append(i)
            i += 3  # Skip the 3-byte sequence
        else:
            i += 1
    
    print(f"\n=== {filepath} ===")
    print(f"Total box drawing sequences: {len(box_positions)}")
    print(f"First 10 positions: {box_positions[:10]}")
    
    # Analyze context around first few
    for pos in box_positions[:3]:
        start = max(0, pos - 50)
        end = min(len(content), pos + 100)
        context = content[start:end]
        
        print(f"\n--- Context at position {pos} ---")
        print(f"Hex bytes: {context.hex()}")
        try:
            decoded = context.decode('utf-8', errors='replace')
            print(f"UTF-8 decoded: {decoded}", flush=True)
        except:
            print("UTF-8 decoded: [contains box chars that can't be printed]", flush=True)
        
        # Try to understand the pattern - extract just the garbled part
        garbled_start = pos
        # Find where the string ends (look for closing quote and comma)
        garbled_end = pos
        while garbled_end < len(content) and content[garbled_end:garbled_end+1] != b"'" and content[garbled_end:garbled_end+2] != b"'}":
            garbled_end += 1
        garbled_end += 1  # Include the closing quote
        
        if garbled_end > pos:
            garbled_bytes = content[pos:garbled_end]
            print(f"\nGarbled bytes: {garbled_bytes.hex()}", flush=True)
            box_positions_in_garbled = [i-pos for i in box_positions if pos <= i < garbled_end]
            print(f"Box positions in garbled: {box_positions_in_garbled}", flush=True)

if __name__ == '__main__':
    analyze_file('src/ui/screens/PlanScreen.tsx')
    analyze_file('src/engines/training.engine.ts')
    analyze_file('src/engines/training-periodization.engine.ts')
    analyze_file('src/core/exercise-catalog.ts')
