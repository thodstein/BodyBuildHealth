/**
 * rpe-formulas-boundary.test.ts — §3 плана ПЛ-авто: «RPE→% дубль».
 *
 * Сверка показала: это НЕ дубль, а две осознанные линейки под разные контуры,
 * каждая со своим каноном (шапки обоих движков это фиксируют):
 *   • Epley `pctForRPE` (autoregulation-pro.engine) — авторегуляция/дневник:
 *     diary-autoreg, manual-progression, UnifiedIntelligenceHub, LoadSafetyCard.
 *   • Brzycki `rpePctBrzycki` (rpe-table.engine) — сетка RPE/RIR StrengthAnalysisHub
 *     и OneRmCalcTab (сверена с Cornerstone 8×9, ±0.5 п.п.).
 * Сведение в одну формулу сдвинуло бы числа одной из сторон (расхождение до ~4 п.п.
 * на высоких повторах) → решение: оставить обе, границу заморозить этим тестом.
 * Если кто-то «унифицирует» формулу — тест падает и требует осознанного re-baseline.
 */
import { describe, expect, it } from 'vitest';
import { pctForRPE } from '../autoregulation-pro.engine';
import { rpePctBrzycki } from '../rpe-table.engine';

describe('RPE→%: граница линеек Epley (авторегуляция) vs Brzycki (сетка)', () => {
  it('якоря Epley-линейки (autoregulation-pro) — без дрейфа', () => {
    expect(pctForRPE(10, 1)).toBe(1);
    expect(pctForRPE(7, 5)).toBeCloseTo(0.789, 3);
    expect(pctForRPE(8, 5)).toBeCloseTo(0.811, 3);
    expect(pctForRPE(9, 3)).toBeCloseTo(0.882, 3);
    expect(pctForRPE(6, 10)).toBeCloseTo(0.682, 3);
  });

  it('якоря Brzycki-линейки (rpe-table) — без дрейфа', () => {
    expect(rpePctBrzycki(5, 8)).toBeCloseTo(0.833, 3);
    expect(rpePctBrzycki(1, 9)).toBeCloseTo(0.972, 3);
    expect(rpePctBrzycki(8, 7)).toBeCloseTo(0.722, 3);
    expect(rpePctBrzycki(10, 6)).toBeCloseTo(0.639, 3);
  });

  it('линейки намеренно РАЗНЫЕ (не «случайный дубль»): якоря не совпадают', () => {
    for (const [reps, rpe] of [[5, 8], [3, 9], [8, 7], [10, 6]] as const) {
      const epley = pctForRPE(rpe, reps);
      const brzycki = rpePctBrzycki(reps, rpe);
      expect(epley, `${reps}@${rpe}`).not.toBeCloseTo(brzycki, 6);
      // Обе в разумном коридоре рабочего диапазона (не расходятся катастрофически).
      expect(Math.abs(epley - brzycki), `${reps}@${rpe}`).toBeLessThan(0.05);
    }
  });

  it('обе линейки монотонны по RPE (выше RPE → выше % при тех же повторах)', () => {
    for (const reps of [1, 5, 10]) {
      let prevE = 0, prevB = 0;
      for (let rpe = 6; rpe <= 10; rpe++) {
        const e = pctForRPE(rpe, reps);
        const b = rpePctBrzycki(reps, rpe);
        expect(e, `Epley ${reps}@${rpe}`).toBeGreaterThanOrEqual(prevE);
        expect(b, `Brzycki ${reps}@${rpe}`).toBeGreaterThanOrEqual(prevB);
        prevE = e; prevB = b;
      }
    }
  });
});
