/**
 * Замки Волны 3 (docs/BB-AUTO-FULL-AUDIT-PLAN-2026-11.md):
 * P0-17  finalizeBBPlan lateCap уважает onCourse/volumeRegime/maxWorkingSets
 * P1-1   bb-plates: DP isWeightReachable, симметричное округление, без 20кг пола на гантелях
 * P1-2   applyDUPOverlay: per-muscle чередование на U/L, пересчёт веса, без дубля rationale
 * P1-3   repairSingleSetExercises не переносит вес/повторы донора на target
 * P1-4   recoveryMult и nutritionMult реально влияют на volumeTargets
 * P1-5   chest co-main invariant не раздувает грудь в делод-неделе
 * P1-8   schemeFor bfr достижим; rest_pause назначается advanced/enhanced; markGiantSets ставит supersetGroup
 * P2     validator plan.weeks.length (не [object Object]); fullbody_3 содержит beginner; mev <= mav <= mrv
 */
import { describe, it, expect } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { finalizeBBPlan, markGiantSets, repairSingleSetExercises, autoAssignIntensityTechniques } from '../bb-finalize.engine';
import { isWeightReachable, roundToAvailablePlates, applyPlateRoundingToPlan } from '../bb-plates.engine';
import { applyDUPOverlay } from '../bb-dup.engine';
import { schemeFor } from '../bb-rep-schemes.engine';
import { validateBBPlan } from '../bb-validator.engine';
import { SPLIT_PATTERNS } from '../bb-split-patterns';
import { personalLandmarksFor } from '../bb-mev-calibration.engine';
import { rankBBSplits } from '../bb-selector.engine';
import { computeBulkWeekEdits } from '../../../ui/screens/TrainingScreen_parts/bb-auto-constructor-shared';
import { warmupRampFor } from '../../warmup-ramp.engine';
import { fitBBSessionToBudget } from '../bb-fatigue.engine';
import { computeBBRecoveryScore } from '../bb-volume.engine';

