#!/usr/bin/env python3
# Check the actual bytes in the file

with open('D:/V9/src/ui/screens/PlanScreen.tsx', 'rb') as f:
    content = f.read()
    
    # Skip BOM
    if content[:3] == b'\xef\xbb\xbf':
        content = content[3:]
        print("BOM found and skipped")
    
    # Find all non-ASCII bytes
    non_ascii_positions = []
    for i in range(len(content)):
        if content[i] > 127:
            non_ascii_positions.append(i)
    
    print(f"Found {len(non_ascii_positions)} non-ASCII bytes")
    
    # Show first few
    if non_ascii_positions:
        for pos in non_ascii_positions[:10]:
            # Show 20 bytes starting from this position
            byte_seq = content[pos:pos+20]
            print(f"\nPosition {pos}: {byte_seq.hex()}")
            
            # Try to decode as UTF-8
            try:
                decoded = byte_seq.decode('utf-8')
                print(f"  As UTF-8: {repr(decoded)}")
            except Exception as e:
                print(f"  UTF-8 decode error: {e}")
