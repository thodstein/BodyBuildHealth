#!/usr/bin/env python3
"""
Fix Cyrillic encoding in TypeScript/TSX files.
The files contain UTF-8 bytes of garbled text (like ╨Э╨░╨▒╨╛╤А) instead of proper Cyrillic (like Набор).
We need to:
1. Read the file as UTF-8 (getting garbled text with replacement chars)
2. Identify patterns that look like garbled Cyrillic
3. Replace them with correct Cyrillic text
"""

# Map of garbled text patterns to correct Cyrillic
REPLACEMENTS = {
    # Goal labels
    '╨Э╨░╨┐╨╛╨╗╨╜╨╡╨╜╨╕╨╡': 'Наполнение',
    '╤Б╨║╨╗╨░╨║╨░': 'скласса',  # БULK
    '╨│╨░╨╝╨╗╨╕╨║': 'галасс',   # CUT
    '╨┤╨╗╨╡╨┤': 'дасс',         # MAINTENANCE
    '╨▒╨╗╨╛╨║': 'бласс',         # STRENGTH
    '╤Б╨╕╨╗╨░': 'сасс',          # RECOMP
    '╤Б╨┐╨╗╨╕╨╗╨╕': 'спасс',     # REHAB
    
    # Level labels
    '╨Э╨╛╨▓╨╕╨║': 'новасс',      # BEGINNER
    '╨│╨░╨╝╨╗╨╕╨║': 'галасс',    # INTERMEDIATE  
    '╨┐╤А╨╛╨┤╨▓╨╕╨╜╨╡╨╜': 'прасс', # ADVANCED
    
    # Muscle groups
    '╨У╤А╨┤': 'расс',            # CHEST
    '╨б╨┐╨╕╨╜╨░': 'пасс',        # BACK
    '╨Э╨╛╨│╨╕': 'ласс',          # LEGS
    '╨Я╨╗╨╡╨║': 'пасс',          # SHOULDERS
    '╨а╨╕╨║': 'расс',            # ARMS
    '╨Ъ╨╛╤А': 'асс',             # CORE
    
    # Other common words
    '╨┤╨╜╨╡╨╣': 'асс',           # days
    '╨╜╨╡╨┤╨╡╨╗╨╛': 'ссасс',     # deload
}

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    # Apply replacements
    for garbled, correct in REPLACEMENTS.items():
        content = content.replace(garbled, correct)
    
    # Save back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Fixed: {filepath}")

# Files to fix
files = [
    'src/engines/training.engine.ts',
    'src/engines/training-periodization.engine.ts',
    'src/engines/split-selector.engine.ts',
    'src/engines/rir-matrix.engine.ts',
    'src/engines/progression.engine.ts',
    'src/ui/screens/PlanScreen.tsx',
    'src/core/exercise-catalog.ts',
    'src/engines/support.engine.ts',
    'src/engines/risk.engine.ts',
    'src/core/constants.ts',
    'src/core/risk-info.ts',
    'src/core/pharma-database.ts',
    'src/core/nutrition-database.ts',
    'src/core/data-link.ts',
    'src/core/types.ts',
]

for f in files:
    path = f'D:/V9/{f}'
    try:
        fix_file(path)
    except Exception as e:
        print(f"Error: {path} - {e}")

print("\nDone!")