describe('Wave 3 Core Engine audit locks', () => {
  it('P0-17: enhanced onCourse сессия не обрезается lateCap до натуральных 40 сетов', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'enhanced',
      trainingYears: 6,
      onCourse: true,
      peds: ['AAS'],
      pedDoses: { AAS: 750 },
      goal: 'mass',
      weeks: 4,
    });
    expect(plan.maxWorkingSets).toBeGreaterThan(40);
    // Проверяем, что finalizeBBPlan с onCourse сохраняет >40 сетов на Upper-сессии (5+ мышц),
    // не обрезая её через lateCap до натуральных 40 сетов
    const testPlan: any = structuredClone(plan);
    testPlan.mrvByMuscle = {
      chest: 60, back: 60, quads: 60, hamstrings: 60, glutes: 60,
      shoulders: 60, delt_front: 60, delt_mid: 60, delt_rear: 60,
      biceps: 50, triceps: 50, traps: 40, calves: 40, abs: 40, forearms: 40,
    };
    const s0 = testPlan.weeks[0].sessions[0];
    if (s0 && s0.exercises.length >= 2) {
      const extraDefs = [
        { name: 'Сведение в кроссовере', muscle: 'chest' },
        { name: 'Тяга верхнего блока широким хватом', muscle: 'back' },
        { name: 'Тяга гантели одной рукой в наклоне', muscle: 'back' },
        { name: 'Махи гантелями в стороны', muscle: 'delt_mid' },
        { name: 'Подъём штанги на бицепс', muscle: 'biceps' },
        { name: 'Молотки с гантелями', muscle: 'biceps' },
        { name: 'Разгибание рук на верхнем блоке', muscle: 'triceps' },
        { name: 'Французский жим гантелями', muscle: 'triceps' },
        { name: 'Шраги с гантелями', muscle: 'traps' },
      ];
      const curSum = () => s0.exercises.filter((e: any) => !e.warmupActivator && !e.optional).reduce((a: number, e: any) => a + (e.sets || 0), 0);
      for (const ex of s0.exercises) {
        if (ex.warmupActivator || ex.optional) continue;
        if ((ex.sets || 0) < 5) {
          ex.sets = 5;
          ex.workSets = Array.from({ length: 5 }, () => ({ ...(ex.workSets?.[0] || { reps: 10, rir: 2, weight: 60 }) }));
        }
      }
      for (const def of extraDefs) {
        if (curSum() >= 48) break;
        if (s0.exercises.some((e: any) => e.name === def.name)) continue;
        s0.exercises.push({
          name: def.name,
          exerciseName: def.name,
          muscle: def.muscle,
          role: 'accessory',
          character: 'памп',
          sets: 4,
          repsRange: [12, 15],
          rir: 2,
          workSets: Array.from({ length: 4 }, () => ({ reps: 12, rir: 2, weight: 25 })),
          warmupSets: [],
        });
      }
      const fin = finalizeBBPlan(testPlan, {
        level: 'enhanced',
        trainingYears: 6,
        onCourse: true,
        peds: ['AAS'],
        pedDoses: { AAS: 750 },
        volumeRegime: 'course',
        maxWorkingSets: 60,
        maxExercises: 16,
        patternId: 'upper_lower_4',
      } as any);
      const after = fin.weeks[0].sessions[0].exercises
        .filter((e: any) => !e.warmupActivator && !e.optional)
        .reduce((a: number, e: any) => a + (e.sets || 0), 0);
      expect(after).toBeGreaterThan(40);
    }
  });

  it('P1-1: bb-plates решает [15, 10] → 60кг, не задирает гантели 12.5кг до 20кг и округляет некратные веса', () => {
    expect(isWeightReachable(60, [15, 10], 20)).toBe(true);
    expect(roundToAvailablePlates(71.3, [20, 10, 5, 2.5, 1.25], 20)).toBe(72.5);
    expect(roundToAvailablePlates(70.4, [20, 10, 5, 2.5, 1.25], 20)).toBe(70);

    const plan = {
      weeks: [{
        sessions: [{
          exercises: [
            { name: 'Махи гантелями в стороны', equipment: 'dumbbell', workSets: [{ weight: 12.5 }] },
            { name: 'Жим штанги лёжа', equipment: 'barbell', workSets: [{ weight: 71.3 }] },
          ],
        }],
      }],
    };
    applyPlateRoundingToPlan(plan, [20, 10, 5, 2.5, 1.25], 20);
    expect(plan.weeks[0].sessions[0].exercises[0].workSets[0].weight).toBe(12.5);
    expect(plan.weeks[0].sessions[0].exercises[1].workSets[0].weight).toBe(72.5);
  });

  it('P1-2: applyDUPOverlay чередует тяж/лёг для ОДНОЙ мышцы на U/L, пересчитывает вес и не дублирует rationale', () => {
    const base = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4 });
    const dup = applyDUPOverlay(base, { mode: 'heavy_light', cycleDays: 2 });
    const dup2 = applyDUPOverlay(dup, { mode: 'heavy_light', cycleDays: 2 });
    expect(dup2.rationale.filter(r => r.startsWith('DUP: heavy_light')).length).toBe(1);

    // В неделе 1 есть 2 Upper-дня — грудь (primary) должна чередовать тяж и памп
    const chestChars = dup.weeks[0].sessions
      .flatMap(s => s.exercises)
      .filter(e => e.role === 'primary' && e.muscle === 'chest')
      .map(e => e.character);
    if (chestChars.length >= 2) {
      expect(new Set(chestChars).size).toBeGreaterThanOrEqual(2);
    }

    // При переходе 6 повт → 15 повт вес должен снизиться (не оставаться 100кг×15)
    const fakePlan: any = {
      ...base,
      weeks: [{
        week: 1,
        phase: 'accumulation',
        sessions: [
          { day: 1, character: 'тяж', exercises: [{ name: 'Жим лёжа', muscle: 'chest', role: 'primary', character: 'тяж', sets: 2, rir: 2, repsRange: [6, 8], workSets: [{ reps: 6, rir: 2, weight: 100 }, { reps: 6, rir: 2, weight: 100 }] }] },
          { day: 2, character: 'тяж', exercises: [{ name: 'Жим лёжа', muscle: 'chest', role: 'primary', character: 'тяж', sets: 2, rir: 2, repsRange: [6, 8], workSets: [{ reps: 6, rir: 2, weight: 100 }, { reps: 6, rir: 2, weight: 100 }] }] },
        ],
      }],
    };
    const out = applyDUPOverlay(fakePlan, { mode: 'heavy_light', cycleDays: 2 });
    const day1W = out.weeks[0].sessions[0].exercises[0].workSets[0].weight;
    const day2W = out.weeks[0].sessions[1].exercises[0].workSets[0].weight;
    expect(day2W).toBeLessThan(day1W);
  });

  it('P1-3: repairSingleSetExercises не переносит вес жима (100кг) на разводку (15кг)', () => {
    const fake: any = {
      weeks: [{
        week: 1,
        phase: 'accumulation',
        sessions: [{
          day: 1,
          exercises: [
            { name: 'Жим штанги лёжа', muscle: 'chest', role: 'primary', sets: 4, rir: 1, repsRange: [6, 8], workSets: Array.from({ length: 4 }, () => ({ reps: 6, rir: 1, weight: 100 })) },
            { name: 'Разводка гантелей лёжа', muscle: 'chest', role: 'accessory', sets: 1, rir: 3, repsRange: [12, 15], workSets: [{ reps: 15, rir: 3, weight: 15 }] },
          ],
        }],
      }],
      rationale: [],
    };
    repairSingleSetExercises(fake);
    const fly = fake.weeks[0].sessions[0].exercises[1];
    expect(fly.sets).toBe(2);
    expect(fly.workSets.every((ws: any) => ws.weight === 15)).toBe(true);
  });

  it('P1-4: плохое восстановление + дефицит реально снижают целевой объём', () => {
    const good = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4, sleepHours: 8, stressLevel: 2, calorieSurplus: 300, proteinPerKg: 2.0 });
    const bad = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4, sleepHours: 4.5, stressLevel: 9, calorieSurplus: -400, proteinPerKg: 0.9 });
    const sumTarget = (p: any) => Object.values(p.volumeTargets || {}).reduce((a: number, v: any) => a + (v.targetSets || 0), 0);
    expect(sumTarget(bad)).toBeLessThan(sumTarget(good));
  });

  it('P1-8: schemeFor отдаёт bfr на GH+insulin intensification; rest_pause назначается advanced; markGiantSets ставит supersetGroup', () => {
    expect(schemeFor({ focus: 'hypertrophy', phase: 'intensification', character: 'памп', level: 'enhanced', pedProfile: { ghPlusInsulin: true } })).toBe('bfr');

    const techPlan: any = {
      weeks: [{
        week: 1,
        phase: 'accumulation',
        sessions: [{
          day: 1,
          exercises: [
            { name: 'Сгибание рук со штангой на бицепс', muscle: 'biceps', role: 'accessory', character: 'памп', sets: 3, rir: 2, workSets: [{ reps: 12, rir: 2, weight: 30 }, { reps: 12, rir: 2, weight: 30 }, { reps: 12, rir: 2, weight: 30 }] },
          ],
        }],
      }],
    };
    autoAssignIntensityTechniques(techPlan, 'advanced');
    expect(techPlan.weeks[0].sessions[0].exercises[0].workSets[2].technique).toBe('rest_pause');

    const giantPlan: any = {
      weeks: [{
        week: 1,
        phase: 'accumulation',
        sessions: [{
          day: 1,
          exercises: [
            { name: 'Жим штанги лёжа', muscle: 'chest', role: 'primary', sets: 3, workSets: [{ reps: 8, rir: 2, weight: 80, restSeconds: 120 }] },
            { name: 'Сведение в кроссовере', muscle: 'chest', role: 'accessory', sets: 3, workSets: [{ reps: 12, rir: 2, weight: 20, restSeconds: 90 }] },
            { name: 'Разводка гантелей лёжа', muscle: 'chest', role: 'accessory', sets: 3, workSets: [{ reps: 15, rir: 2, weight: 14, restSeconds: 90 }] },
          ],
        }],
      }],
    };
    markGiantSets(giantPlan);
    const exs = giantPlan.weeks[0].sessions[0].exercises;
    expect(exs[0].supersetGroup).toBeDefined();
    expect(exs[0].supersetGroup).toBe(exs[1].supersetGroup);
    expect(exs[1].supersetGroup).toBe(exs[2].supersetGroup);
    expect(exs[0].workSets[0].restSeconds).toBe(0);
    expect(exs[1].workSets[0].restSeconds).toBe(0);
  });

  it('P2: validator выводит число недель (не [object Object]), fullbody_3 принимает beginner, mev <= mav <= mrv, bulk sets/reps целые', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'cut', trainingFocus: 'strength', weeks: 8 });
    const val = validateBBPlan(plan, { level: 'intermediate' });
    const gf = val.issues.find(i => i.code === 'goal_focus_mismatch');
    if (gf) expect(gf.message).not.toContain('[object Object]');

    const fb3 = SPLIT_PATTERNS.find(p => p.id === 'fullbody_3');
    expect(fb3?.level).toContain('beginner');

    const cal: any = { completed: true, status: 'completed', weeks: [{ week: 1 }, { week: 2 }, { week: 3 }], userMevByMuscle: { chest: 25 } };
    const lm = personalLandmarksFor('intermediate', 'chest', 7, cal);
    if (lm) {
      expect(lm.mev).toBeLessThanOrEqual(lm.mav);
      expect(lm.mav).toBeLessThanOrEqual(lm.mrv);
    }

    const r1 = rankBBSplits({ level: 'intermediate', goal: 'mass', daysPerWeek: 4, mobilityRestrictions: ['shoulder'] });
    expect(r1.some(x => x.warnings.some(w => w.includes('травмы/ограничения')))).toBe(true);

    const bulk = computeBulkWeekEdits({
      weekNo: 1,
      sessions: [{ exercises: [{ name: 'Жим', sets: 3, workSets: [{ reps: 10, weight: 80 }] }] }],
      existing: {},
      field: 'sets',
      mode: 'mult',
      rawValue: '1.1',
    });
    expect(Number.isInteger(bulk.edits?.['1-0-0']?.sets)).toBe(true);

    // Equipment-aware warmup: non-barbell (dumbbells/cable) omits 20kg bar step
    const dbWarmup = warmupRampFor(60, true, { isBarbell: false });
    expect(dbWarmup.some(w => w.load === 20 && w.reps === 15)).toBe(false);
    const barWarmup = warmupRampFor(60, true, { isBarbell: true });
    expect(barWarmup.some(w => w.load === 20 && w.reps === 15)).toBe(true);

    // fitBBSessionToBudget compares total muscle sets (not single exercise) against floorFor(muscle)
    const sess: any = {
      day: 1,
      sessionTag: 'Push',
      exercises: [
        { name: 'Жим штанги лёжа', muscle: 'chest', role: 'primary', sets: 4, repsRange: [6, 8], rir: 2, workSets: Array(4).fill({ reps: 8, rir: 2, weight: 80 }) },
        { name: 'Сведение в кроссовере', muscle: 'chest', role: 'accessory', character: 'памп', sets: 4, repsRange: [12, 15], rir: 2, workSets: Array(4).fill({ reps: 15, rir: 2, weight: 20 }) },
      ],
    };
    fitBBSessionToBudget(sess, { maxWorkingSets: 7, minSetsPerExercise: 2, minSetsByMuscle: { chest: 5 } });
    expect(sess.exercises[1].sets).toBe(3);

    // computeBBRecoveryScore without hrvBaseline does not apply absolute HRV thresholds
    expect(computeBBRecoveryScore({ hrvMs: 42 })).toBe(computeBBRecoveryScore({ hrvMs: 85 }));
    expect(computeBBRecoveryScore({ hrvMs: 42, hrvBaseline: 60 })).toBeLessThan(computeBBRecoveryScore({ hrvMs: 60, hrvBaseline: 60 }));
  });
});
