import os, re

# Emoji mapping for each system
SYSTEM_EMOJIS = {
    'cardio': '\u2764\ufe0f',       # ❤️ Heart
    'hepatic': '\ud83e\ude78',        # 🩸 Liver (or use 🟡)
    'renal': '\ud83e\ude78',           # 🩸 Kidney (or use 💧)
    'neuro': '\ud83e\ude78',           # 🧠 Brain
    'endocrine': '\u2696\ufe0f',       # ⚖️ Balance
    'hematologic': '\ud83e\ude78',     # 🩸 Blood
    'reproductive': '\ud83d\udcaa',     # 💪 Reproductive
    'musculoskeletal': '\ud83e\ude78', # 🦴 Musculoskeletal
    'metabolic': '\u2696\ufe0f',       # ⚖️ Metabolism
    'ghigf': '\ud83d\udcaa',           # 💪 GH/IGF
    'ins_axis': '\ud83d\udcaa',        # 💪 Insulin
    'neuro_toxicity': '\ud83e\ude78',  # 🧠 Neuro toxicity
    'blood': '\ud83e\ude78',           # 🩸 Blood
    'vessels': '\ud83e\ude78',         # 🩸 Vessels
    'immunity': '\ud83d\udee1\ufe0f',  # 🛡️ Immunity
    'thyroid': '\ud83e\ude78',         # 🦋 Thyroid
    'prostate': '\ud83e\ude78',       # 🔴 Prostate
    'skin': '\ud83e\ude78',           # 🧴 Skin
}

# Map of files and their ?? patterns to fix
# We need to find all lines with ?? patterns and fix them

files_to_fix = [
    'src/core/risk-info.ts',
    'src/ui/screens/RiskScreen.tsx', 
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

base_dir = 'D:/BodyBuildHealth'

for rel_path in files_to_fix:
    full_path = os.path.join(base_dir, rel_path)
    if not os.path.exists(full_path):
        continue
    
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Fix common ?? patterns with proper emojis
    # Risk system labels
    replacements = {
        "?? Сердечно-сосудистая": "\u2764\ufe0f Сердечно-сосудистая",
        "?? Печень": "\ud83e\ude78 Печень",
        "?? Почки": "\ud83d\udca7 Почки",
        "?? Нервная система": "\ud83e\udde0 Нервная система",
        "?? Нервная": "\ud83e\udde0 Нервная",
        "?? Эндокринная система": "\u2696\ufe0f Эндокринная система",
        "?? Эндокринная": "\u2696\ufe0f Эндокринная",
        "?? Кроветворная": "\ud83e\ude78 Кроветворная",
        "?? Кровь": "\ud83e\ude78 Кровь",
        "?? Репродуктивная": "\ud83d\udcaa Репродуктивная",
        "?? Репрод.": "\ud83d\udcaa Репрод.",
        "?? ОДА": "\ud83e\ude78 ОДА",
        "?? ОДА/Мышцы": "\ud83e\ude78 ОДА/Мышцы",
        "? Метаб.": "\u2696\ufe0f Метаб.",
        "?? Метаболизм": "\u2696\ufe0f Метаболизм",
        "?? GH/IGF": "\ud83d\udcaa GH/IGF",
        "?? Инсулин": "\ud83d\udcaa Инсулин",
        "?? Нейротоксичность": "\u26a0\ufe0f Нейротоксичность",
        "?? Нейротокс.": "\u26a0\ufe0f Нейротокс.",
        "?? Сосуды": "\ud83e\ude78 Сосуды",
        "?? Сердце": "\u2764\ufe0f Сердце",
        "?? Обзор": "\ud83d\udcca Обзор",
        "?? Динамика": "\ud83d\udcc8 Динамика",
        "?? Матрица": "\ud83d\udd39 Матрица",
        "?? Детали": "\ud83d\udccb Детали",
        "?? Инфо": "\u2139\ufe0f Инфо",
        "?? Рекомендации": "\u2705 Рекомендации",
        "?? Формулы расчёта рисков": "\ud83d\udcdd Формулы расчёта рисков",
        "?? Базовая формула риска": "\ud83d\udcca Базовая формула риска",
        "?? Дозо-зависимый расчёт": "\ud83d\udcc8 Дозо-зависимый расчёт",
        "??? Множители корректировки": "\u2699\ufe0f Множители корректировки",
        "?? Фармакодинамика (PD)": "\ud83d\udcc8 Фармакодинамика (PD)",
        "?? Внимание": "\u26a0\ufe0f Внимание",
        "?? V7 Risk Engine": "\ud83d\udd39 V7 Risk Engine",
        "?? Симуляция": "\ud83d\udd2c Симуляция",
        # Icon replacements for risk-info.ts
        "icon: '??'": "icon: '\u2764\ufe0f'",
    }
    
    for old, new in replacements.items():
        content = content.replace(old, new)
    
    if content != original:
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Fixed: {rel_path}')
    else:
        print(f'No changes: {rel_path}')
