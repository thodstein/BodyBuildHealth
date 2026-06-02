import re
with open('src/core/lab-auto-parser.ts', 'r', encoding='utf-8') as f:
    content = f.read()
# Find MARKER_ALIASES
pattern = re.compile(r'const\\s+MARKER_ALIASES\\s*:\\s*Record<string,\\s*string>\\s*=\\s*\\{([^}]+)\\};' , re.DOTALL)
match = pattern.search(content)
if match:
    inner = match.group(1)
    # Split by lines, then by ':'
    lines = [line.strip() for line in inner.split(',') if line.strip()]
    seen = {}
    new_lines = []
    for line in lines:
        # line is like 'key': 'value'
        if ': ' in line:
            key = line.split(':')[0].strip().strip(\"'\"")
            if key not in seen:
                seen[key] = True
                new_lines.append(line)
        else:
            new_lines.append(line)
    new_inner = ', '.join(new_lines)
    new_content = content[:match.start()] + f'const MARKER_ALIASES: Record<string, string> = {{{new_inner}}};' + content[match.end():]
    # Now do the same for UNIT_ALIASES
    pattern2 = re.compile(r'const\\s+UNIT_ALIASES\\s*:\\s*Record<string,\\s*string>\\s*=\\s*\\{([^}]+)\\};' , re.DOTALL)
    match2 = pattern2.search(new_content)
    if match2:
        inner2 = match2.group(1)
        lines2 = [line.strip() for line in inner2.split(',') if line.strip()]
        seen2 = {}
        new_lines2 = []
        for line in lines2:
            if ': ' in line:
                key2 = line.split(':')[0].strip().strip(\"'\"")
                if key2 not in seen2:
                    seen2[key2] = True
                    new_lines2.append(line)
            else:
                new_lines2.append(line)
        new_inner2 = ', '.join(new_lines2)
        new_content = new_content[:match2.start()] + f'const UNIT_ALIASES: Record<string, string> = {{{new_inner2}}};' + new_content[match2.end():]
    with open('src/core/lab-auto-parser.ts', 'w', encoding='utf-8') as f:
        f.write(new_content)
print('Deduplication done')
