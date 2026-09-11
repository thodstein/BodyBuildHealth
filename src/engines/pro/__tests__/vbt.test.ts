import { describe, expect, it } from 'vitest';
import {
  velocityForPct,
  pctForVelocity,
  targetVelocity,
  targetPct,
  loadForPct,
  estimate1RMFromVelocity,
  velocityLoss,
  thresholdForIntent,
  velocityLossZone,
  diagnoseVelocity,
  LOAD_VELOCITY_PROFILE,
  INTENT_ZONES,
  VL_THRESHOLDS,
} from '../vbt.engine';

describe('velocityForPct', () => {
  it('100% squat ≈ 0.30 m/s', () => {
    expect(velocityForPct('squat', 1.0)).toBeCloseTo(0.30, 1);
  });
  it('50% squat ≈ 1.00 m/s', () => {
    expect(velocityForPct('squat', 0.5)).toBeCloseTo(1.00, 1);
  });
  it('clamps at boundaries', () => {
    expect(velocityForPct('bench', 1.1)).toBeLessThanOrEqual(0.2);
    expect(velocityForPct('bench', 0.2)).toBeGreaterThanOrEqual(1.1);
  });
});

describe('pctForVelocity (inverse)', () => {
  it('round-trips with velocityForPct', () => {
    const pct = 0.80;
    const v = velocityForPct('deadlift', pct);
    const back = pctForVelocity('deadlift', v);
    expect(Math.abs(back - pct)).toBeLessThan(0.02);
  });
});

describe('intent zones', () => {
  it('all 6 intents defined', () => {
    expect(Object.keys(INTENT_ZONES)).toHaveLength(6);
  });
  it('absolute_strength is heaviest', () => {
    expect(targetPct('absolute_strength')).toBeGreaterThan(targetPct('strength'));
    expect(targetPct('absolute_strength')).toBeGreaterThan(targetPct('hypertrophy'));
  });
  it('targetVelocity returns min/max/ideal', () => {
    const v = targetVelocity('power_heavy');
    expect(v.min).toBeLessThan(v.ideal);
    expect(v.ideal).toBeLessThan(v.max);
  });
});

describe('loadForPct', () => {
  it('returns e1RM × pct', () => {
    expect(loadForPct(200, 0.8)).toBe(160);
  });
  it('clamps pct', () => {
    expect(loadForPct(200, 0.1)).toBe(loadForPct(200, 0.3));
  });
});

describe('velocityLoss', () => {
  it('detects exceeded threshold', () => {
    const r = velocityLoss([1.0, 0.9, 0.8, 0.7, 0.6], 10);
    expect(r).toBeTruthy();
    expect(r!.exceeded).toBe(true);
    expect(r!.lossPct).toBe(40);
  });

  it('no exceed at low loss', () => {
    const r = velocityLoss([1.0, 0.98, 0.97, 0.96], 20);
    expect(r).toBeTruthy();
    expect(r!.exceeded).toBe(false);
    expect(r!.remainingReps).toBeGreaterThanOrEqual(0);
  });

  it('returns null for empty', () => {
    expect(velocityLoss([])).toBeNull();
  });
});

describe('thresholdForIntent', () => {
  it('strength → 20', () => expect(thresholdForIntent('strength')).toBe(20));
  it('power_heavy → 10', () => expect(thresholdForIntent('power_heavy')).toBe(10));
  it('hypertrophy → 25', () => expect(thresholdForIntent('hypertrophy')).toBe(25));
});

describe('velocityLossZone', () => {
  it('labels ranges correctly', () => {
    expect(velocityLossZone(5)).toContain('стабильна');
    expect(velocityLossZone(15)).toContain('силы');
    expect(velocityLossZone(22)).toContain('гипертрофии');
    expect(velocityLossZone(30)).toContain('метаболического');
    expect(velocityLossZone(45)).toContain('стоп');
  });
});

describe('LOAD_VELOCITY_PROFILE', () => {
  it('has all lifts with sorted data', () => {
    for (const lift of ['squat', 'bench', 'deadlift', 'ohp', 'row'] as const) {
      const tbl = LOAD_VELOCITY_PROFILE[lift];
      expect(tbl.length).toBeGreaterThanOrEqual(6);
      // %1RM should be descending
      for (let i = 1; i < tbl.length; i++) {
        expect(tbl[i][0]).toBeLessThan(tbl[i - 1][0]);
      }
    }
  });
});

