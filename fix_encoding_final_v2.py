#!/usr/bin/env python3
"""
Конвертация файлов с исправленной кодировкой.
Файлы в UTF-8, но байты кириллических символов были сохранены неправильно.
Нужно интерпретировать байты как CP1251 и перекодировать в UTF-8.
"""

import os
import codecs

def convert_file(filepath):
    """Конвертирует файл из неправильной кодировки в правильную UTF-8 с BOM"""
    try:
        # Читаем как UTF-8 (попытка 1)
        with open(filepath, 'rb') as f:
            raw = f.read()
        
        # Проверяем, нет ли BOM
        if raw.startswith(codecs.BOM_UTF8):
            raw = raw[3:]  # Убираем BOM
            print(f"  Убран UTF-8 BOM из {filepath}")
        
        # Попытка 1: Читаем как UTF-8
        try:
            text = raw.decode('utf-8')
            # Если в тексте есть только ASCII и кириллица - ок
            # Проверяем, есть ли искажения
            has_corruption = any(ord(c) > 0x7F and c not in 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя' 
                                for c in text)
            if not has_corruption:
                # Файл уже правильный
                print(f"  {filepath}: OK (уже UTF-8)")
                return False
        except UnicodeDecodeError:
            pass
        
        # Попытка 2: Читаем как CP1251 (если это UTF-8 байты, интерпретированные как CP1251)
        # Нужно сделать обратную операцию - найти и исправить искаженные байты
        try:
            # Сначала пробуем прочитать как CP1251
            cp1251_text = raw.decode('cp1251')
            
            # Проверяем, есть ли признаки того, что это искаженный UTF-8
            # Обычно искаженный UTF-8 содержит последовательности вроде "тАФ" (для тире)
            has_mojibake = 'тАФ' in cp1251_text or 'Г©' in cp1251_text or '╨' in cp1251_text
            
            if has_mojibake:
                # Пытаемся интерпретировать как UTF-8 байты, но прочитанные как CP1251
                # Это сложный случай - нужно перекодировать
                print(f"  {filepath}: Найдены признаки искажения, пробуем исправить...")
                
                # Попытка: декодируем как CP1251, затем кодируем обратно как UTF-8, затем декодируем как UTF-8
                try:
                    fixed = cp1251_text.encode('cp1251').decode('utf-8')
                    # Проверяем качество исправления
                    if 'Печень' in fixed or 'Сердечно' in fixed or 'Репродуктивная' in fixed:
                        with open(filepath, 'wb') as f:
                            f.write(codecs.BOM_UTF8)
                            f.write(fixed.encode('utf-8'))
                        print(f"  {filepath}: ИСПРАВЛЕНО!")
                        return True
                except:
                    pass
                
        except UnicodeDecodeError as e:
            print(f"  {filepath}: Ошибка чтения - {e}")
        
        # Попытка 3: Просто читаем как UTF-8 и перезаписываем с BOM
        try:
            text = raw.decode('utf-8')
            with open(filepath, 'wb') as f:
                f.write(codecs.BOM_UTF8)
                f.write(text.encode('utf-8'))
            print(f"  {filepath}: Добавлен UTF-8 BOM")
            return True
        except:
            pass
            
        print(f"  {filepath}: НЕ УДАЛОСЬ ИСПРАВИТЬ")
        return False
        
    except Exception as e:
        print(f"  {filepath}: Ошибка - {e}")
        return False

def main():
    # Файлы, которые нужно обработать
    files_to_fix = [
        'src/engines/training.engine.ts',
        'src/engines/training-periodization.engine.ts',
        'src/ui/screens/PlanScreen.tsx',
        'src/core/types.ts',
        'src/core/exercise-catalog.ts',
        'src/core/nutrition-database.ts',
        'src/core/ocr-engine.ts',
        'src/engines/labs.engine.ts',
        'src/engines/risk.engine.ts',
        'src/engines/risk-calculator-v2.engine.ts',
        'src/engines/support.engine.ts',
        'src/engines/labs-indices.engine.ts',
        'src/engines/pdf-parser.engine.ts',
        'src/data/labs-phase-panels.ts',
    ]
    
    converted_count = 0
    
    for filepath in files_to_fix:
        if os.path.exists(filepath):
            print(f"Обработка: {filepath}")
            if convert_file(filepath):
                converted_count += 1
        else:
            print(f"  Файл не найден: {filepath}")
    
    print(f"\nИтого: {converted_count} файлов исправлено")
    
    # Также обрабатываем все .ts и .tsx файлы в src/
    print("\nОбработка всех .ts и .tsx файлов:")
    for root, dirs, files in os.walk('src'):
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                filepath = os.path.join(root, file)
                if filepath not in files_to_fix:  # Уже обработанные
                    print(f"  Проверка: {filepath}")
                    convert_file(filepath)

if __name__ == '__main__':
    main()
