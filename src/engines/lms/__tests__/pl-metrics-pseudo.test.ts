/**
 * pl-metrics-pseudo.test.ts — Фаза 4: служебные маркеры источника не портят метрики.
 *
 * «Отдых» (sheiko-32) и «Тест: проходка (до макс)» (candido/juggernaut/…) —
 * разметка, а не упражнения: не входят в КПШ/тоннаж/интенсивность и не считаются
 * в exerciseCount; строки в плане при этом сохраняются.
 */
import { describe, expect, it } from 'vitest';
import {
  calcSessionMetrics, calcCycleMetrics, isPseudoExercise, type SRExercise,
} from '../lms-metrics.engine';

const real: SRExercise = {
  name: 'Присед', group: 'ПР', coef: 1, mnosz: 1, pm: 150,
  sets: [{ weight: 120, reps: 5, sets: 3 }],
};
const rest: SRExercise = { name: 'Отдых', group: 'ОФП', coef: 1, mnosz: 1, pm: 80, sets: [{ weight: 40, reps: 5, sets: 3 }] };
const test: SRExercise = { name: 'Тест: проходка (до макс)', group: 'СФП', coef: 1, mnosz: 1, pm: 150, sets: [{ weight: 150, reps: 1, sets: 1 }] };

describe('isPseudoExercise', () => {
  it('маркеры распознаются, обычные имена — нет', () => {
    expect(isPseudoExercise('Отдых')).toBe(true);
    expect(isPseudoExercise(' отдых ')).toBe(true);
    expect(isPseudoExercise('Тест: проходка (до макс)')).toBe(true);
    expect(isPseudoExercise('тест: 1ПМ')).toBe(true);
    expect(isPseudoExercise('Тестовый жим лежа')).toBe(false);
    expect(isPseudoExercise('Присед')).toBe(false);
  });
});

describe('метрики сессии/цикла без псевдо-упражнений', () => {
  it('«Отдых» не добавляет тоннаж/КПШ и не считается упражнением', () => {
    const withPseudo = calcSessionMetrics([real, rest, test]);
    const onlyReal = calcSessionMetrics([real]);
    expect(withPseudo.tonnage).toBe(onlyReal.tonnage);
    expect(withPseudo.kpsh).toBe(onlyReal.kpsh);
    expect(withPseudo.exerciseCount).toBe(1);
  });

  it('calcCycleMetrics: сессия с маркерами = сессия без них', () => {
    const a = calcCycleMetrics([[real, rest], [test, real]]);
    const b = calcCycleMetrics([[real], [real]]);
    expect(a.tonnage).toBe(b.tonnage);
    expect(a.kpsh).toBe(b.kpsh);
    expect(a.perSession[0].exerciseCount).toBe(1);
  });
});
