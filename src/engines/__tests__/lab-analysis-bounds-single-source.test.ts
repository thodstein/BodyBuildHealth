/**
 * lab-analysis-bounds-single-source.test.ts — проход 171: границы разбора
 * анализов берутся у тех же констант, что и остальные поверхности.
 *
 * Было: `REFERENCE_RANGES` держал литералы, скопированные из `LFT_ULN`,
 * `GGT_ULN`, `CREATININE_ULN`, `HGB_THRESHOLDS`. Копии старели отдельно:
 * гематокрит называл «высоким» 50, хотя эритроцитоз по `HCT_THRESHOLDS`
 * начинается с 51 и та же цифра стоит в тирах, проверочных маркерах и гейтах;
 * низ HCT 39 не совпадал ни с лабораторной нормой (36), ни с женским рядом.
 *
 * Стало: высокое/критическое/низкое для АЛТ, АСТ, ГГТ, креатинина, гемоглобина и
 * гематокрита читается из `lab-norms.engine`; своих чисел у разбора нет. Проба
 * идёт поведением: ровно на границе константы вывода нет, на шаг выше — есть.
 */
import { describe, it, expect } from 'vitest';
import { interpretLabs } from '../lab-analysis.engine';
import {
  LFT_ULN, LFT_STAGE_ULN, GGT_ULN, GGT_STAGE_ULN,
  CREATININE_ULN, HGB_THRESHOLDS, HCT_THRESHOLDS, getLabNorm,
} from '../lab-norms.engine';

const point = (code: string, value: number) => ({
  id: `${code}-${value}`,
  code,
  name: code,
  value,
  unit: '',
  phase: 'baseline',
  date: '2026-11-01',
}) as any;

const status = (code: string, value: number, sex?: 'male' | 'female', out = code) =>
  interpretLabs([point(code, value)], sex).interpretations.find((i) => i.code === out)?.status;

describe('проход 171: печёночные границы — из LFT_ULN/GGT_ULN', () => {
  it('АЛТ: ВГН — норма, ВГН+1 — высокое, 2×ВГН+1 — критическое', () => {
    expect(status('ALT', LFT_ULN.ALT.male)).toBeUndefined();
    expect(status('ALT', LFT_ULN.ALT.male + 1)).toBe('high');
    expect(status('ALT', LFT_STAGE_ULN.reduce.male + 1)).toBe('critical_high');
  });

  it('АСТ: границы те же, что у АЛТ, а не свои', () => {
    expect(status('AST', LFT_ULN.AST.male)).toBeUndefined();
    expect(status('AST', LFT_ULN.AST.male + 1)).toBe('high');
    expect(status('AST', LFT_STAGE_ULN.reduce.male + 1)).toBe('critical_high');
  });

  it('ГГТ: ВГН и 2×ВГН из GGT_ULN/GGT_STAGE_ULN', () => {
    expect(status('GGT', GGT_ULN.male)).toBeUndefined();
    expect(status('GGT', GGT_ULN.male + 1)).toBe('high');
    expect(status('GGT', GGT_STAGE_ULN.double.male + 1)).toBe('critical_high');
  });

  it('женщина: её ВГН, а не мужской (31 против 40)', () => {
    expect(status('ALT', LFT_ULN.ALT.female, 'female')).toBeUndefined();
    expect(status('ALT', LFT_ULN.ALT.female + 1, 'female')).toBe('high');
  });
});

describe('проход 171: почечная граница — из CREATININE_ULN', () => {
  it('креатинин: ВГН — норма, ВГН+1 — высокое', () => {
    expect(status('CREATININE', CREATININE_ULN.male)).toBeUndefined();
    expect(status('CREATININE', CREATININE_ULN.male + 1)).toBe('high');
  });

  it('женщина: её ВГН (97), а не мужской (110)', () => {
    expect(status('CREATININE', CREATININE_ULN.female, 'female')).toBeUndefined();
    expect(status('CREATININE', CREATININE_ULN.female + 1, 'female')).toBe('high');
  });
});

describe('проход 171: кровяные границы — из HGB/HCT_THRESHOLDS', () => {
  it('гемоглобин: верх — HGB_THRESHOLDS, блок — критическое', () => {
    expect(status('HEMOGLOBIN', HGB_THRESHOLDS.male.upper)).toBeUndefined();
    expect(status('HEMOGLOBIN', HGB_THRESHOLDS.male.upper + 1)).toBe('high');
    expect(status('HEMOGLOBIN', HGB_THRESHOLDS.male.block + 1)).toBe('critical_high');
  });

  it('гемоглобин: низ — лабораторная норма резолвера, а не литерал', () => {
    const low = getLabNorm('HGB')!.lln;
    expect(status('HEMOGLOBIN', low)).toBeUndefined();
    expect(status('HEMOGLOBIN', low - 1)).toBe('low');
  });

  it('гематокрит: высокое начинается с порога эритроцитоза 51, а не с 50', () => {
    const high = HCT_THRESHOLDS.male.erythrocytosis;
    expect(high).toBeGreaterThan(50);
    expect(status('HEMATOCRIT', high)).toBeUndefined();
    expect(status('HEMATOCRIT', high + 1)).toBe('high');
    // Регресс: прежняя копия 50 — ниже порога действия, вывода быть не должно.
    expect(status('HEMATOCRIT', 50)).toBeUndefined();
  });

  it('гематокрит: блок — критическое, низ — лабораторная норма 36', () => {
    expect(status('HEMATOCRIT', HCT_THRESHOLDS.male.block + 1)).toBe('critical_high');
    const low = getLabNorm('HCT')!.lln;
    expect(status('HEMATOCRIT', low)).toBeUndefined();
    expect(status('HEMATOCRIT', low - 1)).toBe('low');
  });

  it('женщина: её ряды гемоглобина и гематокрита', () => {
    expect(status('HEMOGLOBIN', HGB_THRESHOLDS.female.upper, 'female')).toBeUndefined();
    expect(status('HEMOGLOBIN', HGB_THRESHOLDS.female.upper + 1, 'female')).toBe('high');
    expect(status('HEMATOCRIT', HCT_THRESHOLDS.female.erythrocytosis, 'female')).toBeUndefined();
    expect(status('HEMATOCRIT', HCT_THRESHOLDS.female.erythrocytosis + 1, 'female')).toBe('high');
  });
});
