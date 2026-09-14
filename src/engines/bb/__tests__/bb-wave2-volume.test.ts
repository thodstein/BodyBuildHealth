/**
 * bb-wave2-volume.test.ts — Волна-2 (аудит 2026-09): единая fractional-метрика
 * (Pelland/Remmert), PUOS-предупреждение, симметрия валидатора, единый допуск
 * BB_MRV_TOLERANCE в cap-adjust финализатора.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  canonicalEffectiveSets,
  aggregateFractionalVolume,
  PUOS_SESSION_FRACTIONAL,
  INDIRECT_FRACTION,
  sessionMrvRotCap,
  computeBBWeeklyBudget,
} from '../bb-volume.engine';
import { validateBBPlan, BB_MRV_TOLERANCE } from '../bb-validator.engine';
import { normalizeWeekMrv, buildBBPlan } from '../bb-builder.engine';
import { pctForRir, PCT_FOR_RIR } from '../../rir-table';
import { resolveDeloadProtocol, DELOAD_PROTOCOLS, rirDrift } from '../bb-autocoach.engine';
import { computeBudgetBBFallback } from '../bb-diagnostics-injection.engine';

const ex = (over: Record<string, any>) => ({
  muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж',
  sets: 4, repsRange: [6, 8], rir: 2,
  workSets: Array.from({ length: over.sets ?? 4 }, () => ({ reps: 8, rir: 2, weight: 100 })),
  ...over,
});

describe('Волна-2.5 — канонический fractional-счёт (direct 1.0 / indirect 0.5)', () => {
  it('compound: indirect = пары × сеты × 0.5', () => {
    const r = canonicalEffectiveSets(ex({}));
    expect(INDIRECT_FRACTION).toBe(0.5);
    expect(r.direct).toBe(4);
    expect(r.indirect).toBe(4); // 2 пары (triceps/shoulders) × 4 × 0.5
    expect(r.effective).toBe(8);
  });

  it('изоляция: indirect = 0', () => {
    const r = canonicalEffectiveSets(ex({ name: 'Махи гантелями в стороны', muscle: 'shoulders', type: 'isolation', sets: 3, workSets: Array.from({ length: 3 }, () => ({ reps: 15, rir: 2, weight: 12 })) }));
    expect(r).toEqual({ direct: 3, indirect: 0, effective: 3 });
  });

  it('warmup-активатор вне счёта', () => {
    expect(canonicalEffectiveSets(ex({ warmupActivator: true }))).toEqual({ direct: 0, indirect: 0, effective: 0 });
  });

  it('aggregateFractionalVolume: мышца = direct + 0.5×indirect, тяж/памп-сумма за сессию', () => {
    const session = {
      exercises: [
        ex({}), // chest 4 direct
        ex({ name: 'Махи гантелями в стороны', muscle: 'shoulders', type: 'isolation', sets: 3, workSets: Array.from({ length: 3 }, () => ({ reps: 15, rir: 2, weight: 12 })) }),
      ],
    };
    const vol = aggregateFractionalVolume([session]);
    expect(vol.chest).toBe(4);
    // Махи гантелями → direct считается по головке (delt_mid 3); канонический
    // shoulders получает только косвенный вклад от жима (0.5×4).
    expect(vol.delt_mid).toBe(3);
    expect(vol.shoulders).toBe(2);
    expect(vol.triceps).toBe(2); // 0.5×4 от жима
  });
});

describe('Волна-2.8 — PUOS-предупреждение (11 fractional/сессию)', () => {
  const plan = (setsPerExercise: number) => ({
    pattern: { id: 'upper_lower_4' }, rationale: [], rotationMuscleVolume: {}, mrvByMuscle: {},
    weeks: [{
      week: 1, phase: 'accumulation',
      sessions: [{ day: 1, sessionTag: 'Chest', exercises: [ex({ sets: setsPerExercise, workSets: Array.from({ length: setsPerExercise }, () => ({ reps: 8, rir: 2, weight: 100 })) })] }],
    }],
  });

  it('12 fractional сетов на грудь за сессию → warning session_volume_puos', () => {
    const v = validateBBPlan(plan(12) as any, { level: 'intermediate' });
    const issue = v.issues.find(i => i.code === 'session_volume_puos');
    expect(issue).toBeDefined();
    expect(issue!.level).toBe('warning');
    expect(PUOS_SESSION_FRACTIONAL).toBe(11);
  });

  it('11 fractional сетов → тихо', () => {
    const v = validateBBPlan(plan(11) as any, { level: 'intermediate' });
    expect(v.issues.some(i => i.code === 'session_volume_puos')).toBe(false);
  });
});

describe('Волна-2.9 — симметрия валидатора: set-cap error для новичка', () => {
  const heavyPlan = {
    pattern: { id: 'upper_lower_4' }, rationale: [], rotationMuscleVolume: {}, mrvByMuscle: {},
    weeks: [{
      week: 1, phase: 'accumulation',
      sessions: [{ day: 1, sessionTag: 'Chest', exercises: [ex({ sets: 13, workSets: Array.from({ length: 13 }, () => ({ reps: 8, rir: 2, weight: 100 })) }), ex({ name: 'Разводка гантелей лёжа', muscle: 'chest', type: 'isolation', sets: 13, workSets: Array.from({ length: 13 }, () => ({ reps: 12, rir: 2, weight: 20 })) })] }],
    }],
  };

  it('beginner: превышение капа сессии → error', () => {
    const v = validateBBPlan(heavyPlan as any, { level: 'beginner' });
    const issue = v.issues.find(i => i.code === 'session_working_set_cap');
    expect(issue?.level).toBe('error');
    expect(v.valid).toBe(false);
  });

  it('intermediate: тот же перебор → warning (не роняет valid)', () => {
    const v = validateBBPlan(heavyPlan as any, { level: 'intermediate' });
    const issue = v.issues.find(i => i.code === 'session_working_set_cap');
    expect(issue?.level).toBe('warning');
  });
});

describe('Волна-2.6 — единый допуск BB_MRV_TOLERANCE', () => {
  it('канон 1.15 и cap-adjust финализатора использует его (без 1.05)', () => {
    expect(BB_MRV_TOLERANCE).toBe(1.15);
    const src = readFileSync(resolve(process.cwd(), 'src/engines/bb/bb-finalize.engine.ts'), 'utf8');
    expect(src).not.toContain('cap * 1.05');
    expect(src).toContain('cap * BB_MRV_TOLERANCE');
  });
});

describe('Волна-2.7 — per-muscle сессионный MRV-потолок', () => {
  it('малая мышца не берёт 12: формула ниже флора 12', () => {
    // бицепс: MRV 22, 2 сессии → формула 13 (≥12) — потолок капа не меняется
    expect(sessionMrvRotCap({ perSessionMuscleCap: 12, challengeMrv: 22, frequency: 2 })).toBe(12);
    // задняя дельта: MRV 18, 2 сессии → 11 (<12) — потолок снижается
    expect(sessionMrvRotCap({ perSessionMuscleCap: 12, challengeMrv: 18, frequency: 2 })).toBe(11);
    // трапы: MRV 12, 2 сессии → 7
    expect(sessionMrvRotCap({ perSessionMuscleCap: 12, challengeMrv: 12, frequency: 2 })).toBe(7);
    // крупная мышца: формула ≥12 → perSessionMuscleCap (не ломаем packing/MEV-фидеры)
    expect(sessionMrvRotCap({ perSessionMuscleCap: 22, challengeMrv: 32, frequency: 2 })).toBe(22);
    // без MRV — потолок капа
    expect(sessionMrvRotCap({ perSessionMuscleCap: 15 })).toBe(15);
  });

  it('normalizeWeekMrv: срезы/остаток симметричны по сессиям (было 9/6, стало ≤1)', () => {
    const mkEx = (sets: number) => ({
      muscle: 'back', name: 'Тяга верхнего блока (прямой)', role: 'accessory' as const, character: 'памп' as const,
      sets, repsRange: [10, 12] as [number, number], rir: 3,
      workSets: Array.from({ length: sets }, () => ({ reps: 10, rir: 3, weight: 50 })),
    });
    const session = () => ({ day: 1, sessionTag: 'Upper', exercises: [mkEx(4), mkEx(4), mkEx(4)] });
    // 2 сессии × 12 сетов = 24; кап 15 → пропорция + остаток
    const sessions = [session() as any, session() as any];
    normalizeWeekMrv(sessions, { back: 15 }, false, { level: 'intermediate' });
    const sum = (s: any) => s.exercises.reduce((a: number, e: any) => a + e.sets, 0);
    expect(sum(sessions[0]) + sum(sessions[1])).toBeLessThanOrEqual(15);
    expect(Math.abs(sum(sessions[0]) - sum(sessions[1]))).toBeLessThanOrEqual(1);
    for (const s of sessions) for (const e of (s as any).exercises) expect(e.workSets.length).toBe(e.sets);
  });
});

describe('Волна-2.1 — единая формула RIR-дрейфа (rirDrift = floor(phaseWeek/2) как bbRir)', () => {
  it('шаг дрейфа совпадает с каноном bbRir на всей фазе', () => {
    for (const wk of [1, 2, 3, 4, 5]) {
      const drift = Math.floor(wk / 2);
      expect(rirDrift([3, 0], wk, 5)).toBe(Math.max(0, 3 - drift));
    }
    // фаза из 1 недели — дрейфа нет (как в bbRir)
    expect(rirDrift([3, 1], 1, 1)).toBe(3);
  });
});

describe('Волна-2.2 — единая формула % от RIR (pctForRir = канон, таблица = алиас)', () => {
  it('PCT_FOR_RIR производный: значения 0..5 без расхождений', () => {
    for (const rir of [0, 1, 2, 3, 4, 5]) expect(PCT_FOR_RIR[rir]).toBe(pctForRir(rir));
    expect(PCT_FOR_RIR[0]).toBe(1.0);
    expect(PCT_FOR_RIR[5]).toBe(0.8);
  });

  it('монотонность и клампы', () => {
    for (let r = 1; r <= 5; r++) expect(pctForRir(r)).toBeLessThan(pctForRir(r - 1));
    expect(pctForRir(9)).toBe(0.8);
    expect(pctForRir(-3)).toBe(1.0);
  });
});

describe('Волна-2.3 — единый resolver BB-протокола делоада', () => {
  it('известные типы и алиасы; неизвестный/пустой → pump (без undefined)', () => {
    expect(resolveDeloadProtocol('neural')).toBe(DELOAD_PROTOCOLS.neural);
    expect(resolveDeloadProtocol('mini')).toBe(DELOAD_PROTOCOLS.mini);
    expect(resolveDeloadProtocol('full')).toBe(DELOAD_PROTOCOLS.full_rest);
    expect(resolveDeloadProtocol(undefined)).toBe(DELOAD_PROTOCOLS.pump);
    expect(resolveDeloadProtocol('нет-такого')).toBe(DELOAD_PROTOCOLS.pump);
  });

  it('инварианты протоколов: объём <1, RIR 3-5, отдых >0, reps-диапазон непуст', () => {
    for (const p of Object.values(DELOAD_PROTOCOLS)) {
      expect(p.volumeMultiplier).toBeLessThan(1);
      expect(p.rirTarget).toBeGreaterThanOrEqual(3);
      expect(p.rirTarget).toBeLessThanOrEqual(5);
      expect(p.restSeconds).toBeGreaterThan(0);
      expect(p.repRange[1]).toBeGreaterThanOrEqual(p.repRange[0]);
    }
  });
});

describe('Волна-2.11 — бюджет инъекции хаба = канон computeBBWeeklyBudget', () => {
  it('fallback совпадает с каноном (натурал/курс), а не хардкод-картой', () => {
    expect(computeBudgetBBFallback('beginner')).toBe(computeBBWeeklyBudget({ onCourse: false, recoveryScore: 100 }));
    expect(computeBudgetBBFallback('intermediate')).toBe(computeBBWeeklyBudget({ onCourse: false, recoveryScore: 100 }));
    expect(computeBudgetBBFallback('enhanced')).toBe(computeBBWeeklyBudget({ onCourse: true, recoveryScore: 100 }));
    expect(computeBudgetBBFallback('enhanced')).toBeGreaterThan(computeBudgetBBFallback('beginner'));
  });
});

describe('Волна-2.10 — cut не режет специализацию равномерно', () => {
  it('спец-цель при cut сохраняет больше объёма, чем не-спец база', () => {
    const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };
    const base = { patternId: 'upper_lower_4', level: 'intermediate', trainingYears: 3, weeks: 4, workMax: WM } as any;
    const cutPlain = buildBBPlan({ ...base, goal: 'cut' });
    const cutSpec = buildBBPlan({ ...base, goal: 'cut', weakPoints: ['chest'], focusGroup: 'chest', specialization: true });
    const massSpec = buildBBPlan({ ...base, goal: 'mass', weakPoints: ['chest'], focusGroup: 'chest', specialization: true });
    const chest = (p: any) => p.rotationMuscleVolume['chest'] || 0;
    expect(chest(cutSpec)).toBeGreaterThan(chest(cutPlain));
    // сохранение спец-цели: ratio cut/mass ≥ 0.8 (равномерный 0.72 дал бы ~0.69)
    expect(chest(cutSpec) / chest(massSpec)).toBeGreaterThan(0.8);
  });
});
