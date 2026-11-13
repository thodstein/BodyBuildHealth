/**
 * planner-day-explain.test.ts — волна-3: разбор «почему день не сошёлся» из notes движка.
 * Классификация причин (⚠ «Не сошлось», «Корректор…», <60%), компенсаций (добор/дотяжка/
 * ужатие/фруктовый кап) и проверок (MPS-интервал, натрий, клетчатка) + отклонение от целей.
 * UI карточка не меняет движок — здесь только потребитель его notes.
 */
import { describe, it, expect } from 'vitest';
import { explainDayPlan, dayDeviationPct, dayAxisDeviations } from '../planner-day-explain';
import { buildDayPlan } from '../meal-plan-engine';

const totals = (over: any = {}) => ({ kcal: 3000, p: 180, f: 80, c: 400, fiber: 35, ...over });
const targets = { kcal: 3000, p: 180, f: 80, c: 400 };

describe('dayDeviationPct: максимум по 4 осям (белок — пол, §8.91)', () => {
  it('считает максимум относительного отклонения', () => {
    expect(dayDeviationPct(totals({ kcal: 3300 }), targets)).toBe(10);
    expect(dayDeviationPct(totals({ c: 360 }), targets)).toBe(10);
    expect(dayDeviationPct(totals(), targets)).toBe(0);
  });
  it('§8.91: перебор белка не считается промахом дня, недобор — считается', () => {
    expect(dayDeviationPct(totals({ p: 260 }), targets)).toBe(0);
    expect(dayDeviationPct(totals({ p: 140 }), targets)).toBeCloseTo(22.2, 1);
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
      // Итог дня реально вне канона (иначе дневной вердикт корректора снимается как устаревший).
      totals: totals({ kcal: 3400 }), targets,
      notes: [
        '⚠ Корректор дневных целей: осталось отклонение 12% (>3%) — проверьте пулы/капы',
        '⚠ «Перекус 2»: 36У из цели 120У (<60%) — не сошлось: капы семейств/комната ккал не дали долить, дотяните вручную',
      ],
    } as any, targets);
    expect(ex.causes.map(c => c.id)).toEqual(expect.arrayContaining(['corrector-left', 'meal-carb-short']));
    expect(ex.causes.every(c => c.hint.length > 10)).toBe(true);
  });

  it('сошедшийся ИТОГ снимает устаревшие дневные вердикты, но оставляет приёмо-уровневые', () => {
    const ex = explainDayPlan({
      totals: totals(), targets,
      notes: [
        '⚠ Корректор дневных целей: осталось отклонение 12% (>3%) — проверьте пулы/капы',
        '⚠ Точность рациона: отклонение >5% (Б 58%, Ж 1%, У 0%) — проверьте пулы продуктов',
        '⚠ «Перекус 2»: 36У из цели 120У (<60%) — дотяните',
      ],
    } as any, targets);
    const ids = ex.causes.map(c => c.id);
    expect(ids).not.toContain('corrector-left');
    expect(ids).not.toContain('macro-mismatch');
    expect(ids).toContain('meal-carb-short');
    expect(ex.within).toBe(true);
  });

  it('перегрузка приёма и перекос макроса — причины', () => {
    const ex = explainDayPlan({
      // Перекос реальный (Ж 120 из 80 = +50%): §8.91 белок — пол, поэтому вердикт дня
      // держится на ккал/Ж/У; перекос по жиру остаётся причиной.
      totals: totals({ f: 120 }), targets,
      notes: ['⚠ Перегрузка приёма: каша упирается в лимит', '⚠ Точность рациона: отклонение >5% (Б 0%, Ж 50%, У 0%) — проверьте пулы продуктов'],
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

  it('итоговые числа дня приоритетнее оценки движка (она устаревает после пост-проходов)', () => {
    // Живой дефект: рекомендательный вердикт движка (4.4%) считался до доборов/рецептов,
    // а итог дня сошёлся. Карточка показывала «не сошёлся 4.4%» при равных тоталах.
    const ex = explainDayPlan({ totals: totals(), deviationPct: 4.4, withinTolerance: false } as any, targets);
    expect(ex.devPct).toBe(0);
    expect(ex.within).toBe(true);
  });

  it('без тоталов — fallback на verdict движка', () => {
    const ex = explainDayPlan({ deviationPct: 4.4, withinTolerance: false } as any, targets);
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

describe('explainDayPlan: журнал проходов (шаг 7)', () => {
  it('прокидывает passJournal плана как journal', () => {
    const ex = explainDayPlan({
      totals: totals(), targets, notes: [],
      passJournal: [
        { id: 'build', label: 'Сборка дня', devBefore: 58.4, devAfter: 58.4 },
        { id: 'converge', label: 'Сведение макросов', devBefore: 58.4, devAfter: 40.1 },
        { id: 'reconcile', label: 'Reconciliation', devBefore: 40.1, devAfter: 1 },
      ],
    } as any, targets);
    expect(ex.journal).toHaveLength(3);
    expect(ex.journal[1].id).toBe('converge');
    expect(ex.journal[2].devAfter).toBe(1);
  });

  it('нет passJournal → пустой journal (обратная совместимость)', () => {
    const ex = explainDayPlan({ totals: totals(), targets, notes: [] } as any, targets);
    expect(ex.journal).toEqual([]);
  });

  it('битый passJournal отбрасывается (мусор не роняет карточку)', () => {
    const ex = explainDayPlan({ totals: totals(), targets, notes: [], passJournal: [{ id: 'x' } as any, null as any] } as any, targets);
    expect(ex.journal).toEqual([]);
  });

  it('buildDayPlan: журнал улучшает день в целом, reconcile доводит до ≤3% (обычный день)', () => {
    const p = buildDayPlan({
      weightKg: 70, lbmKg: 57, bodyFatPct: 18, sex: 'male',
      goalKcal: 2000, goalProteinG: 140, goalFatG: 60, goalCarbsG: 225,
      mealsCount: 5, isTrainingDay: true, trainStartMin: 1050, trainDurationMin: 90, allowIntraWorkout: true,
      budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'medium', eveningLowCarb: false,
      randomSalt: 1,
    } as any);
    const j = p.passJournal || [];
    expect(j.length).toBeGreaterThan(1);
    expect(j[0].id).toBe('build');
    expect(j[j.length - 1].id).toBe('final');
    // Итог не хуже старта (сведение дня монотонно по финалу).
    expect(j[j.length - 1].devAfter).toBeLessThanOrEqual(j[0].devBefore);
    // Все значения конечны.
    for (const e of j) { expect(Number.isFinite(e.devBefore)).toBe(true); expect(Number.isFinite(e.devAfter)).toBe(true); }
    // Reconciliation доводит обычный день к канону ≤3%.
    const rec = j.find(e => e.id === 'reconcile');
    expect(rec).toBeTruthy();
    expect(rec!.devAfter).toBeLessThanOrEqual(3.5);
  });
});

// ─── Регресс §8.89: карточка сравнивает ВСЕ оси, а не только ккал ───────────────
describe('§8.89: цели в ключах настроек (protein/fats/carbs) и честный вердикт', () => {
  // Живой день из приложения (рецептурный контур, 70 кг, цель 2524 ккал):
  const liveTotals = { kcal: 2509, p: 140.9, f: 67.1, c: 337, fiber: 56 };
  const liveTargets = { kcal: 2524, protein: 112, fats: 56, carbs: 393 };

  it('dayDeviationPct читает цели в ключах planTargets (protein/fats/carbs)', () => {
    // До §8.89 здесь было 0.6 — сравнивалась ОДНА ось (ккал), потому что p/f/c = undefined.
    // §8.91: белок — пол, поэтому вердикт дня держит главную реальную ось (Ж +19.8%),
    // а не перебор белка (+25.8%): 141 г при цели 112 г — не дефект дня, но виден в чипе.
    expect(dayDeviationPct(liveTotals as any, liveTargets as any)).toBeCloseTo(19.8, 1);
    expect(dayDeviationPct(liveTotals as any, { kcal: 2524, p: 112, f: 56, c: 393 } as any)).toBeCloseTo(19.8, 1);
  });

  it('dayAxisDeviations отдаёт факт/цель/разницу по 4 осям', () => {
    const axes = dayAxisDeviations(liveTotals as any, liveTargets as any);
    expect(axes.map(a => a.key)).toEqual(['kcal', 'p', 'f', 'c']);
    const p = axes.find(a => a.key === 'p')!;
    expect(p.fact).toBe(141);
    expect(p.goal).toBe(112);
    expect(p.diff).toBe(29);
    expect(p.diffPct).toBeCloseTo(25.8, 1);
    const c = axes.find(a => a.key === 'c')!;
    expect(c.diff).toBe(-56);
  });

  it('карточка не объявляет «сошёлся», пока жир/углеводы вне канона', () => {
    const ex = explainDayPlan({ totals: liveTotals as any, notes: [] } as any, liveTargets as any);
    expect(ex.devPct).toBeCloseTo(19.8, 1);
    expect(ex.within).toBe(false);
    expect(ex.headline).toMatch(/выше нормы/);
    expect(ex.headline).toMatch(/Ж 67 из 56/);
    // Причины нет в нотах — синтезируем из реальных чисел дня.
    const nc = ex.causes.find(c => c.id === 'not-converged');
    expect(nc).toBeTruthy();
    expect(nc!.raw).toMatch(/67 из 56/);
  });

  it('§8.91: перебор белка при ккал/Ж/У в каноне — день сошёлся, белок помечен «пол»', () => {
    const ex = explainDayPlan({
      totals: { kcal: 2540, p: 141, f: 55, c: 397 } as any, notes: [],
    } as any, liveTargets as any);
    expect(ex.within).toBe(true);
    expect(ex.devPct).toBeCloseTo(1.8, 1);
    const pAxis = ex.axes.find(a => a.key === 'p')!;
    expect(pAxis.floor).toBe(true);
    expect(pAxis.diff).toBe(29);
    const kAxis = ex.axes.find(a => a.key === 'kcal')!;
    expect(kAxis.floor).toBe(false);
  });

  it('устаревшая нота «Не сошлось 3.7%» заменяется итоговыми числами', () => {
    const ex = explainDayPlan({
      totals: liveTotals as any,
      notes: ['⚠ «Не сошлось»: отклонение дня от целей 3.7% (канон 3%) — пулы/капы не дали закрыть цель'],
    } as any, liveTargets as any);
    const nc = ex.causes.find(c => c.id === 'not-converged')!;
    expect(nc.raw).not.toMatch(/3\.7%/);
    expect(nc.raw).toMatch(/19\.8%/);
  });

  it('сошедшийся итог снимает устаревшую причину «Не сошлось»', () => {
    const ex = explainDayPlan({
      totals: { kcal: 2524, p: 112, f: 56, c: 393 } as any,
      notes: ['⚠ «Не сошлось»: отклонение дня от целей 3.7% (канон 3%) — пулы/капы не дали закрыть цель'],
    } as any, liveTargets as any);
    expect(ex.devPct).toBe(0);
    expect(ex.within).toBe(true);
    expect(ex.causes.some(c => c.id === 'not-converged')).toBe(false);
  });

  it('разбор по осям не ломается на битых/пустых целях', () => {
    expect(dayAxisDeviations(null, liveTargets as any)).toEqual([]);
    expect(dayAxisDeviations(liveTotals as any, null)).toEqual([]);
    expect(dayAxisDeviations(liveTotals as any, { protein: 'abc', fats: -1 } as any)).toEqual([]);
  });
});
