import os, re

base = 'D:/BodyBuildHealth/src'
problem_files = []

for root, dirs, files in os.walk(base):
    for f in files:
        if f.endswith(('.ts', '.tsx')):
            fp = os.path.join(root, f)
            try:
                with open(fp, 'r', encoding='utf-8') as fh:
                    content = fh.read()
                replacements = content.count('\ufffd')
                # Find lines with ?? followed by Russian text
                bad_lines = 0
                for line in content.split('\n'):
                    if '?? ' in line or '??\u0410' in line or '??\u0430' in line:
                        if 'null ??' not in line and 'undefined ??' not in line:
                            bad_lines += 1
                if bad_lines > 2 or replacements > 0:
                    rel = os.path.relpath(fp, base)
                    problem_files.append((rel, bad_lines, replacements))
            except:
                pass

print(f'Files with issues: {len(problem_files)}')
for path, m, r in sorted(problem_files, key=lambda x: -x[1]):
    print(f'  {path}: {m} bad lines, {r} replacement chars')
