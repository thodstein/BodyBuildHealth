#!/usr/bin/env python3
"""
Comprehensive encoding fix script for training-related TypeScript/TSX files.
Uses ftfy (fixes text for you) library to restore proper Russian text.
"""

import os
import re
import codecs
from pathlib import Path

try:
    from ftfy import fix_text
except ImportError:
    print("Installing ftfy...")
    import subprocess
    subprocess.check_call(['pip', 'install', 'ftfy'])
    from ftfy import fix_text


# Box drawing character patterns to detect corruption
BOX_DRAWING_PATTERN = re.compile(
    r'[\u2500-\u259F]'  # Box drawing characters
)

# Common corrupted byte sequences (UTF-8 interpreted as CP1251/Latin-1)
CORRUPTED_SEQUENCES = {
    'тАФ': '-',  # En-dash – (U+2013)
    'тАИ': '"',  # Left double quotation mark "
    'тАЙ': "'",  # Left single quotation mark '
    'тАК': '>',  # Greater-than sign >
    'тАЛ': '<',  # Less-than sign <
    'тИП': '±',  # Plus-minus sign
    'тИР': '-',  # En-dash –
    'тИС': '…',  # Ellipsis
    'тКЦ': '®',  # Registered sign
    'тО®': '—',  # Em-dash —
    'тАМ': '(',  # Left parenthesis
    'тАП': ')',  # Right parenthesis
}


def detect_corruption(content: str) -> dict:
    """Detect various types of corruption in the content."""
    findings = {
        'box_drawings': len(BOX_DRAWING_PATTERN.findall(content)),
        'corrupted_sequences': {},
        'total_issues': 0
    }
    
    # Find corrupted sequences
    for corrupted, correct in CORRUPTED_SEQUENCES.items():
        if corrupted in content:
            count = content.count(corrupted)
            findings['corrupted_sequences'][corrupted] = count
            findings['total_issues'] += count
    
    return findings


def fix_box_drawings(content: str) -> str:
    """Replace box drawing characters with proper Cyrillic based on context."""
    result = content
    
    # Pattern for common box drawing replacements in Russian text
    # These patterns help identify what the original Cyrillic should be
    
    # Common Cyrillic letters that were replaced with box drawings
    # D0xx bytes in UTF-8 become E295xx (box drawing) in corrupted files
    
    # For training.engine.ts specifically, we need to analyze the pattern
    # D0 90 (А) -> E2 95 90 (═)
    # D0 91 (Б) -> E2 95 91 (║)
    # etc.
    
    # Try to detect and fix based on context
    # This is a heuristic approach
    
    # Replace single box drawing characters that might be Cyrillic
    # Based on common Russian letters in training files
    
    replacements = [
        # Training-related terms
        (r'═', 'Т'),  # Possible Т in training
        (r'║', 'е'),  # Possible е
        (r'╗', 'у'),  # Possible у
        (r'╝', 'к'),  # Possible к
        (r'╜', 'ч'),  # Possible ч
        (r'╛', 'н'),  # Possible н
        (r'┐', 'д'),  # Possible д
        (r'└', 'а'),  # Possible а
        (r'┴', 'ж'),  # Possible ж
        (r'┬', 'и'),  # Possible и
        (r'├', 'м'),  # Possible м
        (r'┼', 'п'),  # Possible п
        (r'┬─┬', 'ТЕКСТ'),  # Text separator
    ]
    
    for pattern, replacement in replacements:
        result = result.replace(pattern, replacement)
    
    return result


def fix_corrupted_sequences(content: str) -> str:
    """Fix commonly corrupted byte sequences."""
    result = content
    
    for corrupted, correct in CORRUPTED_SEQUENCES.items():
        result = result.replace(corrupted, correct)
    
    return result


def fix_utf8_issues(content: str) -> str:
    """Apply ftfy to fix various UTF-8 encoding issues."""
    try:
        return fix_text(content)
    except Exception as e:
        print(f"Warning: ftfy failed: {e}")
        return content


