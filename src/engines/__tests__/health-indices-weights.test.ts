/**
 * health-indices-weights.test.ts — проход 207: веса ASI/HMI/CR названы.
 *
 * ASI/HMI/CR — индексы приложения, а не клинические шкалы: опубликованного
 * источника у весов нет (правило 26). До прохода 207 веса жили литералами
 * внутри `computeHealthIndices`, и правка формулы меняла число на двух экранах
 * молча, а «ASI 72 %» читался как клиническая оценка. Здесь три вещи:
 *  1) веса заморожены — молчаливая правка падает;
 *  2) формула читает константы (проверка на числах, а не на тексте);
 *  3) оба экрана подписывают индекс «индекс приложения».
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ASI_WEIGHTS,
  HMI_WEIGHTS,
  CR_WEIGHTS,
  computeHealthIndices,
  type LabCompositeResult,
} from '../lab-analysis.engine';

const res = (over: Partial<LabCompositeResult>): LabCompositeResult =>
  ({
    homaIR: null,
    liverStress: null,
    cardioRisk: null,
    inflammation: null,
    kidneyStress: null,
    hormoneScore: null,
    interpretations: [],
    boundUnproven: [],
    ...over,
  }) as LabCompositeResult;

describe('проход 207: веса ASI/HMI/CR', () => {
  it('веса заморожены: молчаливая правка формулы падает', () => {
    expect(ASI_WEIGHTS).toEqual({ hormones: 0.4, inflammation: 0.3, kidney: 0.3 });
    expect(HMI_WEIGHTS).toEqual({ liver: 1.2, inflammation: 0.5 });
    expect(CR_WEIGHTS).toEqual({ cardio: 1.1, inflammation: 0.6 });
    // ASI — доли одного целого, HMI/CR — множители с потолком 100.
    expect(ASI_WEIGHTS.hormones + ASI_WEIGHTS.inflammation + ASI_WEIGHTS.kidney).toBeCloseTo(1, 10);
  });

  it('формула читается из констант, а не из литералов', () => {
    const r = res({ hormoneScore: 67, inflammation: 33, kidneyStress: 0, liverStress: 50, cardioRisk: 67 });
    const idx = computeHealthIndices(r);
    // Числа выписаны, чтобы гард падал и от правки веса, и от правки формулы:
    // сравнение с той же константой проходило бы при любом весе.
    // ASI = 100 − (67 × 0.4 + 33 × 0.3) = 63.3 → 63.
    // HMI = 50 × 1.2 + 33 × 0.5 = 76.5 → 77. CR = 67 × 1.1 + 33 × 0.6 = 93.5 → 94.
    expect(idx.asi).toBe(63);
    expect(idx.hmi).toBe(77);
    expect(idx.cr).toBe(94);
  });

  it('неизмеренный вход — «нет данных», а не оценка по нулю', () => {
    const idx = computeHealthIndices(res({ inflammation: 33, kidneyStress: 0, liverStress: 0, cardioRisk: 0 }));
    expect(idx.asi).toBeNull(); // нет hormoneScore
    expect(idx.hmi).toBe(17); // 0 * 1.2 + 33 * 0.5 = 16.5 → 17
    expect(idx.cr).toBe(20); // 0 * 1.1 + 33 * 0.6 = 19.8 → 20
  });

  it('оба экрана подписывают индекс как индекс приложения', () => {
    for (const file of ['src/ui/screens/LabsScreen.tsx', 'src/ui/screens/RiskScreen.tsx']) {
      const src = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(src, `${file}: подпись не говорит, что это индекс приложения`).toContain('индекс приложения');
    }
  });
});
