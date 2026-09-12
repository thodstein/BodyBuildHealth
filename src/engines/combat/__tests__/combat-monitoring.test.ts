import { describe, it, expect, beforeEach } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import {
  combatACWRUncoupled,
  combatACWRHonest,
  combatHrvReportWithSource,
} from '../combat-monitoring.engine';
import {
  diagnoseVelocityLossCombat,
  vbtHistoryForLift,
  combatLossThresholdForGoal,
  atrTransitionHintForTrend,
  isCombatLiftCalibrated,
  vbtTrendForLift,
} from '../combat-vbt.engine';
import { combatLastResultIndex } from '../combat-diary.engine';

/**
 * combat P6: честный мониторинг — EWMA-uncoupled ACWR + VBT без ложных калибровок
 * + HRV с источником + per-exercise дневник.
 */
describe('combat EWMA-uncoupled ACWR', () => {
  const d = (v: number, n: number) => Array.from({ length: n }, () => v);
  it('стабильная нагрузка — optimal, метод ewma_uncoupled', () => {
    const r = combatACWRUncoupled([...d(100, 21), ...d(100, 7)]);
    expect(r).not.toBeNull();
    expect(r!.zone).toBe('optimal');
    expect(r!.method).toBe('ewma_uncoupled');
    expect(r!.lowBase).toBe(false);
  });
  it('скачок ×3 — dangerous (EWMA ловит)', () => {
    const r = combatACWRUncoupled([...d(100, 21), ...d(300, 7)]);
    expect(r!.zone).toBe('dangerous');
    expect(r!.ratio).toBeGreaterThan(1.5);
  });
  it('низкая база <100 — не выше caution (lowBase)', () => {
    const r = combatACWRUncoupled(d(50, 28));
    expect(r!.zone).toBe('caution');
    expect(r!.lowBase).toBe(true);
  });
  it('хроника исключает острую неделю (uncoupled): 21×100 + 7×100 vs 28×100 равны', () => {
    const a = combatACWRUncoupled(d(100, 28));
    const b = combatACWRUncoupled([...d(100, 21), ...d(100, 7)]);
    expect(a!.ratio).toBeCloseTo(b!.ratio, 1);
  });
  it('<14 точек — null; honest-обёртка выбирает метод честно', () => {
    expect(combatACWRUncoupled(d(100, 10))).toBeNull();
    const h1 = combatACWRHonest(d(100, 28));
    expect(h1.method).toBe('ewma_uncoupled');
    expect(h1.shortHistory).toBe(false);
    const h2 = combatACWRHonest(d(100, 10));
    expect(h2.method).toBe('ra_coupled');
    expect(h2.shortHistory).toBe(true);
    expect(h2.report).not.toBeNull();
    expect(combatACWRHonest(d(100, 3)).report).toBeNull();
  });
});

describe('combat HRV with source', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });
  it('один замер из профиля — single с пометкой, а не null', () => {
    localStorage.setItem('he_profile_v2', JSON.stringify({ lifestyle: { morningHRV: 62 } }));
    const r = combatHrvReportWithSource();
    expect(r).not.toBeNull();
    expect(r!.source).toBe('single');
    expect(r!.grade).toBe('optimal');
    expect(r!.note).toContain('7+ дней');
  });
  it('история 7+ — history без пометки', () => {
    localStorage.setItem('he_hrv_log', JSON.stringify([60, 62, 61, 63, 62, 64, 61]));
    const r = combatHrvReportWithSource();
    expect(r!.source).toBe('history');
    expect(r!.note).not.toContain('7+ дней');
  });
  it('пусто — null', () => {
    expect(combatHrvReportWithSource()).toBeNull();
  });
});

