import { describe, expect, it } from 'vitest';
import { QUALITY_GRADE_THRESHOLDS, gradeQualityScore } from '../../quality-score-v2.engine';
import { gradeFor } from '../bb-quality-weekly.engine';

/**
 * 4.1 (план BB-AUTO-EXHAUSTIVE): единая шкала качества — один источник ступеней
 * (QUALITY_GRADE_THRESHOLDS: 85/65/45) для V2/report и понедельной оценки.
 * Ярлыки поверхностей различаются осознанно (обратная совместимость UI), но
 * ГРАНИЦЫ грейдов обязаны совпадать — этот лок-тест их замораживает.
 */
describe('4.1: единая шкала качества (пороги 85/65/45 из одного источника)', () => {
  it('QUALITY_GRADE_THRESHOLDS — канон 85/65/45', () => {
    expect(QUALITY_GRADE_THRESHOLDS).toEqual({ excellent: 85, good: 65, fair: 45 });
  });

  it('gradeQualityScore: ступени на границах', () => {
    expect(gradeQualityScore(100)).toBe('🟢 Профессионально');
    expect(gradeQualityScore(QUALITY_GRADE_THRESHOLDS.excellent)).toBe('🟢 Профессионально');
    expect(gradeQualityScore(QUALITY_GRADE_THRESHOLDS.excellent - 0.1)).toBe('🟡 Хорошо');
    expect(gradeQualityScore(QUALITY_GRADE_THRESHOLDS.good)).toBe('🟡 Хорошо');
    expect(gradeQualityScore(QUALITY_GRADE_THRESHOLDS.good - 0.1)).toBe('🟠 Удовлетворительно');
    expect(gradeQualityScore(QUALITY_GRADE_THRESHOLDS.fair)).toBe('🟠 Удовлетворительно');
    expect(gradeQualityScore(QUALITY_GRADE_THRESHOLDS.fair - 0.1)).toBe('🔴 Требует доработки');
    expect(gradeQualityScore(0)).toBe('🔴 Требует доработки');
  });

  it('gradeFor (недельная): те же границы, свои ярлыки', () => {
    expect(gradeFor(QUALITY_GRADE_THRESHOLDS.excellent)).toBe('🟢 Отлично');
    expect(gradeFor(QUALITY_GRADE_THRESHOLDS.excellent - 0.1)).toBe('🟡 Хорошо');
    expect(gradeFor(QUALITY_GRADE_THRESHOLDS.good)).toBe('🟡 Хорошо');
    expect(gradeFor(QUALITY_GRADE_THRESHOLDS.good - 0.1)).toBe('🟠 Средне');
    expect(gradeFor(QUALITY_GRADE_THRESHOLDS.fair)).toBe('🟠 Средне');
    expect(gradeFor(QUALITY_GRADE_THRESHOLDS.fair - 0.1)).toBe('🔴 Слабо');
  });

  it('обе поверхности дают одинаковый уровень для одних и тех же баллов', () => {
    const tier = (g: string) => (g.includes('Профессионально') || g.includes('Отлично') ? 0
      : g.includes('Хорошо') ? 1
        : g.includes('Удовлетворительно') || g.includes('Средне') ? 2 : 3);
    for (const score of [0, 10, 44.9, 45, 50, 64.9, 65, 70, 84.9, 85, 90, 100]) {
      expect(tier(gradeFor(score)), `score=${score}`).toBe(tier(gradeQualityScore(score)));
    }
  });
});
