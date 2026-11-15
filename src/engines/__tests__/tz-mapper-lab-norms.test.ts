/**
 * tz-mapper-lab-norms.test.ts — проход 96: пороги серьёзности по анализам знают пол.
 *
 * Было: `buildRecommendation` считал серьёзность по `LAB_NORMALS` — четвёртой копии
 * норм внутри движка. Пол там не учитывался вовсе, а часть чисел расходилась с
 * резолвером: HCT 50 вместо 52, HGB 165 вместо 170, креатинин 105 вместо 110. То
 * есть женщина получала мужской порог рекомендаций по анализам, а мужчина — порог,
 * которого нет ни в одном источнике.
 *
 * Стало: ссылочные границы (`ALT`, `AST`, `GGT`, `HCT`, `HGB`, `CREATININE`,
 * `URIC_ACID` и их длинные написания) берутся из `getLabNorm` через
 * `labSeverityCut`; в таблице остались только функциональные цели приложения
 * (ферритин 100, витамин D 30, ТТГ 2.5, тестостерон 20, СРБ 3), у которых пола и
 * литературы-верхней границы нет.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { labSeverityCut } from '../tz-mapper-engine';

describe('проход 96: порог серьёзности — ВГН пола', () => {
  it('печень: АЛТ/АСТ/ГГТ 40/40/55 у мужчины и 31/31/31 у женщины', () => {
    expect(labSeverityCut('ALT', 'male')).toBe(40);
    expect(labSeverityCut('ALT', 'female')).toBe(31);
    expect(labSeverityCut('AST', 'male')).toBe(40);
    expect(labSeverityCut('AST', 'female')).toBe(31);
    expect(labSeverityCut('GGT', 'male')).toBe(55);
    expect(labSeverityCut('GGT', 'female')).toBe(31);
  });

  it('кровь: HCT 52/48 и HGB 170/150, длинные написания — тот же ряд', () => {
    expect(labSeverityCut('HCT', 'male')).toBe(52);
    expect(labSeverityCut('HCT', 'female')).toBe(48);
    expect(labSeverityCut('HEMATOCRIT', 'female')).toBe(48);
    expect(labSeverityCut('HGB', 'male')).toBe(170);
    expect(labSeverityCut('HGB', 'female')).toBe(150);
    expect(labSeverityCut('HEMOGLOBIN', 'female')).toBe(150);
  });

  it('почки: креатинин 110/97, мочевая кислота 420/350', () => {
    expect(labSeverityCut('CREATININE', 'male')).toBe(110);
    expect(labSeverityCut('CREATININE', 'female')).toBe(97);
    expect(labSeverityCut('URIC_ACID', 'male')).toBe(420);
    expect(labSeverityCut('URIC_ACID', 'female')).toBe(350);
  });

  it('без пола — мужской ряд (прежний путь)', () => {
    expect(labSeverityCut('ALT')).toBe(40);
    expect(labSeverityCut('HCT')).toBe(52);
    expect(labSeverityCut('URIC_ACID')).toBe(420);
  });

  it('функциональные цели не нормы: резолвер о них молчит', () => {
    for (const m of ['FERRITIN', 'VITAMIN_D', 'TSH', 'TESTOSTERONE', 'CRP', 'B12']) {
      expect(labSeverityCut(m, 'female')).toBeNull();
    }
    expect(labSeverityCut('НЕИЗВЕСТНЫЙ', 'male')).toBeNull();
  });

  it('источник: таблицы-копии норм в движке больше нет', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/tz-mapper-engine.ts'), 'utf8');
    expect(src).not.toContain('LAB_NORMALS');
    expect(src).toContain('const LAB_TARGETS: Record<string, { default: number; higherIsWorse: boolean }> = {');
    expect(src).toContain('const refCut = labSeverityCut(label, ctx.sex);');
    // нормы печени/крови/почек в таблице целей не остались
    expect(src).not.toMatch(/^\s+ALT: \{ default: 40/m);
    expect(src).not.toMatch(/^\s+HCT: \{ default: 50/m);
    expect(src).not.toMatch(/^\s+HGB: \{ default: 165/m);
    expect(src).not.toMatch(/^\s+CREATININE: \{ default: 105/m);
  });
});