describe('combat VBT honest', () => {
  it('баллистика не калибрована: e1RM null + честная рекомендация', () => {
    expect(isCombatLiftCalibrated('battle_rope')).toBe(false);
    expect(isCombatLiftCalibrated('med_ball_throw')).toBe(false);
    expect(isCombatLiftCalibrated('box_jump')).toBe(false);
    expect(isCombatLiftCalibrated('bench_bar')).toBe(true);
    expect(isCombatLiftCalibrated('squat')).toBe(true);
    expect(isCombatLiftCalibrated('mystery_lift')).toBe(false);
    const b = diagnoseVelocityLossCombat(1.0, 0.8, 20, 80, 'battle_rope');
    expect(b.calibrated).toBe(false);
    expect(b.e1RMByVelocity).toBeNull();
    expect(b.recommendation).toContain('Нет калибровки');
    const s = diagnoseVelocityLossCombat(0.8, 0.7, 20, 100, 'squat');
    expect(s.calibrated).toBe(true);
    expect(s.e1RMByVelocity).toBeGreaterThan(0);
  });
  it('loss-математика не зависит от калибровки; generic без id — legacy', () => {
    const a = diagnoseVelocityLossCombat(0.8, 0.6, 20);
    expect(a.lossPct).toBe(25);
    expect(a.calibrated).toBe(true);
    expect(a.recommendation).toContain('RIR');
  });
  it('exact match: row ≠ battle_rope, press не ловит всё', () => {
    const hist = [
      { liftId: 'battle_rope', velocity: 1.2, date: '2026-09-01' },
      { liftId: 'row_bar', velocity: 0.7, date: '2026-09-01' },
      { liftId: 'row_bar', velocity: 0.65, date: '2026-09-02' },
    ];
    expect(vbtHistoryForLift(hist, 'row')).toEqual([]);
    expect(vbtHistoryForLift(hist, 'row_bar')).toEqual([0.7, 0.65]);
    expect(vbtHistoryForLift(hist, 'battle_rope')).toEqual([1.2]);
  });
  it('порог по цели + MCV-hint', () => {
    expect(combatLossThresholdForGoal('endurance')).toBe(30);
    expect(combatLossThresholdForGoal('power')).toBe(20);
    expect(combatLossThresholdForGoal('camp')).toBe(20);
    expect(combatLossThresholdForGoal('maintenance')).toBe(25);
    expect(atrTransitionHintForTrend('squat', 6)).toContain('Transmutation');
    expect(atrTransitionHintForTrend('squat', 2)).toBeNull();
    expect(atrTransitionHintForTrend('squat', null)).toBeNull();
  });
  it('vbtTrendForLift считает EWMA-сдвиг', () => {
    const hist = Array.from({ length: 14 }, (_, i) => ({
      liftId: 'squat', velocity: 0.6 + i * 0.01, date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    }));
    const t = vbtTrendForLift(hist, 'squat');
    expect(t.changePct).toBeGreaterThan(0);
    expect(vbtTrendForLift(hist.slice(0, 3), 'squat').changePct).toBeNull();
  });
});

describe('combat per-exercise diary index', () => {
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  it('лучший e1RM 28д по упражнению; старое и безвесовое — игнор', () => {
    const logs = [
      { exerciseId: 'squat', date: daysAgo(5), sets: [{ weight: 100, reps: 5 }] },
      { exerciseId: 'squat', date: daysAgo(12), sets: [{ weight: 90, reps: 5 }] },
      { exerciseId: 'squat', date: daysAgo(40), sets: [{ weight: 120, reps: 5 }] },
      { exerciseId: 'deadbug', date: daysAgo(3), sets: [{ weight: 0, reps: 10 }] },
    ];
    const idx = combatLastResultIndex(logs);
    expect(idx.squat.e1rm).toBeCloseTo(100 * (1 + 5 / 30), 1);
    expect(idx.squat.date).toBe(daysAgo(5));
    expect(idx.deadbug).toBeUndefined();
  });
  it('пусто/мусор — пустой индекс', () => {
    expect(combatLastResultIndex([])).toEqual({});
    expect(combatLastResultIndex(null as any)).toEqual({});
  });
});

describe('combat P6 builder wiring', () => {
  it('MCV-hint в rationale при росте скорости приседа', () => {
    const hist = Array.from({ length: 14 }, (_, i) => ({
      liftId: 'squat', velocity: 0.6 + i * 0.015, date: `2026-08-${String(i + 1).padStart(2, '0')}`, weight: 100,
    }));
    const plan = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 6, daysPerWeek: 3, vbtHistory: hist } as any);
    expect(plan.rationale.some((r: string) => r.includes('Transmutation'))).toBe(true);
  });
  it('без истории — hint нет, план как раньше', () => {
    const plan = buildCombatPlan({ discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 6, daysPerWeek: 3 } as any);
    expect(plan.rationale.some((r: string) => r.includes('MCV-критерий'))).toBe(false);
  });
});
