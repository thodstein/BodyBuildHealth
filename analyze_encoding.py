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
        print(f"UTF-8 decoded: {context.decode('utf-8', errors='replace')}")

if __name__ == '__main__':
    analyze_file('src/ui/screens/PlanScreen.tsx')
    analyze_file('src/engines/training.engine.ts')
    analyze_file('src/engines/training-periodization.engine.ts')
    analyze_file('src/core/exercise-catalog.ts')
