/**
 * combat-pro3-wave2.test.ts — локи волны В2 (P0-5…P0-8) плана
 * docs/COMBAT-PLANNER-PRO-3-PLAN.md. Мутационные: возврат старого поведения падает.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import { combatPlanToUserProgram } from '../combat-integration.engine';
import { isUserProgramShape, saveUserProgram, loadUserPrograms, validateProgram } from '../../user-program/program-store';
import { applyCombatMesocycle, combatMesocycleHash, shouldApplyCombatMesocycle } from '../combat-mesocycle';
import { adaptForPEDsCombat } from '../combat-ped-adaptation';
import { flattenDiaryLogsCB, loadDiaryLogsCB, combatLastResultIndex, buildDiaryTrendCB } from '../combat-diary.engine';

function base(extra: Record<string, unknown> = {}) {
  return {
    discipline: 'mma', goal: 'power', level: 'intermediate',
    weeks: 6, daysPerWeek: 3, bodyweight: 80, age: 28,
    ...extra,
  } as any;
}

describe('В2 · P0-5 — экспорт в библиотеку (настоящий UserProgram)', () => {
  it('combatPlanToUserProgram проходит isUserProgramShape и сохраняется', () => {
    const plan = buildCombatPlan(base());
    const prog = combatPlanToUserProgram(plan);
    expect(prog.meta.direction).toBe('combat');
    expect(Number.isInteger(prog.meta.daysPerWeek)).toBe(true);
    expect(Number.isInteger(prog.meta.weeks)).toBe(true);
    expect(isUserProgramShape(prog)).toBe(true);
    const all = saveUserProgram(prog);
    expect(all.some((p: any) => p.meta.id === plan.id)).toBe(true);
    expect(loadUserPrograms().some((p: any) => p.meta.id === plan.id)).toBe(true);
  });

  it('validateProgram не даёт ошибок для экспортированного combat-плана', () => {
    const plan = buildCombatPlan(base());
    const prog = combatPlanToUserProgram(plan);
    const issues = validateProgram(prog as any);
    expect(issues.filter(i => i.level === 'error')).toEqual([]);
  });

  it('недели/сессии/блоки перенесены с уникальными id и сетами', () => {
    const plan = buildCombatPlan(base());
    const prog = combatPlanToUserProgram(plan);
    const weeks = prog.combat.weeks;
    expect(weeks.length).toBe(plan.weeksData.length);
    const firstSess = weeks[0].sessions[0];
    expect(firstSess.blocks.length).toBeGreaterThan(0);
    expect(firstSess.blocks[0].sets.length).toBeGreaterThan(0);
    const ids = weeks.flatMap((w: any) => w.sessions.map((s: any) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('В2 · P0-6 — защита от храповика мезоцикла', () => {
  it('shouldApplyCombatMesocycle: нет prev / другая дисциплина / тот же хэш — false', () => {
    const plan = buildCombatPlan(base());
    const input = base();
    expect(shouldApplyCombatMesocycle(null, input, null)).toBe(false);
    expect(shouldApplyCombatMesocycle({ ...plan, discipline: 'boxing' } as any, input, null)).toBe(false);
    const hash = combatMesocycleHash(input);
    expect(shouldApplyCombatMesocycle(plan, input, hash)).toBe(false);
    expect(shouldApplyCombatMesocycle(plan, input, null)).toBe(true);
  });

  it('хэш детерминирован и чувствителен к входам', () => {
    expect(combatMesocycleHash(base())).toBe(combatMesocycleHash(base()));
    expect(combatMesocycleHash(base({ weeks: 6 }))).not.toBe(combatMesocycleHash(base({ weeks: 8 })));
    expect(combatMesocycleHash(base({ workMax: { chest: 100 } }))).not.toBe(combatMesocycleHash(base()));
  });

  it('повторный пересбор (тот же хэш) не бампает веса второй раз', () => {
    const input1 = base({ workMax: { chest: 100 } });
    const plan1 = buildCombatPlan(input1);
    const bumped = applyCombatMesocycle(plan1, base({ workMax: { chest: 100 } }));
    expect((bumped as any).workMax.chest).toBeGreaterThan(100);
    // второй клик: тот же хэш → shouldApply=false → веса не растут повторно
    const hash = combatMesocycleHash(base({ workMax: { chest: 100 } }));
    expect(shouldApplyCombatMesocycle(plan1, base({ workMax: { chest: 100 } }), hash)).toBe(false);
  });
});

describe('В2 · P0-7 — PED-адаптация получает id+дозы', () => {
  it('id[] + дозы дают mrvMult > 1 (объекты раньше давали natural ×1.0)', () => {
    const r = adaptForPEDsCombat(['test_enan', 'tren_acet'], { test_enan: 500, tren_acet: 300 } as any, 'moderate', 'mma', 'power');
    expect(r.mrvMult).toBeGreaterThan(1.05);
    expect(r.details).toContain('AAS');
  });

  it('пустой список — ровно 1.0 (не ломаем natural)', () => {
    expect(adaptForPEDsCombat([], undefined).mrvMult).toBe(1);
    expect(adaptForPEDsCombat(undefined, undefined).mrvMult).toBe(1);
  });
});

describe('В2 · P0-8 — живой ключ дневника he_workout_log_v2', () => {
  const daysAgo = (n: number) => {
    const d = new Date(Date.now() - n * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  beforeEach(() => localStorage.clear());

  it('flattenDiaryLogsCB: сессии WorkoutSession → плоские энтри с weight/holdSec', () => {
    const raw = [{
      date: '2026-09-01',
      exercises: [{
        exerciseId: 'squat', exerciseName: 'Присед',
        sets: [{ weightKg: 120, reps: 5, velocityMs: 0.5 }, { weight: 100, reps: 8 }],
      }],
    }];
    const flat = flattenDiaryLogsCB(raw);
    expect(flat.length).toBe(1);
    expect(flat[0].exerciseId).toBe('squat');
    expect(flat[0].sets[0].weight).toBe(120);
    expect(flat[0].sets[1].weight).toBe(100);
  });

  it('loadDiaryLogsCB предпочитает живой ключ легаси', () => {
    localStorage.setItem('he_workout_log', JSON.stringify([{ date: '2020-01-01', exerciseId: 'legacy', sets: [{ weight: 1, reps: 1 }] }]));
    localStorage.setItem('he_workout_log_v2', JSON.stringify([{
      date: '2026-09-20',
      exercises: [{ exerciseId: 'bench_bar', sets: [{ weightKg: 100, reps: 5 }] }],
    }]));
    const logs = loadDiaryLogsCB();
    expect(logs[0].exerciseId).toBe('bench_bar');
  });

  it('combatLastResultIndex видит weightKg из живого дневника', () => {
    const idx = combatLastResultIndex([{
      date: daysAgo(3),
      exerciseId: 'squat',
      sets: [{ weightKg: 140, reps: 5 }],
    }]);
    expect(idx['squat']).toBeDefined();
    expect(idx['squat'].e1rm).toBeGreaterThan(160);
  });

  it('buildDiaryTrendCB считает тренд по живым сессиям (weightKg)', () => {
    const logs = [
      { date: daysAgo(5), exerciseId: 'squat', sets: [{ weightKg: 150, reps: 5 }] },
      { date: daysAgo(40), exerciseId: 'squat', sets: [{ weightKg: 130, reps: 5 }] },
    ];
    const trend = buildDiaryTrendCB(logs);
    const legs = trend?.find(t => t.group === 'legs');
    expect(legs).toBeDefined();
    expect(legs!.changePct).toBeGreaterThan(0);
  });
});
