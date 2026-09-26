/**
 * cardio-border-style-guard.test.ts — в кардио-UI не осталось микса
 * `border` (шорткат) + `borderColor` (лонгхенд) в одном style-объекте.
 *
 * P3-аудит: 15 мест в 6 компонентах. React на каждом рендере сначала ставит
 * шорткатом `border`, потом лонгхендом `borderColor`, а когда условный вариант
 * меняется (метрика графика, открытый аккордеон, ошибка поля) — пытается
 * УДАЛИТЬ borderColor из DOM, где цвет уже задан шорткатом:
 *   "Warning: Removing a style property during rerender (borderColor)..."
 * Это шум в консоли на каждом ререндере + лишний стиль-чоунс.
 *
 * Лечение: цвет задаётся полным `border: '1px solid <цвет>'` (базовые токены
 * уже ровно `1px solid`, поэтому визуал байт-в-байт).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'src/ui/screens/TrainingScreen_parts';
const FILES = [
  'CardioUI.tsx',
  'CardioFieldTestLog.tsx',
  'CardioParamsStep.tsx',
  'CardioPreviewStep.tsx',
  'CardioTaperStep.tsx',
  'CardioVolumeChart.tsx',
];

/** Код без комментариев: иначе гард ловит слово «borderColor» в моей же
 *  документации к фиксу (и в любой будущей) — проверять надо РЕАЛЬНЫЙ код. */
const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('Кардио-UI: шорткат+лонгхенд рамки устранены', () => {
  it('в перечисленных файлах НЕТ ключа borderColor', () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      if (/\bborderColor\s*:/.test(code(readFileSync(join(DIR, f), 'utf8')))) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it('в файлах кардио не появляются новые borderColor (широкий скан)', () => {
    const hits: string[] = [];
    for (const f of readdirSync(DIR)) {
      if (!/^Cardio.*\.tsx$/.test(f)) continue;
      if (/\bborderColor\s*:/.test(code(readFileSync(join(DIR, f), 'utf8')))) hits.push(f);
    }
    expect(hits).toEqual([]);
  });

  it('базовые токены остались 1px solid (иначе подмена изменит ширину рамки)', () => {
    const ui = code(readFileSync(join(DIR, 'CardioUI.tsx'), 'utf8'));
    const borders = ui.match(/border: [`']1px solid [^`']+[`']/g) ?? [];
    expect(borders.length).toBeGreaterThanOrEqual(4);
    expect(/export const (CARD|BTN|BTN_SMALL|INPUT)[^}]*borderColor/.test(ui)).toBe(false);
  });

  it('цветовые override заданы полным border (регрессия подмены)', () => {
    const vol = readFileSync(join(DIR, 'CardioVolumeChart.tsx'), 'utf8');
    expect(vol).toContain("border: '1px solid rgba(0,230,138,0.50)'");
    expect(vol).toContain("border: '1px solid rgba(139,92,246,0.50)'");
    const acc = readFileSync(join(DIR, 'CardioUI.tsx'), 'utf8');
    expect(acc).toContain('border: `1px solid ${ACCENT_BORDER}`');
  });
});
