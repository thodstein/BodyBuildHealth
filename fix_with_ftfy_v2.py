#!/usr/bin/env python3
"""
Исправление искажений кодировки с помощью ftfy.
Файлы содержат UTF-8 байты, но интерпретируются как CP1251.
"""

import os
import codecs
from ftfy import fix_text

def fix_encoding(filepath):
    """Исправляет искажения в файле и добавляет UTF-8 BOM"""
    try:
        with open(filepath, 'rb') as f:
            raw = f.read()
        
        # Убираем BOM если есть
        if raw.startswith(codecs.BOM_UTF8):
            raw = raw[3:]
        
        # Пробуем декодировать как CP1251 (это даст нам искаженный UTF-8 текст)
        try:
            cp1251_text = raw.decode('cp1251')
            
            # Применяем ftfy для исправления
            fixed_text = fix_text(cp1251_text)
            
            # Проверяем, было ли исправление
            if fixed_text != cp1251_text:
                # Записываем с BOM
                with open(filepath, 'wb') as f:
                    f.write(codecs.BOM_UTF8)
                    f.write(fixed_text.encode('utf-8'))
                print(f"  ИСПРАВЛЕНО: {filepath}")
                return True
            else:
                # Проверяем, можно ли прочитать как UTF-8
                try:
                    utf8_text = raw.decode('utf-8')
                    # Если UTF-8 валиден, просто добавляем BOM
                    with open(filepath, 'wb') as f:
                        f.write(codecs.BOM_UTF8)
                        f.write(utf8_text.encode('utf-8'))
                    print(f"  Добавлен BOM: {filepath}")
                    return True
                except:
                    print(f"  ОШИБКА: Невозможно декодировать {filepath}")
                    return False
        except UnicodeDecodeError as e:
            print(f"  ОШИБКА чтения {filepath}: {e}")
            return False
            
    except Exception as e:
        print(f"  ОШИБКА {filepath}: {e}")
        return False

def main():
    # Список файлов с искажениями (из предыдущего скрипта)
    files_to_fix = [
        'src/engines/training.engine.ts',
        'src/engines/training-periodization.engine.ts',
        'src/ui/screens/PlanScreen.tsx',
        'src/core/types.ts',
        'src/core/exercise-catalog.ts',
        'src/core/nutrition-database.ts',
        'src/core/ocr-engine.ts',
        'src/core/clinical-databases.ts',
        'src/core/constants.ts',
        'src/core/export.ts',
        'src/core/glossary.ts',
        'src/core/orchestrator.ts',
        'src/core/pharma-database.ts',
        'src/core/risk-info.ts',
        'src/core/data/axes.ts',
        'src/core/data/categories.ts',
        'src/core/data/interactions.ts',
        'src/core/data/bands.ts',
        'src/core/data/brands.ts',
        'src/data/axes.ts',
        'src/data/categories.ts',
        'src/data/interactions.ts',
        'src/data/pharma-details.ts',
        'src/data/recommendations.ts',
        'src/engines/assistant.engine.ts',
        'src/engines/clinical-indices.engine.ts',
        'src/engines/gamification.full.ts',
        'src/engines/health-score.engine.ts',
        'src/engines/lab-pharma-correlation.engine.ts',
        'src/engines/labs-schedule.engine.ts',
        'src/engines/nutrition-meal-plan.engine.ts',
        'src/engines/pct-planner.engine.ts',
        'src/engines/pdf-report.engine.ts',
        'src/engines/pharma-interactions.engine.ts',
        'src/engines/support.engine.ts',
        'src/engines/pdf-parser.engine.ts',
        'src/engines/labs-indices.engine.ts',
        'src/ui/settings-module.ts',
        'src/ui/ToastContainer.tsx',
        'src/ui/cards/InteractionCard.tsx',
        'src/ui/cards/OrganCard.tsx',
        'src/ui/cards/RecommendationCard.tsx',
        'src/ui/cards/RiskCard.tsx',
        'src/ui/cards/SubstanceCard.tsx',
        'src/ui/cards/SummaryCard.tsx',
        'src/ui/cards/SystemCard.tsx',
        'src/ui/components/BarcodeScanner.tsx',
        'src/ui/components/HumanBody3D.tsx',
        'src/ui/components/Organ3D.tsx',
        'src/ui/screens/ArticlesScreen.tsx',
        'src/ui/screens/CalculatorsScreen.tsx',
        'src/ui/screens/DashboardScreen.tsx',
        'src/ui/screens/FertilityPCTScreen.tsx',
        'src/ui/screens/GamificationScreen.tsx',
        'src/ui/screens/IntegrationsScreen.tsx',
        'src/ui/screens/LabsScreen.tsx',
        'src/ui/screens/MarketplaceScreen.tsx',
        'src/ui/screens/NutritionScreen.tsx',
        'src/ui/screens/PeptidesScreen.tsx',
        'src/ui/screens/PharmaCourseScreen.tsx',
        'src/ui/screens/PharmaScreen.tsx',
        'src/ui/screens/PlanScreen.tsx',
        'src/ui/screens/PredictiveAnalyticsScreen.tsx',
        'src/ui/screens/ProfileScreen.tsx',
        'src/ui/screens/ReportsScreen.tsx',
        'src/ui/screens/RiskScreen.tsx',
        'src/ui/screens/RoleManagementScreen.tsx',
        'src/ui/screens/SmartAssistantScreen.tsx',
        'src/ui/screens/SubstancesScreen.tsx',
        'src/ui/screens/SupportScreen.tsx',
        'src/workers/heavy-calc.worker.ts',
        'src/workers/pharma-pkpd.worker.ts',
        'src/workers/pkpd-async.worker.ts',
        'src/workers/pkpd.worker.ts',
    ]
    
    converted_count = 0
    
    for filepath in files_to_fix:
        if os.path.exists(filepath):
            print(f"Обработка: {filepath}")
            if fix_encoding(filepath):
                converted_count += 1
        else:
            print(f"  Файл не найден: {filepath}")
    
    print(f"\nИтого: {converted_count} файлов исправлено")

if __name__ == '__main__':
    main()
