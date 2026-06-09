import os

base = 'D:/BodyBuildHealth'
files = [
    'src/ui/screens/RiskScreen_parts/RiskOverview.tsx',
    'src/ui/screens/RiskScreen_parts/RiskInfo.tsx',
    'src/ui/screens/RiskScreen_parts/RiskDetails.tsx',
    'src/ui/screens/RiskScreen_parts/V7RiskDisplay.tsx',
    'src/ui/screens/DashboardScreen.tsx',
    'src/engines/risk-engine-v7-matrix.ts',
    'src/engines/risk-engine-v7.ts',
    'src/engines/risk-engine-v7-core.ts',
    'src/engines/risk-engine-v7-extensions.ts',
    'src/engines/risk-engine-v7-organs.ts',
    'src/engines/risk-engine-v7-simulation.ts',
]

# Define emoji mappings - use actual unicode chars, not surrogate pairs
emoji_map = {
    '\u2764\ufe0f': '\u2764\ufe0f',  # heart - keep
}

for f in files:
    fp = os.path.join(base, f)
    if not os.path.exists(fp):
        continue
    with open(fp, 'rb') as fh:
        raw = fh.read()
    
    # Try to decode as cp1251 (Windows Cyrillic) then re-encode as UTF-8
    try:
        text = raw.decode('utf-8')
        # Check if there are garbled patterns
        if text.count('\ufffd') > 0 or (text.count('??') > 5 and 'null ??' not in text):
            # Try re-encoding from cp1251
            try:
                text_fixed = raw.decode('cp1251')
                # Check if cp1251 version has more readable content
                import re
                cyrillic_fixed = len(re.findall(r'[\u0400-\u04FF]', text_fixed))
                cyrillic_orig = len(re.findall(r'[\u0400-\u04FF]', text))
                if cyrillic_fixed > cyrillic_orig * 1.2:
                    # cp1251 has significantly more Cyrillic - use it
                    with open(fp, 'w', encoding='utf-8') as fhw:
                        fhw.write(text_fixed)
                    print(f'FIXED (cp1251->utf8): {f} ({cyrillic_orig} -> {cyrillic_fixed} cyrillic)')
                else:
                    print(f'NO FIX NEEDED: {f} (utf8 has {cyrillic_orig} cyrillic, cp1251 has {cyrillic_fixed})')
            except:
                print(f'CANNOT DECODE: {f}')
        else:
            print(f'OK: {f}')
    except UnicodeDecodeError:
        # Not valid UTF-8, try cp1251
        try:
            text_fixed = raw.decode('cp1251')
            with open(fp, 'w', encoding='utf-8') as fhw:
                fhw.write(text_fixed)
            print(f'FIXED (was not utf8): {f}')
        except:
            print(f'CANNOT FIX: {f}')
