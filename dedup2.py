import re
import sys

def process_object(lines, start_index, end_index, object_name):
    # We'll process lines[start_index:end_index] (inclusive start, exclusive end)
    inner_lines = lines[start_index:end_index]
    seen = set()
    new_inner_lines = []
    for line in inner_lines:
        stripped = line.strip()
        if stripped == '':
            continue
        # Extract key: everything before the first colon that is outside quotes.
        # We'll split by ':' and take the first part.
        if ':' in stripped:
            parts = stripped.split(':')
            key_part = parts[0].strip()
            # Remove surrounding quotes if present
            if len(key_part) >= 2 and (key_part.startswith('\"') and key_part.endswith('\"') or key_part.startswith(\"'\") and key_part.endswith(\"'\")):
                key = key_part[1:-1]
            else:
                key = key_part
            if key in seen:
                continue
            seen.add(key)
        new_inner_lines.append(line)
    # Replace the lines
    new_lines = lines[:start_index] + new_inner_lines + lines[end_index:]
    return new_lines

def main():
    file_path = 'src/core/lab-auto-parser.ts'
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    # Find MARKER_ALIASES
    start_marker = 'const MARKER_ALIASES: Record<string, string> = {'
    end_marker = '};'
    start_index = -1
    end_index = -1
    for i, line in enumerate(lines):
        if line.strip() == start_marker:
            start_index = i
            break
    if start_index != -1:
        for i in range(start_index, len(lines)):
            if lines[i].strip() == end_marker:
                end_index = i + 1  # exclusive
                break
        if end_index != -1:
            lines = process_object(lines, start_index, end_index, 'MARKER_ALIASES')
    # Find UNIT_ALIASES
    start_marker = 'const UNIT_ALIASES: Record<string, string> = {'
    end_marker = '};'
    start_index = -1
    end_index = -1
    for i, line in enumerate(lines):
        if line.strip() == start_marker:
            start_index = i
            break
    if start_index != -1:
        for i in range(start_index, len(lines)):
            if lines[i].strip() == end_marker:
                end_index = i + 1  # exclusive
                break
        if end_index != -1:
            lines = process_object(lines, start_index, end_index, 'UNIT_ALIASES')
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print('Deduplication done.')

if __name__ == '__main__':
    main()
