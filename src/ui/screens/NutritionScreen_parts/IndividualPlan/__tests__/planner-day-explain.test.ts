/**
 * planner-day-explain.test.ts — волна-3: разбор «почему день не сошёлся» из notes движка.
 * Классификация причин (⚠ «Не сошлось», «Корректор…», <60%), компенсаций (добор/дотяжка/
 * ужатие/фруктовый кап) и проверок (MPS-интервал, натрий, клетчатка) + отклонение от целей.
 * UI карточка не меняет движок — здесь только потребитель его notes.
 */
import { describe, it, expect } from 'vitest';
import { explainDayPlan, dayDeviationPct } from '../planner-day-explain';

const totals = (over: any = {}) => ({ kcal: 3000, p: 180, f: 80, c: 400, fiber: 35, ...over });
const targets = { kcal: 3000, p: 180, f: 80, c: 400 };

describe('dayDeviationPct: максимум по 4 осям', () => {
  it('считает максимум относительного отклонения', () => {
    expect(dayDeviationPct(totals({ kcal: 3300 }), targets)).toBe(10);
    expect(dayDeviationPct(totals({ c: 360 }), targets)).toBe(10);
    expect(dayDeviationPct(totals(), targets)).toBe(0);
  });
  it('null без целей/тоталов и при пустых целях', () => {
    expect(dayDeviationPct(null, targets)).toBeNull();
    expect(dayDeviationPct(totals(), null)).toBeNull();
    expect(dayDeviationPct(totals(), {} as any)).toBeNull();
  });
});

describe('explainDayPlan: причины', () => {
  it('«Не сошлось» → причина + бейдж лучшего усилия', () => {
    const ex = explainDayPlan({
      totals: totals({ kcal: 3600 }), targets,
      notes: ['⚠ «Не сошлось»: отклонение дня от целей 20% (>8%) — пулы/капы не закрыли цели, итог честный best-effort, а не подгонка мусором'],
    } as any, targets);
    expect(ex.causes.map(c => c.id)).toContain('not-converged');
    expect(ex.within).toBe(false);
    expect(ex.headline).toMatch(/выше нормы/);
  });

  it('«Корректор…» и «(<60%)» — отдельные причины с подсказками', () => {
    const ex = explainDayPlan({
      totals: totals(), targets,
      notes: [
        '⚠ Корректор дневных целей: осталось отклонение 12% (>3%) — проверьте пулы/капы',
        '⚠ «Перекус 2»: 36У из цели 120У (<60%) — не сошлось: капы семейств/комната ккал не дали долить, дотяните вручную',
      ],
    } as any, targets);
    expect(ex.causes.map(c => c.id)).toEqual(expect.arrayContaining(['corrector-left', 'meal-carb-short']));
    expect(ex.causes.every(c => c.hint.length > 10)).toBe(true);
  });

  it('перегрузка приёма и перекос макроса — причины', () => {
    const ex = explainDayPlan({
      totals: totals(), targets,
      notes: ['⚠ Перегрузка приёма: каша упирается в лимит', '⚠ Точность рациона: отклонение >5% (Б 58%, Ж 1%, У 0%) — проверьте пулы продуктов'],
    } as any, targets);
    expect(ex.causes.map(c => c.id)).toEqual(expect.arrayContaining(['meal-overload', 'macro-mismatch']));
  });
});

describe('explainDayPlan: компенсации и проверки', () => {
  it('финальный добор/дотяжка/экстрим → fixes (не причины)', () => {
    const ex = explainDayPlan({
      totals: totals(), targets,
      notes: ['➕ Финальный добор сходимости: +142 ккал плотными носителями', '🍚 Экстрим-углеводный день: гарниры дотянуты'],
    } as any, targets);
    expect(ex.fixes.length).toBeGreaterThan(0);
    expect(ex.causes.length).toBe(0);
  });

  it('«Болюс-день: … ужат» и «белок ужат до MPS-потолка» специфичнее «порции ужаты»', () => {
    const ex = explainDayPlan({
      totals: totals(), targets,
      notes: ['🍚 Болюс-день: Кукурузные хлопья ужат до 30 г (белок −7.2 г, углеводы те же)', '⚖️ «Обед»: белок ужат до MPS-потолка 45.8 г (0.62 г/кг LBM)'],
    } as any, targets);
    expect(ex.fixes.map(f => f.id)).toEqual(expect.arrayContaining(['bolus-lean', 'mps-ceiling']));
    expect(ex.fixes.map(f => f.id)).not.toContain('portion-trimmed');
  });

  it('MPS gap / низкий натрий / клетчатка → checks', () => {
    const ex = explainDayPlan({
      totals: totals(), targets,
      notes: ['⏰ MPS gap 5.0ч между «Завтрак» и «Обед» — превышено окно 3-4ч', '🧂 Натрий низкий: 1291мг / цель 3450мг', '⚠ Клетчатка: 12г / 35г — добавьте овощи'],
    } as any, targets);
    expect(ex.checks.map(c => c.id)).toEqual(expect.arrayContaining(['mps-gap', 'sodium-low', 'fiber-low']));
  });

  it('fruit cap и восстановление белка перекуса — fixes', () => {
    const ex = explainDayPlan({
      totals: totals(), targets,
      notes: ['🍎 Фруктовый кап (≤4 приёма): фрукт убран из «Перекус 2»', '🍽 «Полдник»: белковый пункт восстановлен (Творог 30 г) — перекус оставался без белка'],
    } as any, targets);
    expect(ex.fixes.map(f => f.id)).toEqual(expect.arrayContaining(['fruit-cap', 'snack-protein']));
  });
});

describe('explainDayPlan: заголовок/капы/пустота', () => {
  it('сошедшийся день: within=true и корректный заголовок, без причин', () => {
    const ex = explainDayPlan({ totals: totals({ c: 405 }), notes: [] } as any, targets);
    expect(ex.within).toBe(true);
    expect(ex.headline).toMatch(/сошёлся/);
    expect(ex.causes).toHaveLength(0);
  });

  it('deviationPct плана приоритетнее расчёта из totals', () => {
    const ex = explainDayPlan({ totals: totals(), deviationPct: 4.4, withinTolerance: false } as any, targets);
    expect(ex.devPct).toBe(4.4);
    expect(ex.within).toBe(false);
  });

  it('пустой план → пустой результат без краха', () => {
    const ex = explainDayPlan(null as any, targets);
    expect(ex.headline).toBeNull();
    expect(ex.causes).toEqual([]);
  });

  it('кап на группу (maxPerGroup) и дедуп одного правила', () => {
    const ex = explainDayPlan({
      totals: totals(), targets,
      notes: [
        '⚠ «Перекус 1»: 30У из цели 120У (<60%) — дотяните',
        '⚠ «Перекус 2»: 31У из цели 120У (<60%) — дотяните',
        '⚠ «Перекус 3»: 32У из цели 120У (<60%) — дотяните',
      ],
    } as any, targets, { maxPerGroup: 2 });
    expect(ex.causes.filter(c => c.id === 'meal-carb-short')).toHaveLength(1);
    expect(ex.causes.length).toBeLessThanOrEqual(2);
  });
});