describe('diagnoseVelocity — ручной ввод скорости → потеря/фаза/e1RM', () => {
  it('высокая потеря (>20%) → exceeded + фаза максимального момента', () => {
    const d = diagnoseVelocity('squat', 0.75, 0.45);
    expect(d.lossPct).toBe(40);
    expect(d.exceeded).toBe(true);
    expect(d.suggestedPhase).toBe('bottom');
    expect(d.zone).toContain('стоп');
  });

  it('умеренная потеря (<20%) → без фазы', () => {
    const d = diagnoseVelocity('bench', 0.6, 0.54);
    expect(d.exceeded).toBe(false);
    expect(d.suggestedPhase).toBeNull();
  });

  it('e1RM по скорости с весом (bench, последний повтор)', () => {
    const d = diagnoseVelocity('bench', 0.50, 0.40, 100);
    expect(d.e1RMByVelocity).not.toBeNull();
    expect(d.e1RMByVelocity!).toBeGreaterThan(100);
  });

  it('без веса — e1RMByVelocity null', () => {
    const d = diagnoseVelocity('deadlift', 0.62, 0.50);
    expect(d.e1RMByVelocity).toBeNull();
  });

  it('pulldown/incline_press маппятся на ближайший LVP (row/bench) без ошибок', () => {
    const d1 = diagnoseVelocity('pulldown', 0.7, 0.5);
    expect(Number.isFinite(d1.lossPct)).toBe(true);
    const d2 = diagnoseVelocity('incline_press', 0.6, 0.45, 80);
    expect(d2.e1RMByVelocity).not.toBeNull();
  });

  it('некорректные скорости — нулевая потеря, без фазы', () => {
    const d = diagnoseVelocity('squat', 0, 0);
    expect(d.lossPct).toBe(0);
    expect(d.exceeded).toBe(false);
    expect(d.suggestedPhase).toBeNull();
  });

  it('P1-синк: triceps/calf/shrug дают *_start-фазу при превышении', () => {
    expect(diagnoseVelocity('triceps', 0.6, 0.4).suggestedPhase).toBe('triceps_start');
    expect(diagnoseVelocity('calf', 0.6, 0.4).suggestedPhase).toBe('calf_bottom');
    expect(diagnoseVelocity('shrug', 0.6, 0.4).suggestedPhase).toBe('shrug_start');
  });
});

describe('P3: цель-пороги + MVT всех лифтов + stale-профиль', () => {
  it('thresholdForGoal: сила 20 / скорость 10 / масса 25 (RU+EN)', async () => {
    const { thresholdForGoal, diagnoseVelocityForGoal, mvtForPLLift, lvrStale } = await import('../vbt.engine');
    expect(thresholdForGoal('strength')).toBe(20);
    expect(thresholdForGoal('Сила')).toBe(20);
    expect(thresholdForGoal('speed')).toBe(10);
    expect(thresholdForGoal('Скорость')).toBe(10);
    expect(thresholdForGoal('mass')).toBe(25);
    expect(thresholdForGoal('Масса')).toBe(25);
    expect(thresholdForGoal(null)).toBe(20);
    expect(thresholdForGoal('???')).toBe(20);
  });
  it('diagnoseVelocityForGoal: та же потеря 15% — сила ок, скорость превышена', async () => {
    const { diagnoseVelocityForGoal } = await import('../vbt.engine');
    const s = diagnoseVelocityForGoal('bench', 0.6, 0.51, undefined, 'strength');
    expect(s.exceeded).toBe(false);
    const v = diagnoseVelocityForGoal('bench', 0.6, 0.51, undefined, 'speed');
    expect(v.exceeded).toBe(true);
  });
  it('mvtForPLLift: 5 канон + 7 ориентиров с флагом', async () => {
    const { mvtForPLLift } = await import('../vbt.engine');
    expect(mvtForPLLift('bench')).toEqual({ mvt: 0.15, isEstimate: false });
    expect(mvtForPLLift('squat').isEstimate).toBe(false);
    expect(mvtForPLLift('triceps').isEstimate).toBe(true);
    expect(mvtForPLLift('calf').mvt).toBeGreaterThan(0);
    expect(mvtForPLLift('shrug').mvt).toBeGreaterThan(0);
  });
  it('lvrStale: >6 недель — stale, свежее — нет, мусор — null', async () => {
    const { lvrStale } = await import('../vbt.engine');
    const now = Date.now();
    expect(lvrStale(now - 50 * 24 * 3600 * 1000, now)!.stale).toBe(true);
    expect(lvrStale(now - 7 * 24 * 3600 * 1000, now)!.stale).toBe(false);
    expect(lvrStale(null)).toBeNull();
    expect(lvrStale(NaN)).toBeNull();
  });
});
