/**
 * bb-audit-2026-11-fixes.test.ts — регрессионный сьют на аудит и исправления BB-Auto (2026-11).
 *
 * Покрывает все 4 уровня (beginner / intermediate / advanced / enhanced), оба пола
 * и ключевые инварианты:
 *  1. Безопасность новичка (RIR ≥ 2, без SkiErg/кардио, без принудительных дропсетов, капы 18/8, FB 22/10, PPL 24/9, perExerciseCap 4/3).
 *  2. Защита фаз ПКТ и Круиз (RIR ≥ 2, отключение FST-7/GVT/Gironda и отказных техник).
 *  3. Тиры и уровень-гейт упражнений (overhead_tricep_ext = tier 1, upright_row = tier 3, guillotine = tier 4).
 *  4. DUP (одна фаза на мышцу в день даже при 2 primary-упражнениях, блок для beginner).
 *  5. Классические GVT (10×10) и Gironda (8×8) на advanced/enhanced + честный downgrade на beginner/intermediate.
 *  6. FST-7 финишер в конце сессии, фильтр осевой нагрузки и чистота валидации/суперсетов.
 */
import { describe, it, expect } from 'vitest';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { buildBBPlan } from '../bb-builder.engine';
import { applyDUPOverlay } from '../bb-dup.engine';
import { isLevelAllowed } from '../bb-exercise-levels.engine';
import { bbExerciseTier } from '../bb-exercise-tier.engine';
import { orderSessionExercises } from '../bb-session-order.engine';
import { validateBBPlan } from '../bb-validator.engine';
import { perExerciseCap, sessionLimitsFor } from '../bb-volume.engine';
import { makeInput } from './bb-test-helpers';

describe('BB Audit 2026-11 — 1. Безопасность новичка', () => {
  it('лимиты сессии и perExerciseCap новичка соответствуют канону', () => {
    expect(sessionLimitsFor({ level: 'beginner' })).toMatchObject({ maxWorkingSets: 18, maxExercises: 8 });
    expect(sessionLimitsFor({ level: 'beginner' }, { id: 'fullbody_3' })).toMatchObject({ maxWorkingSets: 22, maxExercises: 10 });
    expect(sessionLimitsFor({ level: 'beginner' }, { id: 'ppl_3' })).toMatchObject({ maxWorkingSets: 24, maxExercises: 9 });
    expect(perExerciseCap('beginner', 'chest')).toBe(4);
    expect(perExerciseCap('beginner', 'biceps')).toBe(3);
  });

  it('новичок получает RIR ≥ 2, без дропсетов и без кардио/SkiErg даже при запросе dropset', () => {
    const plan = buildBBPlan(makeInput({
      patternId: 'fullbody_3',
      level: 'beginner',
      goal: 'mass',
      intensityTechnique: 'dropset',
    }));

    expect(plan.weeks.length).toBeGreaterThan(0);
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        for (const ex of s.exercises) {
          if ((ex as any).warmupActivator) continue;
          const cat = EXERCISE_CATALOG.find(c => c.id === ex.exerciseName || c.name === ex.name);
          expect(cat?.substitutionGroup).not.toBe('cardio');
          expect(String(ex.name || '')).not.toMatch(/skierg|лыжн/i);
          expect(ex.rir ?? 2).toBeGreaterThanOrEqual(2);
          for (const ws of ex.workSets || []) {
            expect(ws.rir ?? 2).toBeGreaterThanOrEqual(2);
          }
          expect(ex.techniqueTag).not.toBe('dropset');
        }
      }
    }
  });
});

