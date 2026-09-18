/**
 * bb-cycle-program-factors.test.ts — паритет program↔generic по «мягким»
 * настройкам шага 1 (аудит «дубли шаг 1-2», docs/BB-AUTO-STEPS-DEDUP-PLAN.md):
 * `targetBodyFat` / `cycleDay` / `recoveryMultOverride` применяются в
 * adapt-конвертации программы; faithful и дефолты — байт-в-байт.
 */
import { describe, expect, it } from 'vitest';
import { programToBBPlan } from '../cycle-to-plan';
import { FULL_PROGRAM_LIBRARY } from '../../complete-program-library.engine';
import type { BBPlan } from '../bb-builder.engine';

const WM = { chest: 100, back: 110, legs: 140, shoulders: 60, arms: 50, core: 60, traps: 60, hamstrings: 90, glutes: 160, calves: 120, forearms: 50 } as Record<string, number>;
const EQ = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];

function totalSets(plan: BBPlan): number {
  return plan.weeks
    .flatMap(w => w.sessions)
    .flatMap(s => s.exercises)
    .filter(e => !(e as any).warmupActivator)
    .reduce((sum, e) => sum + e.sets, 0);
}

function setsFingerprint(plan: BBPlan): string {
  return JSON.stringify(plan.weeks.map(w => w.sessions.map(s => s.exercises.map(e => e.sets))));
}

const prog = FULL_PROGRAM_LIBRARY.find(p => p.id === '531_bbb');

describe('program-путь: targetBodyFat / cycleDay / recoveryMultOverride', () => {
  if (!prog) { it.skip('531_bbb не найден', () => {}); }
  else {
    const base = () => programToBBPlan(prog, {
      workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
      equipment: EQ, mode: 'adapt', goal: 'cut', bodyFat: 20,
    } as any);

    it('без данных — байт-в-байт (новые поля = 1.0)', () => {
      const a = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, mode: 'adapt', goal: 'cut', bodyFat: 20,
        targetBodyFat: undefined, cycleDay: undefined, recoveryMultOverride: undefined,
      } as any);
      const b = base();
      expect(setsFingerprint(a)).toBe(setsFingerprint(b));
    });

    it('targetBodyFat далеко от цели → объём не больше + rationale про состав тела', () => {
      const far = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, mode: 'adapt', goal: 'cut', bodyFat: 25, targetBodyFat: 8,
      } as any);
      expect(totalSets(far)).toBeLessThanOrEqual(totalSets(base()));
      expect(far.rationale.join(' ')).toMatch(/Состав тела/);
    });

    it('женский цикл: лютеиновая фаза меняет объём у female, мужской — байт-в-байт', () => {
      const male = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, mode: 'adapt', goal: 'cut', bodyFat: 20, sex: 'male', cycleDay: 21,
      } as any);
      expect(setsFingerprint(male)).toBe(setsFingerprint(base()));

      const femaleNo = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, mode: 'adapt', goal: 'cut', bodyFat: 20, sex: 'female',
      } as any);
      const femaleLuteal = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, mode: 'adapt', goal: 'cut', bodyFat: 20, sex: 'female', cycleDay: 21,
      } as any);
      expect(totalSets(femaleLuteal)).toBeLessThanOrEqual(totalSets(femaleNo));
      expect(femaleLuteal.rationale.join(' ')).toMatch(/Женский цикл/);
    });

    it('recoveryMultOverride режет эффективный MRV и rationale честный', () => {
      const low = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, mode: 'adapt', goal: 'cut', bodyFat: 20, recoveryMultOverride: 0.7,
      } as any);
      const b = base();
      expect((low as any).mrvMultiplier).toBeLessThan((b as any).mrvMultiplier);
      expect(low.rationale.join(' ')).toMatch(/Ручной множитель восстановления/);
    });

    it('faithful — дословность: мягкие настройки не применяются', () => {
      const f1 = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, mode: 'faithful', goal: 'cut', bodyFat: 25, targetBodyFat: 8,
        cycleDay: 21, sex: 'female', recoveryMultOverride: 0.7,
      } as any);
      const f2 = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, mode: 'faithful',
      } as any);
      expect(setsFingerprint(f1)).toBe(setsFingerprint(f2));
      expect(totalSets(f1)).toBe(totalSets(f2));
    });
  }
});
