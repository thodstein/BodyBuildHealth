import { describe, it, expect } from 'vitest';
import { getNormTable, findCategory, classifyTotal, PL_NORM_TABLES } from '../pl-norms.engine';

describe('pl-norms.engine', () => {
  it('таблицы загружены (фпр + wrpf ×2 + дисциплины)', () => {
    expect(PL_NORM_TABLES.length).toBeGreaterThanOrEqual(6);
    expect(getNormTable('fpr_ipf', 'total')).toBeDefined();
    expect(getNormTable('wrpf_untested', 'bench')).toBeDefined();
    expect(getNormTable('wrpf_tested', 'total')).toBeDefined();
  });

  it('findCategory: вес 88 → до 93 (ФПР), 130 → св.120', () => {
    const t = getNormTable('fpr_ipf', 'total')!;
    expect(findCategory(t, 88).label).toBe('до 93 кг');
    expect(findCategory(t, 130).label).toBe('св. 120 кг');
    expect(findCategory(t, 60).label).toBe('до 66 кг');
  });

  it('classifyTotal ФПР: 93кг/610 → МС; 505 → КМС; 770 → МСМК; 400 → нет', () => {
    const t = getNormTable('fpr_ipf', 'total')!;
    expect(classifyTotal(t, 93, 610).achievedLabel).toBe('МС');
    expect(classifyTotal(t, 93, 505).achievedLabel).toBe('КМС');
    expect(classifyTotal(t, 93, 770).achievedLabel).toBe('МСМК');
    expect(classifyTotal(t, 93, 400).achievedLabel).toBe('нет разряда');
    expect(classifyTotal(t, 93, 400).kgToNext).toBeCloseTo(105, 1); // до КМС 505
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