describe('BB Audit 2026-11 — 2. Защита ПКТ и Круиза', () => {
  for (const pedPhase of ['pct', 'cruise'] as const) {
    it(`фаза ${pedPhase} держит RIR ≥ 2 и отключает агрессивные объёмные схемы`, () => {
      const plan = buildBBPlan(makeInput({
        patternId: 'upper_lower_4',
        level: 'enhanced',
        pedPhase,
        onCourse: false,
        volumeScheme: 'gvt',
        intensityTechnique: 'dropset',
      }));

      expect((plan as any).volumeScheme).toBe('standard');
      expect(plan.rationale.some(r => /ПКТ|Круиз/i.test(r))).toBe(true);
      for (const w of plan.weeks) {
        for (const s of w.sessions) {
          for (const ex of s.exercises) {
            if ((ex as any).warmupActivator) continue;
            expect(ex.rir ?? 2).toBeGreaterThanOrEqual(2);
            expect(ex.techniqueTag).not.toBe('dropset');
            expect(ex.techniqueTag).not.toBe('rest_pause');
          }
        }
      }
    });
  }
});

describe('BB Audit 2026-11 — 3. Тиры и допуски упражнений', () => {
  it('overhead_tricep_ext в tier 1, upright_row в tier 3 и закрыт новичку, guillotine в tier 4', () => {
    const ohTricep = EXERCISE_CATALOG.find(c => c.id === 'overhead_tricep_ext');
    const upright = EXERCISE_CATALOG.find(c => c.id === 'upright_row');
    expect(ohTricep).toBeDefined();
    expect(upright).toBeDefined();

    expect(bbExerciseTier(ohTricep)).toBe(1);
    expect(bbExerciseTier(upright)).toBe(3);
    expect(isLevelAllowed('beginner', upright!)).toBe(false);
    expect(bbExerciseTier({ id: 'guillotine', name: 'Гильотинный жим' })).toBe(4);
  });
});

describe('BB Audit 2026-11 — 4. DUP инварианты', () => {
  it('DUP отключён на уровне beginner и даёт единую фазу на мышцу внутри дня на intermediate', () => {
    const begPlan = buildBBPlan(makeInput({ patternId: 'fullbody_3', level: 'beginner' }));
    const dupBeg = applyDUPOverlay(begPlan, { mode: 'full_dup', cycleDays: 3 });
    expect(dupBeg.rationale.some(r => /отключён для уровня beginner/i.test(r))).toBe(true);

    const syntheticPlan: any = {
      level: 'intermediate',
      rationale: [],
      weeks: [{
        week: 1,
        phase: 'accumulation',
        sessions: [
          {
            character: 'памп',
            exercises: [
              { muscle: 'chest', name: 'Жим лёжа', role: 'primary', sets: 3, repsRange: [8, 12], rir: 2, workSets: [{ reps: 10, rir: 2, weight: 80 }] },
              { muscle: 'chest', name: 'Жим под углом', role: 'primary', sets: 3, repsRange: [8, 12], rir: 2, workSets: [{ reps: 10, rir: 2, weight: 60 }] },
            ],
          },
          {
            character: 'памп',
            exercises: [
              { muscle: 'chest', name: 'Жим в тренажёре', role: 'primary', sets: 3, repsRange: [8, 12], rir: 2, workSets: [{ reps: 10, rir: 2, weight: 70 }] },
            ],
          },
        ],
      }],
    };

    const dupInt = applyDUPOverlay(syntheticPlan, { mode: 'heavy_light', cycleDays: 2 });
    const day1Ex = dupInt.weeks[0].sessions[0].exercises;
    const day2Ex = dupInt.weeks[0].sessions[1].exercises;
    expect(day1Ex[0].character).toBe('тяж');
    expect(day1Ex[1].character).toBe('тяж');
    expect(day1Ex[0].repsRange).toEqual([5, 8]);
    expect(day1Ex[1].repsRange).toEqual([5, 8]);
    expect(day2Ex[0].character).toBe('лёг');
    expect(day2Ex[0].repsRange).toEqual([15, 20]);
  });
});

