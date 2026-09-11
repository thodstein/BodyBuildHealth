import { describe, it, expect } from 'vitest';
import { getNormTable, findCategory, classifyTotal, PL_NORM_TABLES } from '../pl-norms.engine';

describe('pl-norms.engine', () => {
  it('таблицы загружены (фпр классика/экип + wrpf ×2 + дисциплины)', () => {
    expect(PL_NORM_TABLES.length).toBeGreaterThanOrEqual(6);
    expect(getNormTable('fpr_ipf', 'total')).toBeDefined(); // deprecated-алиас → классика
    expect(getNormTable('fpr_classic', 'total')).toBeDefined();
    expect(getNormTable('fpr_equipped', 'total')).toBeDefined();
    expect(getNormTable('wrpf_untested', 'bench')).toBeDefined();
    expect(getNormTable('wrpf_tested', 'total')).toBeDefined();
    // женских WRPF-таблиц нет (выдумка удалена — честно undefined)
    expect(getNormTable('wrpf_untested', 'total', 'female')).toBeUndefined();
  });

  it('findCategory: вес 88 → до 93 (ФПР), 130 → св.120', () => {
    const t = getNormTable('fpr_ipf', 'total')!;
    expect(findCategory(t, 88).label).toBe('до 93 кг');
    expect(findCategory(t, 130).label).toBe('св. 120 кг');
    expect(findCategory(t, 60).label).toBe('до 66 кг');
  });

  // Re-baseline на ЕВСК 2022-2025 (классика М93: МСМК 785 / МС 690 / КМС 540 / I 480 / II 430 / III 385)
  it('classifyTotal ФПР-классика: 93кг/690 → МС; 540 → КМС; 785 → МСМК; 480 → I; 400 → III', () => {
    const t = getNormTable('fpr_classic', 'total')!;
    expect(classifyTotal(t, 93, 690).achievedLabel).toBe('МС');
    expect(classifyTotal(t, 93, 540).achievedLabel).toBe('КМС');
    expect(classifyTotal(t, 93, 785).achievedLabel).toBe('МСМК');
    expect(classifyTotal(t, 93, 480).achievedLabel).toBe('I');
    expect(classifyTotal(t, 93, 400).achievedLabel).toBe('III');
    expect(classifyTotal(t, 93, 400).kgToNext).toBeCloseTo(30, 1); // до II 430
  });

  it('экипировка выше классики (93кг/690 → КМС в экипе, МС в классике)', () => {
    const eq = getNormTable('fpr_equipped', 'total')!;
    expect(classifyTotal(eq, 93, 690).achievedLabel).toBe('КМС'); // экип МС 800
    expect(classifyTotal(eq, 93, 800).achievedLabel).toBe('МС');
  });

  it('classifyTotal WRPF без ДК: 82.5кг/700 → МСМК, до ЭЛИТЫ 85', () => {
    const t = getNormTable('wrpf_untested', 'total')!;
    const r = classifyTotal(t, 82.5, 700);
    expect(r.achievedLabel).toBe('МСМК');
    expect(r.nextLabel).toBe('ЭЛИТА');
    expect(r.kgToNext).toBeCloseTo(85, 1); // 785-700
  });

  it('жим: 100кг/195 → МС (wrpf untested bench)', () => {
    const t = getNormTable('wrpf_untested', 'bench')!;
    expect(classifyTotal(t, 100, 195).achievedLabel).toBe('МС');
  });
});