def fix_via_latin1(content: str) -> str:
    """
    Try to restore text by interpreting as Latin-1 then UTF-8.
    This handles cases where UTF-16 was converted to UTF-8 incorrectly.
    """
    try:
        # Encode to bytes using UTF-8, then interpret as Latin-1, then UTF-8
        bytes_data = content.encode('utf-8', errors='replace')
        
        # Try different interpretations
        for encoding in ['latin-1', 'cp1251', 'utf-16-le']:
            try:
                # Decode as specified encoding, then encode as UTF-8
                temp_str = bytes_data.decode(encoding, errors='replace')
                fixed_bytes = temp_str.encode('latin-1')
                result = fixed_bytes.decode('utf-8')
                
                # Check if result looks more Russian-like
                if 'й' in result or 'ц' in result or 'у' in result:
                    return result
            except:
                continue
        
        return content
    except Exception as e:
        print(f"Warning: Latin-1 fix failed: {e}")
        return content


def process_file(file_path: Path) -> tuple:
    """Process a single file and return (success, message, was_modified)."""
    try:
        # Read file as binary first
        with open(file_path, 'rb') as f:
            raw_bytes = f.read()
        
        # Check for BOM and remove it
        bom_patterns = [
            (codecs.BOM_UTF8, 'UTF-8'),
            (codecs.BOM_UTF16_LE, 'UTF-16 LE'),
            (codecs.BOM_UTF16_BE, 'UTF-16 BE'),
        ]
        
        original_encoding = 'UTF-8'
        for bom, name in bom_patterns:
            if raw_bytes.startswith(bom):
                original_encoding = name
                raw_bytes = raw_bytes[len(bom):]
                print(f"  Removed {name} BOM")
                break
        
        # Try to decode as UTF-8
        try:
            content = raw_bytes.decode('utf-8')
        except UnicodeDecodeError:
            # Try alternative encodings
            for encoding in ['cp1251', 'utf-16-le', 'latin-1']:
                try:
                    content = raw_bytes.decode(encoding)
                    print(f"  Decoded as {encoding}")
                    break
                except:
                    continue
            else:
                content = raw_bytes.decode('utf-8', errors='replace')
        
        # Detect initial corruption
        initial_issues = detect_corruption(content)
        
        if initial_issues['total_issues'] == 0 and initial_issues['box_drawings'] == 0:
            return (True, "No corruption detected", False)
        
        print(f"  Found {initial_issues['box_drawings']} box drawing chars")
        print(f"  Found {initial_issues['total_issues']} corrupted sequences")
        
        # Apply fixes in sequence
        result = content
        result = fix_box_drawings(result)
        result = fix_corrupted_sequences(result)
        result = fix_utf8_issues(result)
        result = fix_via_latin1(result)
        
        # Detect final corruption
        final_issues = detect_corruption(result)
        
        if final_issues['total_issues'] > initial_issues['total_issues'] * 0.8 and final_issues['box_drawings'] > initial_issues['box_drawings'] * 0.8:
            print(f"  Warning: Fix may not have helped")
            return (True, "No significant improvement", False)
        
        # Write back with UTF-8 BOM
        with open(file_path, 'wb') as f:
            f.write(codecs.BOM_UTF8)
            f.write(result.encode('utf-8'))
        
        return (
            True,
            f"Fixed: {initial_issues['box_drawings']} box chars, {initial_issues['total_issues']} corrupted sequences",
            True
        )
        
    except Exception as e:
        return (False, f"Error: {str(e)}", False)


def main():
    """Main function to process all affected files."""
    
    # List of files to fix (from the project state)
    files_to_fix = [
        'src/engines/training.engine.ts',
        'src/engines/training-periodization.engine.ts',
        'src/ui/screens/PlanScreen.tsx',
        # Add more files as needed
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
        success, message, was_modified = process_file(path)
        
        if success:
            results['success'] += 1
            if was_modified:
                results['modified'] += 1
                print(f"  ✓ {message}")
            else:
                results['no_change'] += 1
                print(f"  - {message}")
        else:
            results['error'] += 1
            print(f"  ✗ {message}")
        print()
    
    print("-" * 60)
    print(f"Results: {results['success']} processed, {results['modified']} modified, {results['error']} errors")


if __name__ == '__main__':
    main()