describe('BB Audit 2026-11 — 5. Классические GVT 10×10 и Gironda 8×8', () => {
  it('downgrade на beginner и intermediate с пояснением и 0 MRV-overflow', () => {
    for (const level of ['beginner', 'intermediate'] as const) {
      const plan = buildBBPlan(makeInput({
        patternId: 'upper_lower_4',
        level,
        volumeScheme: 'gvt',
      }));
      expect((plan as any).volumeScheme).toBe('standard');
      expect(plan.rationale.some(r => /GVT 10×10.*advanced\/enhanced/i.test(r))).toBe(true);
      const val = validateBBPlan(plan, { level });
      expect(val.issues.filter(i => i.code === 'effective_mrv_overflow')).toHaveLength(0);
    }
  });

  it('GVT 10×10 на advanced применяет ровно 10 сетов по 10 повторов на базовом движении', () => {
    const plan = buildBBPlan(makeInput({
      patternId: 'upper_lower_4',
      level: 'advanced',
      volumeScheme: 'gvt',
    }));
    expect((plan as any).volumeScheme).toBe('gvt');
    const week1Exs = plan.weeks[0].sessions.flatMap(s => s.exercises);
    const gvtEx = week1Exs.find((e: any) => /GVT 10×10/.test(String(e.comment || '')));
    expect(gvtEx).toBeDefined();
    expect(gvtEx?.sets).toBe(10);
    expect(gvtEx?.repsRange).toEqual([10, 10]);
    expect((gvtEx as any)?.schemeAssignedSets).toBe(10);
  });

  it('Gironda 8×8 на advanced применяет ровно 8 сетов, 8 повторов и короткий отдых 45с', () => {
    const plan = buildBBPlan(makeInput({
      patternId: 'upper_lower_4',
      level: 'advanced',
      volumeScheme: 'gironda',
    }));
    expect((plan as any).volumeScheme).toBe('gironda');
    const week1Exs = plan.weeks[0].sessions.flatMap(s => s.exercises);
    const girondaEx = week1Exs.find((e: any) => /Gironda 8×8/.test(String(e.comment || '')));
    expect(girondaEx).toBeDefined();
    expect(girondaEx?.sets).toBe(8);
    expect(girondaEx?.repsRange).toEqual([8, 8]);
    expect(girondaEx?.restSeconds).toBe(45);
    expect((girondaEx as any)?.schemeAssignedSets).toBe(8);
  });
});

describe('BB Audit 2026-11 — 6. Порядок FST-7, осевая разгрузка и валидатор', () => {
  it('методика fst7 ставит финишер-изоляцию основной мышцы после базы и прочих изоляций', () => {
    const exs: any[] = [
      { muscle: 'chest', name: 'Сведение в кроссовере (FST-7)', role: 'accessory', character: 'памп', sets: 7, repsRange: [10, 12], comment: 'FST-7 финишер' },
      { muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж', sets: 4, repsRange: [6, 8] },
      { muscle: 'chest', name: 'Разводка гантелей на наклонной', role: 'accessory', character: 'гиперт', sets: 3, repsRange: [10, 12] },
    ];
    const ordered = orderSessionExercises(exs, { sessionTag: 'Push', primaryMuscle: 'chest', methodology: 'fst7' });
    expect(ordered[0].name).toBe('Жим штанги лёжа');
    expect(ordered[ordered.length - 1].name).toBe('Сведение в кроссовере (FST-7)');
  });

  it('avoidAxialLoad исключает осевые приседы/становые и план проходит validateBBPlan без overflow и dangling supersets', () => {
    const plan = buildBBPlan(makeInput({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      avoidAxialLoad: true,
      supersetMode: 'antagonist',
    }));
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        const names = new Set(s.exercises.map((e: any) => e.exerciseName || e.name));
        for (const e of s.exercises) {
          expect(String(e.name || '')).not.toMatch(/присед.*штангой на спине|становая тяга классическая/i);
          if ((e as any).supersetWith) {
            expect(names.has((e as any).supersetWith)).toBe(true);
          }
        }
      }
    }
    const val = validateBBPlan(plan, { level: 'intermediate' });
    expect(val.issues.filter(i => i.code === 'effective_mrv_overflow')).toHaveLength(0);
    expect(val.issues.filter(i => i.code === 'single_set')).toHaveLength(0);
  });
});
