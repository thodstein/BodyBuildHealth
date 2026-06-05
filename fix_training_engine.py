#!/usr/bin/env python3
"""
Исправление искажений в training.engine.ts путем восстановления байтов из git history.
"""

import subprocess

# Получаем файл из самого старого коммита
result = subprocess.run(['git', 'show', '66e86d5:src/engines/training.engine.ts'], capture_output=True)
old_content = result.stdout

# Получаем текущий файл
with open('src/engines/training.engine.ts', 'rb') as f:
    current_content = f.read()

# Ищем box drawing символы в текущем файле
# U+2568 (box drawings double down and right) = E2 95 A8
# U+2591 (light shade) = E2 96 91
# U+2550 (box drawings double horizontal) = E2 95 90
# U+256C (box drawings double vertical and horizontal) = E2 95 AC

box_drawings = [
    (b'\xe2\x95\xa8', 'U+2568'),  # box drawings double down and right
    (b'\xe2\x96\x91', 'U+2591'),  # light shade
    (b'\xe2\x95\x90', 'U+2550'),  # box drawings double horizontal
    (b'\xe2\x95\xac', 'U+256C'),  # box drawings double vertical and horizontal
    (b'\xe2\x94\xac', 'U+2514'),  # box drawings up and right
    (b'\xe2\x94\x80', 'U+2500'),  # box drawings light horizontal
]

# Находим все box drawings
box_positions = []
for box_bytes, name in box_drawings:
    pos = 0
    while True:
        pos = current_content.find(box_bytes, pos)
        if pos == -1:
            break
        box_positions.append((pos, box_bytes, name))
        pos += 1

print('Найдено', len(box_positions), 'box drawing символов')
for pos, box_bytes, name in sorted(box_positions)[:20]:
    print(f'  {pos}: {box_bytes.hex()} ({name})')

# Попытка восстановить байты из старой версии
# Для каждого box drawing ищем позицию в старом файле
fixed_content = bytearray(current_content)

for pos, box_bytes, name in sorted(box_positions):
    # Ищем соответствующую позицию в старом файле
    # Было бы проще, если бы размеры совпадали, но они отличаются
    # Поэтому используем эвристику: ищем D0 xx последовательности вокруг этой позиции
    print(f'Ищем замену для box drawing на позиции {pos}')
    
    # Ищем в старом файле D0 xx последовательности вокруг соответствующей позиции
    # Предполагаем, что в старом файле была кириллица
    old_pos = pos - 10  # Попробуем с небольшим смещением
    if old_pos >= 0:
        # Ищем D0 xx в старом файле
        for i in range(old_pos, min(old_pos + 20, len(old_content) - 1)):
            if old_content[i] == 0xD0 and i + 1 < len(old_content):
                print(f'  Найден D0xx в старом файле на позиции {i}: {old_content[i:i+2].hex()}')
                # Заменяем box drawing на эти байты
                fixed_content[pos:pos+3] = old_content[i:i+2]  # 2 байта вместо 3
                break

# Сохраняем исправленный файл
with open('src/engines/training.engine.ts', 'wb') as f:
    f.write(fixed_content)

print('Файл сохранен')
