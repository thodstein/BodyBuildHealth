#!/usr/bin/env python3
"""
Удаление BOM из всех TypeScript/TSX файлов.
BOM может вызывать проблемы в браузере.
"""

import os
import codecs

def remove_bom(filepath):
    """Удаляет BOM из файла"""
    try:
        with open(filepath, 'rb') as f:
            raw = f.read()
        
        # Проверяем и удаляем BOM
        if raw.startswith(codecs.BOM_UTF8):
            raw = raw[3:]
            with open(filepath, 'wb') as f:
                f.write(raw)
            print(f"  Убран BOM: {filepath}")
            return True
        else:
            print(f"  BOM не найден: {filepath}")
            return False
    except Exception as e:
        print(f"  Ошибка: {e}")
        return False

def main():
    # Находим все .ts и .tsx файлы
    count = 0
    for root, dirs, files in os.walk('src'):
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                filepath = os.path.join(root, file)
                if remove_bom(filepath):
                    count += 1
    
    print(f"\nИтого: {count} файлов очищено от BOM")

if __name__ == '__main__':
    main()
