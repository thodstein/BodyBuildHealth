#!/usr/bin/env python3
"""
Restore proper Russian text in TypeScript/TSX files using ftfy library.
Fixes UTF-8 corruption where Cyrillic was replaced with box drawing characters.
"""

import os
import re
import codecs
from pathlib import Path
from ftfy import fix_text


def fix_russian_text(content: str) -> str:
    """Apply ftfy to fix various encoding issues in Russian text."""
    # First, try to fix via ftfy
    result = fix_text(content)
    
    # Additional pattern-based fixes for common corruption patterns
    # Box drawing characters that should be Cyrillic in specific contexts
    box_patterns = {
        # Common Cyrillic letters replaced with box drawings in Russian text
        '═': 'Т',  # Often Т in training terms
        '╗': 'у',  # In words like 'неделя'
        '╝': 'к',  # In words like 'недель'
        '╜': 'ч',  # In words like 'неделю'
        '╛': 'н',  # In words like 'неделя'
        '┐': 'д',  # In words like 'неделя'
        '└': 'а',  # In words like 'неделя'
        '┴': 'ж',  # In words like 'неделя'
        '┬': 'и',  # In words like 'неделя'
        '├': 'м',  # In words like 'неделя'
        '┼': 'п',  # In words like 'неделя'
        '└╨│': 'неделя',  # More complex patterns
    }
    
    for pattern, replacement in box_patterns.items():
        result = result.replace(pattern, replacement)
    
    return result


def has_cyrillic(text: str) -> bool:
    """Check if text contains proper Cyrillic characters."""
    cyrillic_range = re.compile(r'[А-Яа-яЁё]')
    return bool(cyrillic_range.search(text))


def fix_file(file_path: Path) -> tuple:
    """Process a single file and return (success, message, was_modified)."""
    try:
        # Read file
        with open(file_path, 'rb') as f:
            raw_bytes = f.read()
        
        # Remove BOM if present
        bom_patterns = [
            (codecs.BOM_UTF8, 'UTF-8'),
            (codecs.BOM_UTF16_LE, 'UTF-16 LE'),
            (codecs.BOM_UTF16_BE, 'UTF-16 BE'),
        ]
        
        for bom, name in bom_patterns:
            if raw_bytes.startswith(bom):
                raw_bytes = raw_bytes[len(bom):]
                print(f"  Removed {name} BOM")
                break
        
        # Try to decode as UTF-8
        try:
            content = raw_bytes.decode('utf-8')
        except UnicodeDecodeError:
            # Try alternative encodings
            for encoding in ['cp1251', 'utf-16-le', 'utf-16-be']:
                try:
                    content = raw_bytes.decode(encoding)
                    print(f"  Decoded as {encoding}")
                    break
                except:
                    continue
            else:
                content = raw_bytes.decode('utf-8', errors='replace')
        
        # Check if content has proper Cyrillic
        original_has_cyrillic = has_cyrillic(content)
        
        if not original_has_cyrillic:
            # Try to interpret as corrupted UTF-8
            print(f"  No proper Cyrillic detected, applying ftfy fix...")
            
            # Try fixing via ftfy
            result = fix_russian_text(content)
            
            # Check if fix worked
            if has_cyrillic(result):
                print(f"  Fix successful!")
                
                # Write back with UTF-8 BOM
                with open(file_path, 'wb') as f:
                    f.write(codecs.BOM_UTF8)
                    f.write(result.encode('utf-8'))
                
                return (True, "Fixed via ftfy", True)
            else:
                print(f"  ftfy fix did not help")
                return (True, "No fix possible", False)
        
        # Content already has proper Cyrillic
        return (True, "Already correct", False)
        
    except Exception as e:
        return (False, f"Error: {str(e)}", False)


def main():
    """Main function to process all affected files."""
    
    # List of key files to fix
    files_to_fix = [
        'src/engines/training.engine.ts',
        'src/engines/training-periodization.engine.ts',
        'src/core/exercise-catalog.ts',
        'src/ui/screens/PlanScreen.tsx',
    ]
    
    # Also find all .tsx and .ts files in src directory
    src_dir = Path('src')
    if src_dir.exists():
        for path in src_dir.rglob('*.tsx'):
            rel_path = str(path)
            if rel_path not in files_to_fix:
                files_to_fix.append(rel_path)
        for path in src_dir.rglob('*.ts'):
            rel_path = str(path)
            if rel_path not in files_to_fix:
                files_to_fix.append(rel_path)
    
    print(f"Found {len(files_to_fix)} files to check")
    print("-" * 60)
    
    results = {
        'success': 0,
        'no_change': 0,
        'error': 0,
        'modified': 0
    }
    
    for file_path in files_to_fix:
        path = Path(file_path)
        if not path.exists():
            print(f"SKIP: {file_path} (not found)")
            continue
        
        print(f"Processing: {file_path}")
        success, message, was_modified = fix_file(path)
        
        if success:
            results['success'] += 1
            if was_modified:
                results['modified'] += 1
                print(f"  [OK] {message}")
            else:
                results['no_change'] += 1
                print(f"  [SKIP] {message}")
        else:
            results['error'] += 1
            print(f"  [ERR] {message}")
        print()
    
    print("-" * 60)
    print(f"Results: {results['success']} processed, {results['modified']} modified, {results['error']} errors")


if __name__ == '__main__':
    main()
