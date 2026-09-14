/**
 * bb-wave3-hooks.test.ts — Волна-3 (аудит 2026-09), этап B:
 * 3.12 VBT-вход в генерацию (порог потери → срез/RIR);
 * 3.13 overreachingCheck → вторая разгрузка;
 * 3.14 RIR-эскалация между мезо.
 */
import { describe, it, expect } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { rirEscalationFromPreviousPlan, extractMesocycleProgression } from '../bb-mesocycle-progression.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };
const base = { patternId: 'upper_lower_4', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 8, workMax: WM } as any;

const totalSets = (plan: any) => plan.weeks.reduce((a: number, w: any) =>
  a + w.sessions.reduce((b: number, s: any) => b + s.exercises.filter((e: any) => !e.warmupActivator).reduce((c: number, e: any) => c + e.sets, 0), 0), 0);

const firstPrimaryRir = (plan: any): number => {
  const week = plan.weeks.find((w: any) => w.phase !== 'deload' && !w.deload);
  for (const s of week.sessions) {
    const primary = s.exercises.find((e: any) => e.role === 'primary');
    if (primary && Number.isFinite(Number(primary.rir))) return Number(primary.rir);
  }
  return NaN;
};

describe('Волна-3.12 — VBT-вход режет объём/RIR по порогу потери скорости', () => {
  it('потеря ≥40% → объём ×0.8, RIR+2, честная пометка', () => {
    const plain = buildBBPlan({ ...base });
    const vbt = buildBBPlan({ ...base, vbt: { lift: 'squat', bestVelocity: 1.0, lastVelocity: 0.55, weightKg: 140 } });
    expect(totalSets(vbt)).toBeLessThan(totalSets(plain));
    expect(vbt.rationale.some((r: string) => r.includes('VBT-коррекция применена'))).toBe(true);
    expect(vbt.rationale.some((r: string) => r.includes('⚡ VBT:'))).toBe(true);
  });

  it('стабильная скорость (<10%) — без коррекции, только рекомендация', () => {
    const plain = buildBBPlan({ ...base });
    const vbt = buildBBPlan({ ...base, vbt: { lift: 'squat', bestVelocity: 1.0, lastVelocity: 0.95, weightKg: 140 } });
    expect(totalSets(vbt)).toBe(totalSets(plain));
    expect(vbt.rationale.some((r: string) => r.includes('VBT-коррекция применена'))).toBe(false);
    expect(vbt.rationale.some((r: string) => r.includes('⚡ VBT:'))).toBe(true);
  });

  it('без VBT-входа план не меняется', () => {
    const a = buildBBPlan({ ...base });
    const b = buildBBPlan({ ...base });
    expect(totalSets(a)).toBe(totalSets(b));
    expect(a.rationale.some((r: string) => r.includes('VBT'))).toBe(false);
  });
});

describe('Волна-3.13 — overreachingCheck: не «очищено» → вторая разгрузка', () => {
  it('readiness не выросла → неделя после делода срезана (−20%, RIR+2)', () => {
    const plain = buildBBPlan({ ...base });
    const oc = buildBBPlan({ ...base, deloadReadiness: { before: 40, after: 41 } });
    expect(oc.rationale.some((r: string) => r.includes('Вторая разгрузка'))).toBe(true);
    const marked = oc.weeks.find((w: any) => (w as any).overreachingDeload === true);
    expect(marked).toBeDefined();
    const plainSame = plain.weeks.find((w: any) => w.week === (marked as any).week);
    expect(totalSets({ weeks: [marked] })).toBeLessThan(totalSets({ weeks: [plainSame] }));
  });

  it('readiness восстановилась → тишина (только ✅ в rationale)', () => {
    const oc = buildBBPlan({ ...base, deloadReadiness: { before: 50, after: 70 } });
    expect(oc.rationale.some((r: string) => r.includes('✅ Overreaching-проверка'))).toBe(true);
    expect(oc.rationale.some((r: string) => r.includes('Вторая разгрузка'))).toBe(false);
    expect(oc.weeks.some((w: any) => (w as any).overreachingDeload === true)).toBe(false);
  });
});

describe('Волна-3.14 — RIR-эскалация между мезо', () => {
  const mkPrev = (primaryRir: number) => ({
    pattern: { id: 'upper_lower_4' }, rationale: [], rotationMuscleVolume: {}, mrvByMuscle: {},
    weeks: [
      { week: 1, phase: 'accumulation', sessions: [{ day: 1, exercises: [{ muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж', sets: 3, repsRange: [6, 8], rir: primaryRir, workSets: [{ reps: 8, rir: primaryRir, weight: 100 }] }] }] },
      { week: 2, phase: 'intensification', sessions: [{ day: 1, exercises: [{ muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж', sets: 3, repsRange: [6, 8], rir: primaryRir, workSets: [{ reps: 8, rir: primaryRir, weight: 100 }] }] }] },
    ],
  });

  it('прошлый мезо у отказа (RIR 0) → эскалация +1', () => {
    expect(rirEscalationFromPreviousPlan(mkPrev(0) as any)).toBe(1);
    expect(rirEscalationFromPreviousPlan(mkPrev(2) as any)).toBe(0);
    expect(rirEscalationFromPreviousPlan(undefined)).toBe(0);
    expect(extractMesocycleProgression(mkPrev(0) as any, 'intermediate', 'mass').rirEscalation).toBe(1);
  });

  it('интеграция: стартовый RIR нового плана +1 и строка в rationale', () => {
    const plain = buildBBPlan({ ...base });
    const withPrev = buildBBPlan({ ...base, previousPlan: mkPrev(0) as any });
    expect(withPrev.rationale.some((r: string) => r.includes('RIR-волна'))).toBe(true);
    expect(firstPrimaryRir(withPrev)).toBe(Math.min(5, firstPrimaryRir(plain) + 1));
  });
});

