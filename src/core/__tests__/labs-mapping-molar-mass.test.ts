/**
 * labs-mapping-molar-mass.test.ts — проход 101: пересчёт свободного тестостерона
 * и витамина D выводится из молярной массы, а не из литералов.
 *
 * Было: в `normalizeLabMeasurement` стояли `1 / 3.467` (FT, pmol/L → pg/mL),
 * `288.4` (FT, nmol/L → pg/mL) и `1 / 2.496` (витамин D, nmol/L → ng/mL). Рядом,
 * в той же функции, лежит таблица `MOLAR_MASS` с точными массами: `FT: 288.42`,
 * `VITD: 400.64`. То есть одно и то же число было записано дважды и в разных
 * округлениях (288.4 против 288.42), а масса витамина D вообще нигде не
 * участвовала — её коэффициент 2.496 был отдельным литералом.
 *
 * Стало: `factor = MOLAR_MASS.FT / 1000` (pmol/L → pg/mL) и
 * `factor = MOLAR_MASS.FT` (nmol/L → pg/mL), `factor = MOLAR_MASS.VITD / 1000`
 * (nmol/L → ng/mL). Правило одно: pmol/L → pg/mL это ×MW/1000, а обратно — ×1000/MW.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeLabMeasurement, convertToUnit } from '../labs-mapping';

describe('проход 101: FT и витамин D — из молярной массы', () => {
  it('витамин D: 2.496 нмоль/л — ровно 1 нг/мл, 10 нмоль/л — 4.006', () => {
    expect(normalizeLabMeasurement('VITD', 2.496, 'nmol/L')).toEqual({ value: 1, unit: 'ng/mL' });
    expect(normalizeLabMeasurement('VITD', 10, 'nmol/L')).toEqual({ value: 4.006, unit: 'ng/mL' });
  });

  it('свободный тестостерон: 3.4672 пмоль/л — ровно 1 пг/мл, 1 нмоль/л — 288.4 (округление общее)', () => {
    expect(normalizeLabMeasurement('FT', 3.4672, 'pmol/L').value).toBeCloseTo(1, 3);
    // `round()` в обоих путях отдаёт ≥100 с одним знаком, поэтому 288.42 → 288.4 —
    // это округление вывода, а не множитель; сверяемся с ним же.
    expect(normalizeLabMeasurement('FT', 1, 'nmol/L')).toEqual({ value: 288.4, unit: 'pg/mL' });
  });

  it('тот же пересчёт в общем пути (`convertToUnit`) не расходится', () => {
    // Общий путь округляет крупные значения до одного знака, поэтому сверяем по близости.
    expect(convertToUnit('FT', 1, 'nmol/L', 'pg/mL')).toBeCloseTo(288.42, 0);
    expect(convertToUnit('VITD', 10, 'nmol/L', 'ng/mL')).toBeCloseTo(4.006, 1);
  });

  it('источник: литералов 3.467 / 288.4 / 2.496 больше нет', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/core/labs-mapping.ts'), 'utf8');
    expect(src).not.toContain('1 / 3.467');
    expect(src).not.toContain('factor = 288.4');
    expect(src).not.toContain('1 / 2.496');
    expect(src).toContain('factor = MOLAR_MASS.FT / 1000');
    expect(src).toContain('factor = MOLAR_MASS.FT;');
    expect(src).toContain('factor = MOLAR_MASS.VITD / 1000');
  });
});
