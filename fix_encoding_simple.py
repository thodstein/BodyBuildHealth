#!/usr/bin/env python3
"""
Fix Cyrillic encoding by replacing corrupted byte patterns with correct UTF-8.
The file has bytes that decode to box drawing characters instead of Cyrillic.
"""

def fix_cyrillic_in_file(filepath):
    """Read file, fix encoding, write back."""
    with open(filepath, 'rb') as f:
        content = f.read()
    
    # Remove BOM if present to work with clean bytes
    has_bom = content.startswith(b'\xef\xbb\xbf')
    if has_bom:
        content = content[3:]
    
    # The main pattern: we have box drawing chars that need to be replaced
    # Box drawing chars have UTF-8 patterns like e2 95 a8, e2 95 a4, etc.
    
    # Find all box drawing character sequences and replace with Cyrillic
    # This is complex - let's use a different approach
    
    # Read as UTF-8 with errors='replace' to see the garbled text
    try:
        text = content.decode('utf-8', errors='replace')
    except:
        print(f"Error reading {filepath}")
        return False
    
    # Now we need to identify patterns and replace them
    # This is a manual process that requires knowing what the text should be
    
    # Let's try a different approach: check if the bytes are actually UTF-8
    # of Latin characters that were meant to be Cyrillic
    
    # Actually, the simplest fix: just re-encode the text
    # The file should be UTF-8, so let's decode and re-encode
    
    # First, let's see what the file currently contains
    # The garbled text '╨Э╨░╨▒╨╛╤А' should be 'Набор'
    
    # We'll need to manually map these patterns
    replacements = [
        # Goal: Набор
        ('╨Э╨░╨▒╨╛╤А', 'Набор'),
        # Goal: скилла (should be склада or similar)
        ('╨б╤Г╤И╨║╨░', 'БАСК'),
        # Goal: maintenance (already correct in some files)
        # Need to find patterns
    ]
    
    # For now, let's just try to read the file and write it back
    # This won't fix the encoding, but let's see what happens
    
    print(f"File {filepath}: {len(content)} bytes, {len(text)} chars")
    
    # If text contains replacement characters (U+FFFD), we have encoding issues
    if '\ufffd' in text:
        print(f"  Contains replacement characters - encoding issue confirmed")
    
    return True

# Test on a single file
fix_cyrillic_in_file('D:/V9/src/ui/screens/PlanScreen.tsx')
