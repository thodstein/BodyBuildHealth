/**
 * risk-calculator-units.test.ts — проход 93: единица бланка главнее коэффициента.
 *
 * Было: `calculateRiskFromAnalyses` и оба списка отклонений умножали значение на
 * `UCUM_MAP.coeff` слепо. У гемоглобина `coeff` описан как «значение в г/дл» (×10),
 * поэтому нормальные 150 г/л превращались в 1500 и давали 782% отклонения — риск
 * крови упирался в 100 при норме в бланке. То же на экране «Риск».
 *
 * Стало: если единица бланка известна, значение и диапазон бланка приводятся к
 * единице приложения одним множителем (`normalizeLabMeasurement`): г/л, г/дл,
 * мг/дл, мккат/л, пмоль/л. Единицы нет — прежний `coeff` (старые записи байт-в-байт).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateRiskFromAnalyses } from '../risk-calculator-v2.engine';
import type { LabPoint } from '../../core/types';

const lab = (code: string, value: number, unit = ''): LabPoint => ({
  id: `${code}-1`, code, name: code, value, unit, date: '2026-11-14',
} as LabPoint);

const contrib = (code: string, value: number, unit = '') =>
  (calculateRiskFromAnalyses([lab(code, value, unit)], 'male') as any).systemContributions as Record<string, number>;

describe('проход 93: единица бланка в рисках по анализам', () => {
  it('HGB 150 г/л — норма (было 1500 и 782% отклонения)', () => {
    expect(contrib('HGB', 150, 'г/л').hematologic).toBe(0);
  });

  it('HGB 15 г/дл — те же 150 г/л, тоже норма', () => {
    expect(contrib('HGB', 15, 'г/дл').hematologic).toBe(0);
  });

  it('HGB 180 г/л — выше нормы 170, отклонение есть', () => {
    expect(contrib('HGB', 180, 'г/л').hematologic).toBeGreaterThan(0);
  });

  it('без единицы — прежний путь через coeff (15 = 150 г/л)', () => {
    expect(contrib('HGB', 15).hematologic).toBe(0);
    expect(contrib('HGB', 150).hematologic).toBe(100);
  });

  it('ЛПНП 135 мг/дл и 3.5 ммоль/л дают близкий вклад', () => {
    const mgdl = contrib('LDL', 135, 'мг/дл').cardio;
    const mmol = contrib('LDL', 3.5, 'ммоль/л').cardio;
    expect(mgdl).toBeGreaterThan(0);
    expect(mmol).toBeGreaterThan(0);
    expect(Math.abs(mgdl - mmol)).toBeLessThan(1);
  });

  it('креатинин 1.2 мг/дл = 106 мкмоль/л — выше мужских 110? нет, ниже', () => {
    expect(contrib('CREATININE', 1.2, 'мг/дл').renal).toBe(0);
    expect(contrib('CREATININE', 1.5, 'мг/дл').renal).toBeGreaterThan(0);
  });

  it('источник: движок и оба списка отклонений считают множитель от единицы', () => {
    const engine = readFileSync(resolve(process.cwd(), 'src/engines/risk-calculator-v2.engine.ts'), 'utf8');
    expect(engine).toContain('normalizeLabMeasurement(code, value, String(unit)).value');

    // Проход 147: список отклонений маркеров переехал в
    // `LabsScreen_parts/lab-marker-risks.ts` — множитель от единицы строится там.
    const labs = readFileSync(resolve(process.cwd(), 'src/ui/screens/LabsScreen_parts/lab-marker-risks.ts'), 'utf8');
    expect(labs).toContain('const factor = normalized && lab.value ? normalized.value / lab.value : coeff;');

    const risk = readFileSync(resolve(process.cwd(), 'src/ui/screens/RiskScreen.tsx'), 'utf8');
    // Проход 152: у экрана «Риск» больше нет своей копии множителя — список
    // отклонений целиком считает общий модуль (тот же, что в «Анализах»).
    expect(risk).toContain('computeMarkerDeviations(labs as any, profileSex)');
    expect(risk).not.toContain('const factor = normalized && lab.value');
  });
});
