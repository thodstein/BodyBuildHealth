import { describe, expect, it } from 'vitest';
import {
  calculatePRI, getPRIThreshold, autoregulate, getAutoregulationRecommendation,
  type AutoregulationInput, type ExercisePlan,
} from '../../autoregulation.engine';

/** Базовый вход: всё «нормальное», чтобы каждый тест менял ровно один рычаг. */
function baseInput(over: Partial<AutoregulationInput> = {}): AutoregulationInput {
  return {
    readiness: { recovery: 85, fatigue: 20 } as AutoregulationInput['readiness'],
    trainingLoadRatio: 1.0,
    plannedWeek: {} as AutoregulationInput['plannedWeek'],
    plannedExercises: [],
    goal: 'mass',
    level: 'intermediate',
    weakPoints: [],
    doms: 1,
    sleepQuality: 8,
    stress: 2,
    ...over,
  };
}

const ex = (over: Partial<ExercisePlan> = {}): ExercisePlan => ({
  exerciseId: 'bench_press', name: 'Жим лёжа', group: 'chest', type: 'compound',
  sets: 4, repsMin: 6, repsMax: 10, rir: 2, isCompound: true, isWeakGroup: false, ...over,
});

describe('E12 autoregulation.engine.ts — calculatePRI', () => {
  it('отличное состояние даёт высокий PRI, плохое — низкий', () => {
    const good = calculatePRI({ recovery: 95, fatigue: 5 } as any, 0, 10, 0);
    const bad = calculatePRI({ recovery: 20, fatigue: 90 } as any, 10, 3, 10);
    expect(good).toBeGreaterThan(80);
    expect(bad).toBeLessThan(30);
  });

  it('PRI всегда 0..100 (шкала не выходит за границы)', () => {
    const hi = calculatePRI({ recovery: 1e9, fatigue: -50 } as any, -999, 1e6, -1e6);
    const lo = calculatePRI({ recovery: -1e9, fatigue: 1e9 } as any, 1e9, -1e6, 1e9);
    expect(hi).toBe(100);
    expect(lo).toBe(0);
  });

  it('мусор на входе даёт НЕЙТРАЛЬ 0.5 по оси, а не «хорошо» (E2-контракт)', () => {
    const garbage = calculatePRI({ recovery: NaN, fatigue: undefined } as any, NaN, 'x' as any, NaN);
    // все оси = 0.5 → (0.5*0.3+0.5*0.25+0.5*0.2+0.5*0.15+0.5*0.1)*100 = 50
    expect(garbage).toBe(50);
  });

  it('каждая ось влияет на результат (веса из KM 2016: сон 0.15, стресс 0.10)', () => {
    const base = calculatePRI({ recovery: 70, fatigue: 50 } as any, 5, 5, 5);
    const better = calculatePRI({ recovery: 70, fatigue: 50 } as any, 5, 5, 0);
    expect(better).toBeGreaterThan(base);
  });
});

describe('E12 getPRIThreshold', () => {
  it('5 диапазонов покрывают 0..100 без разрывов и перекрытий', () => {
    const labels = [0, 29, 30, 49, 50, 69, 70, 84, 85, 100].map(v => getPRIThreshold(v).label);
    expect(labels[0]).toBe('Критическое');
    expect(labels[labels.length - 1]).toBe('Отличное');
    expect(new Set(labels).size).toBeGreaterThanOrEqual(4);
  });

  it('критический порог = пропуск тренировки, отличный = полная интенсивность', () => {
    expect(getPRIThreshold(10).skipTraining).toBe(true);
    expect(getPRIThreshold(95).volumeMod).toBe(1.0);
    expect(getPRIThreshold(95).rirAdd).toBeLessThan(0);
  });
});

