/**
 * planner-supplements-removable.test.ts — B28 (аудит 2026-10).
 *
 * Находка: список принимаемых БАДов рендерился как `takenSupplements.slice(0,12)`,
 * а остальные прятались за «+N». Чип с крестиком — единственный способ убрать БАД
 * из профиля, поэтому при 13+ записях лишние становились НЕУДАЛЯЕМЫМИ навсегда
 * (удалить можно было только очисткой localStorage).
 *
 * Замок: рендерятся все записи, обрезки списка в этом блоке нет.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(__dirname, '..', 'IndividualPlanSettings.tsx'),
  'utf8',
);

describe('B28: все БАДы видны и удаляемы', () => {
  it('нет обрезки списка БАДов до 12', () => {
    expect(src).not.toMatch(/takenSupplements\.slice\(\s*0\s*,\s*12\s*\)/);
  });

  it('нет скрытого «+N» вместо удаляемых чипов', () => {
    expect(src).not.toMatch(/takenSupplements\.length\s*>\s*12\s*&&\s*<span[^>]*>\+/);
  });

  it('список рендерится целиком через map с крестиком удаления', () => {
    // именно `takenSupplements.map(` + удаление по sid внутри того же блока
    const block = src.slice(src.indexOf('Принимаю БАД'), src.indexOf('showSuppPicker &&', src.indexOf('Принимаю БАД')));
    expect(block).toMatch(/takenSupplements\.map\(/);
    expect(block).toMatch(/takenSupplements\.filter\(x\s*=>\s*x\s*!==\s*sid\)/);
  });

  it('большой список ограничен по высоте, а не по количеству', () => {
    const block = src.slice(src.indexOf('Принимаю БАД'), src.indexOf('showSuppPicker &&', src.indexOf('Принимаю БАД')));
    // ограничение — через прокрутку контейнера (maxHeight), чтобы ничего не терялось
    expect(block).toMatch(/maxHeight/);
    expect(block).toMatch(/overflowY/);
  });
});
