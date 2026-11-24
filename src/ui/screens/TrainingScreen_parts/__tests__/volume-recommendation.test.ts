import { describe, it, expect } from 'vitest';
import type { BBMuscleVolume } from '../../../../engines/bb/bb-metrics.engine';
import { checkVolumeStatus, type MuscleVolumeLandmarks } from '../../../../engines/volume-landmarks.engine';
import { volumeRecommendation } from '../volume-recommendation';

const LM: MuscleVolumeLandmarks = { mev: 5, mav: 7, mrv: 9 };

/** Статус берём из канона checkVolumeStatus, чтобы тест падал при расхождении статуса и подписи. */
function muscleAt(effectiveSets: number): BBMuscleVolume {
  return {
    muscle: 'chest',
    totalSets: effectiveSets,
    directSets: effectiveSets,
    effectiveSets,
    fatigueWeightedSets: effectiveSets,
    тяжSets: 0,
    пампSets: 0,
    лёгSets: 0,
    hardSets: 0,
    avgRir: 2,
    frequencyPerRotation: 2,
    mev: LM.mev,
    mav: LM.mav,
    mrv: LM.mrv,
    status: checkVolumeStatus(effectiveSets, LM),
  };
}

describe('volumeRecommendation — подпись объёма из статуса мышцы', () => {
  it.each([4.9, 5, 6, 7, 7.1, 9, 9.1])('effective %s: нет нулевого разрыва, текст согласован со статусом', (eff) => {
    const m = muscleAt(eff);
    const text = volumeRecommendation(m);

    // Ни «+0.0», ни «−0.0» — иначе на границе видно «Ниже оптимума: +0.0».
    expect(text).not.toContain('+0.0');
    expect(text).not.toContain('−0.0');
    expect(text).not.toMatch(/[+−]0\.0/);

    if (m.status === 'optimal') {
      expect(text).not.toContain('Недотрен');
      expect(text).not.toContain('Ниже оптимума');
    }
    if (m.status === 'approaching_mrv') expect(text).not.toContain('Перегруз');
    if (m.status === 'exceeding_mrv') expect(text).not.toContain('Выше оптимума');
  });

  it('ниже MEV — недотрен с разрывом до MEV', () => {
    const m = muscleAt(4.9);
    expect(m.status).toBe('below_mev');
    expect(volumeRecommendation(m)).toBe('Недотрен: +0.1 эфф до MEV 5');
  });

  it('на MEV и внутри зоны — оптимум, а не «Ниже оптимума»', () => {
    expect(muscleAt(5).status).toBe('optimal');
    expect(volumeRecommendation(muscleAt(5))).toBe('В оптимуме: до MAV ещё +2.0 эфф');
    expect(volumeRecommendation(muscleAt(6))).toBe('В оптимуме: до MAV ещё +1.0 эфф');
  });

  it('ровно на MAV — «в точке MAV», без нулевого разрыва', () => {
    expect(muscleAt(7).status).toBe('optimal');
    expect(volumeRecommendation(muscleAt(7))).toBe('Оптимум — в точке MAV 7');
  });

  it('выше MAV — «Выше оптимума» с разрывом до MAV', () => {
    expect(muscleAt(7.1).status).toBe('approaching_mrv');
    expect(volumeRecommendation(muscleAt(7.1))).toBe('Выше оптимума: 7–9, можно держать или −0.1 эфф до MAV');
  });

  it('ровно на MRV — ветка approaching_mrv, а не «Перегруз»', () => {
    const m = muscleAt(9);
    expect(m.status).toBe('approaching_mrv');
    const text = volumeRecommendation(m);
    expect(text).not.toContain('Перегруз');
    expect(text).toBe('Выше оптимума: 7–9, можно держать или −2.0 эфф до MAV');
  });

  it('выше MRV — перегруз с разрывом до MRV', () => {
    expect(muscleAt(9.1).status).toBe('exceeding_mrv');
    expect(volumeRecommendation(muscleAt(9.1))).toBe('Перегруз: −0.1 эфф — выше MRV 9');
  });

  it('единица измерения подставляется (VolumeBudgetCard передаёт effective)', () => {
    expect(volumeRecommendation(muscleAt(4.9), 'effective')).toBe('Недотрен: +0.1 effective до MEV 5');
    expect(volumeRecommendation(muscleAt(7.1), 'effective')).toContain('−0.1 effective до MAV');
  });

  it('float-хвост в effectiveSets не печатает «+0.0»', () => {
    // 6.9999999 при MAV 7 — статус optimal, а разрыв после нормализации ровно 0.
    const m = muscleAt(6.9999999);
    expect(m.status).toBe('optimal');
    const text = volumeRecommendation(m);
    expect(text).not.toMatch(/[+−]0\.0/);
    expect(text).toBe('Оптимум — в точке MAV 7');
  });

  it('NaN в effectiveSets не печатает NaN в подписи', () => {
    const m: BBMuscleVolume = { ...muscleAt(6), effectiveSets: Number.NaN };
    const text = volumeRecommendation(m);
    expect(text).not.toContain('NaN');
    expect(text).toContain('MAV');
  });
});