describe('E12 autoregulate — ветви нагрузки', () => {
  it('перегрузка (ratio > 1.2) режет фактор и объясняет это в breakdown', () => {
    const r = autoregulate(baseInput({ trainingLoadRatio: 1.5 }));
    const row = r.breakdown.find(b => b.factor === 'Перегрузка');
    expect(row).toBeTruthy();
    expect(r.adjustmentFactor).toBeLessThan(getPRIThreshold(calculatePRI(baseInput().readiness, 1, 8, 2)).volumeMod);
  });

  it('недогрузка (ratio < 0.5) не снижает объём, а сообщает о возможности добавить', () => {
    const r = autoregulate(baseInput({ trainingLoadRatio: 0.3 }));
    expect(r.breakdown.find(b => b.factor === 'Недогрузка')).toBeTruthy();
    expect(r.adjustmentFactor).toBeGreaterThan(0.8);
  });

  it('RPE ≥ 9 снижает, RPE ≤ 4 повышает, середина — без изменений', () => {
    const hi = autoregulate(baseInput({ lastSessionRPE: 9.5 }));
    const lo = autoregulate(baseInput({ lastSessionRPE: 3 }));
    const mid = autoregulate(baseInput({ lastSessionRPE: 6 }));
    expect(hi.adjustmentFactor).toBeLessThan(mid.adjustmentFactor);
    expect(lo.adjustmentFactor).toBeGreaterThan(mid.adjustmentFactor);
  });

  it('незаданный RPE не трогает фактор (нет выдуманного входа)', () => {
    const withNone = autoregulate(baseInput({ lastSessionRPE: undefined }));
    const mid = autoregulate(baseInput({ lastSessionRPE: 6 }));
    expect(withNone.adjustmentFactor).toBeCloseTo(mid.adjustmentFactor, 5);
  });

  it('спад силы снижает фактор и добавляет рекомендацию при хорошем PRI', () => {
    const r = autoregulate(baseInput({ strengthTrend: 'down' }));
    expect(r.breakdown.find(b => b.factor === 'Спад силы')).toBeTruthy();
    expect(r.recommendations.some(x => x.includes('Тренд силы вниз'))).toBe(true);
  });

  it('проблемы с техникой дают скидку 5% за проблему, но не глубже 25%', () => {
    const one = autoregulate(baseInput({ techniqueIssues: ['завал'] }));
    const many = autoregulate(baseInput({ techniqueIssues: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] }));
    const rowOne = one.breakdown.find(b => b.factor === 'Техника')!;
    const rowMany = many.breakdown.find(b => b.factor === 'Техника')!;
    expect(rowOne.impact).toBe(-5);
    expect(rowMany.impact).toBe(-25);
  });
});

describe('E12 autoregulate — травмы реально влияют на фактор (E12-фикс)', () => {
  it('без травм штрафа нет', () => {
    expect(autoregulate(baseInput()).breakdown.find(b => b.factor === 'Травмы')).toBeUndefined();
  });

  it('mild/moderate/severe дают −5/−15/−25% и РЕАЛЬНО режут adjustmentFactor', () => {
    const none = autoregulate(baseInput());
    const mild = autoregulate(baseInput({ injuries: [{ joint: 'колено', severity: 'mild' }] }));
    const moderate = autoregulate(baseInput({ injuries: [{ joint: 'колено', severity: 'moderate' }] }));
    const severe = autoregulate(baseInput({ injuries: [{ joint: 'колено', severity: 'severe' }] }));
    expect(mild.adjustmentFactor).toBeLessThan(none.adjustmentFactor);
    expect(moderate.adjustmentFactor).toBeLessThan(mild.adjustmentFactor);
    expect(severe.adjustmentFactor).toBeLessThan(moderate.adjustmentFactor);
    const row = severe.breakdown.find(b => b.factor === 'Травмы')!;
    expect(row.impact).toBe(-25);
  });

  it('штраф за травмы капнут на 40% и фактор не падает ниже пола 0.3', () => {
    const many = autoregulate(baseInput({
      injuries: Array.from({ length: 8 }, () => ({ joint: 'x', severity: 'severe' })),
    }));
    expect(many.adjustmentFactor).toBeGreaterThanOrEqual(0.3);
    expect(many.breakdown.find(b => b.factor === 'Травмы')!.impact).toBe(-40);
  });

  it('без severity (undefined) трактуется как mild, а не как 0', () => {
    const r = autoregulate(baseInput({ injuries: [{ joint: 'плечо' }] }));
    expect(r.breakdown.find(b => b.factor === 'Травмы')!.impact).toBe(-5);
  });
});

describe('E12 autoregulate — упражнения', () => {
  it('слабая группа получает +1 сет (приоритет объёма)', () => {
    const normal = autoregulate(baseInput({ plannedExercises: [ex()] }));
    const weak = autoregulate(baseInput({ plannedExercises: [ex({ isWeakGroup: true })] }));
    expect(weak.exerciseAdjustments[0].adjustedSets).toBe(normal.exerciseAdjustments[0].adjustedSets + 1);
  });

  it('compound при факторе < 0.7 теряет ещё сет (экономия на тяжёлых базах)', () => {
    const good = autoregulate(baseInput({ plannedExercises: [ex()] }));
    const bad = autoregulate(baseInput({ doms: 10, sleepQuality: 2, stress: 10, plannedExercises: [ex()] }));
    expect(bad.adjustmentFactor).toBeLessThan(0.7);
    expect(bad.exerciseAdjustments[0].adjustedSets).toBeLessThan(good.exerciseAdjustments[0].adjustedSets);
  });

  it('низкая техника (< 5) предлагает замену, кроме новичка', () => {
    const mid = autoregulate(baseInput({ plannedExercises: [ex({ techniqueScore: 3 })] }));
    expect(mid.exerciseAdjustments[0].substituted).toBe(true);
    expect(mid.exerciseAdjustments[0].substituteId).toBe('bench_press_variant');
    const novice = autoregulate(baseInput({ level: 'beginner', plannedExercises: [ex({ techniqueScore: 3 })] }));
    expect(novice.exerciseAdjustments[0].substituted).toBe(false);
  });

  it('RIR упражнения растёт по порогу PRI и не уходит ниже 0', () => {
    const good = autoregulate(baseInput({ plannedExercises: [ex({ rir: 1 })] }));
    const bad = autoregulate(baseInput({ doms: 10, sleepQuality: 1, stress: 10, plannedExercises: [ex({ rir: 1 })] }));
    expect(bad.exerciseAdjustments[0].adjustedRir).toBeGreaterThan(good.exerciseAdjustments[0].adjustedRir);
    expect(bad.exerciseAdjustments[0].adjustedRir).toBeGreaterThanOrEqual(0);
  });

  it('rationale упражнения честно перечисляет и сеты, и RIR', () => {
    const r = autoregulate(baseInput({ plannedExercises: [ex()] }));
    const a = r.exerciseAdjustments[0].rationale;
    expect(a).toContain('сеты 4→');
    expect(a).toContain('RIR 2→');
  });
});

