#!/usr/bin/env python3
"""
Fix Cyrillic encoding - final attempt.
The file contains box drawing characters (U+2568, U+2591, etc.) instead of Cyrillic.
We need to identify these patterns and replace them with correct Cyrillic text.
"""

def fix_file(filepath):
    try:
        with open(filepath, 'rb') as f:
            content = f.read()
        
        # Remove BOM
        has_bom = content.startswith(b'\xef\xbb\xbf')
        if has_bom:
            content = content[3:]
        
        # The content has mixed bytes - some valid UTF-8, some box drawing chars
        # We need to decode with 'replace' to see what's there
        
        # Read as UTF-8, replacing errors
        text = content.decode('utf-8', errors='replace')
        
        # Now we need to identify the box drawing patterns
        # Box drawing chars start at U+2500 (box drawings)
        
        # Let's find all U+25XX characters and their context
        box_chars = []
        for i, c in enumerate(text):
            if ord(c) >= 0x2500 and ord(c) < 0x2600:
                box_chars.append((i, c, hex(ord(c))))
        
        print(f"Found {len(box_chars)} box drawing chars")
        if box_chars:
            print(f"First 10: {box_chars[:10]}")
        
        # Try to replace U+2568 (╚) with something else
        # U+2568 is BOX DRAWINGS LIGHT ARC UP
        
        # Actually, the simplest approach: the garbled text
        # '╨Э╨░╨▒╨╛╤А' when encoded as UTF-8 gives us the bytes we see
        # So we need to DECODE these bytes as if they were Windows-1251
        
        # But the bytes are already UTF-8 of the garbled text
        # We need to find and replace these patterns
        
        # Let me try a different approach:
        # Find all occurrences of U+2568 (╚) and look at context
        
        with open(filepath.replace('.tsx', '_debug.txt'), 'w', encoding='utf-8') as out:
            out.write(f"Found {len(box_chars)} box drawing chars\n")
            for i, (pos, char, hex_val) in enumerate(box_chars[:20]):
                # Show context
                start = max(0, pos - 10)
                end = min(len(text), pos + 10)
                context = text[start:end]
                out.write(f"Pos {pos}: {char} ({hex_val}) in context: {repr(context)}\n")
        
        print(f"Debug output written to {filepath.replace('.tsx', '_debug.txt')}")
        
        return True
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

fix_file('D:/V9/src/ui/screens/PlanScreen.tsx')