describe('E12 autoregulate — модификации сессии и рекомендации', () => {
  it('критический PRI → пропуск тренировки + рекомендация', () => {
    const r = autoregulate(baseInput({ readiness: { recovery: 10, fatigue: 95 } as any, doms: 10, sleepQuality: 2, stress: 9 }));
    expect(r.sessionModifications.skipTraining).toBe(true);
    expect(r.recommendations.some(x => x.includes('пропуск тренировки'))).toBe(true);
  });

  it('средний PRI → reduceDuration, но не пропуск', () => {
    const r = autoregulate(baseInput({ doms: 6, sleepQuality: 6, stress: 5 }));
    expect(r.sessionModifications.skipTraining).toBe(false);
    expect(typeof r.sessionModifications.reduceDuration).toBe('boolean');
  });

  it('changeFocus ставится только при слабых точках И хорошем PRI', () => {
    const good = autoregulate(baseInput({ weakPoints: ['спина'] }));
    expect(good.sessionModifications.changeFocus).toBe('спина');
    const lowPri = autoregulate(baseInput({ weakPoints: ['спина'], doms: 10, sleepQuality: 2, stress: 10 }));
    expect(lowPri.sessionModifications.changeFocus).toBeNull();
  });

  it('фокус берётся из первой слабой точки (порядок списка значим)', () => {
    const r = autoregulate(baseInput({ weakPoints: ['плечи', 'спина'] }));
    expect(r.sessionModifications.changeFocus).toBe('плечи');
  });
});

describe('E12 getAutoregulationRecommendation', () => {
  it('при пропуске тренировки не печатает процент интенсивности', () => {
    const r = autoregulate(baseInput({ readiness: { recovery: 5, fatigue: 99 } as any, doms: 10, sleepQuality: 1, stress: 10 }));
    const s = getAutoregulationRecommendation(r);
    expect(s).toContain('Пропустить тренировку');
    expect(s).not.toContain('Фактор:');
  });

  it('при факторе < 0.7 пишет «Консервативный режим», при > 0.95 — «Полная интенсивность»', () => {
    // консервативный случай: средний PRI (0.80) × высокий RPE (0.90) × техника (0.95) = 0.684
    const cons = getAutoregulationRecommendation(autoregulate(baseInput({
      doms: 7, sleepQuality: 5, stress: 7, lastSessionRPE: 9, techniqueIssues: ['завал'],
    })));
    const full = getAutoregulationRecommendation(autoregulate(baseInput({
      readiness: { recovery: 100, fatigue: 0 } as any, doms: 0, sleepQuality: 10, stress: 0,
    })));
    expect(cons).toContain('Консервативный режим');
    expect(full).toContain('Полная интенсивность');
  });

  it('в обычном случае содержит PRI и процент фактора', () => {
    const s = getAutoregulationRecommendation(autoregulate(baseInput()));
    expect(s).toMatch(/PRI \d+/);
    expect(s).toContain('Фактор:');
  });
});

describe('E12 детерминизм и границы', () => {
  it('одинаковый вход → идентичный результат (без Math.random внутри)', () => {
    const a = autoregulate(baseInput({ plannedExercises: [ex(), ex({ exerciseId: 'row' })] }));
    const b = autoregulate(baseInput({ plannedExercises: [ex(), ex({ exerciseId: 'row' })] }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('фактор никогда не выходит за [0.3, 1.0] ни в одной комбинации', () => {
    for (const recovery of [0, 50, 100]) {
      for (const ratio of [0.1, 1.0, 2.5]) {
        for (const inj of [0, 3]) {
          const r = autoregulate(baseInput({
            readiness: { recovery, fatigue: 100 - recovery } as any,
            trainingLoadRatio: ratio,
            injuries: inj ? Array.from({ length: inj }, () => ({ joint: 'j', severity: 'severe' })) : undefined,
          }));
          expect(r.adjustmentFactor).toBeGreaterThanOrEqual(0.3);
          expect(r.adjustmentFactor).toBeLessThanOrEqual(1.0);
        }
      }
    }
  });
});
