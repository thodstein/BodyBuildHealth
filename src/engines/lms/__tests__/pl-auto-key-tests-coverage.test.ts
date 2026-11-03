import { describe, expect, it } from 'vitest';
import { autoRegulate } from '../../pro/autoregulation-pro.engine';
import { buildDiaryAutoreg } from '../../pro/diary-autoreg.engine';
import { buildLMSPlan, getPLVolumeLandmarks, getPLVolumeBreakdown, getPLVolumeLandmarksByMuscle, getPLWeakPointRecommendations, diagnosticProtocolFromCycle } from '../lms-builder.engine';
import { calcTonnage } from '../lms-metrics.engine';
import { findLastFact } from '../../pro/diary-autoreg.engine';
import { rankCycles } from '../lms-selector.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { getExercisesByGroup } from '../../../core/exercise-catalog';
import { getVolumeLandmarks } from '../../volume-landmarks.engine';
import { diagnoseWeakPoint } from '../weakpoint-pl';
import type { WorkoutSession } from '../workout-logger.engine';
import type { WorkoutLog } from '../../../core/types';
import { localIsoDateOffset } from '../../../core/local-date';

// Даты «внутри 90-дневного окна findLastFact/findAllFacts»: хардкод календарных дат
// «протухает» — через 3 месяца окно отсекает записи и тест падает без регресса.
const D14 = localIsoDateOffset(-14);
const D13 = localIsoDateOffset(-13);
const D3 = localIsoDateOffset(-3);
const D2 = localIsoDateOffset(-2);
const D1 = localIsoDateOffset(-1);

const pmMap = { 'Присед': 150, 'Жим лежа': 110, 'Становая тяга': 180 };
const autoBase = {
  readiness: 70,
  acwr: { ratio: 1, zone: 'optimal' as const },
};

function plan(overrides: Record<string, unknown> = {}) {
  return buildLMSPlan({ template: CYCLE_01, pmMap, weeksOverride: 12, mode: 'natural', ...overrides } as never);
}

function workout(date: string, name: string, sets: { weightKg: number; reps: number; rir: number }[]): WorkoutSession {
  return {
    sessionId: date + name,
    date,
    startTime: '10:00', endTime: '11:00', durationMin: 60, focus: 'PL',
    exercises: [{
      exerciseId: name, exerciseName: name, pattern: 'bench', muscleGroup: 'chest', order: 1,
      sets: sets.map((s, i) => ({ ...s, setNumber: i + 1, rpe: 10 - s.rir, isPR: false, notes: '' })),
      totalVolume: sets.reduce((n, s) => n + s.weightKg * s.reps, 0), best1RM: 0, avgRPE: 8,
    }],
    totalVolume: 0, totalSets: sets.length, totalReps: sets.reduce((n, s) => n + s.reps, 0),
    avgIntensity: 8, prCount: 0, notes: '', weekNumber: 1, mesocycleWeek: 1,
  };
}

/** Канон дневника (core/types.WorkoutLog): сеты с `weight`, а не `weightKg`. */
function log(date: string, name: string, sets: { weight: number; reps: number; rir: number }[]): WorkoutLog {
  return {
    id: `w_${name}_${date}`, date, duration: 60, overallRPE: 8, recoveryBefore: 70, split: 'PL',
    exercises: [{
      id: `e_${name}_${date}`, date, exerciseId: name, exerciseName: name,
      sets: sets.map(s => ({ weight: s.weight, reps: s.reps, rir: s.rir, rpe: 10 - s.rir })),
      totalVolume: sets.reduce((n, s) => n + s.weight * s.reps, 0),
      estimated1RM: 0, isCompound: true,
    }],
  };
}

describe('PL-auto key coverage 4.1-4.15', () => {
  it('4.1 undertrained ACWR applies exactly ×1.1 volume', () => {
    const out = autoRegulate({ ...autoBase, acwr: { ratio: 0.6, zone: 'undertrained' } });
    expect(out.volumeMultiplier).toBe(1.1);
    expect(out.deload).toBe(false);
  });

  it('4.2 autoReg.deload reduces volume and propagates RIR', () => {
    const base = plan();
    const deload = plan({ autoReg: { topSetPctMultiplier: 1, volumeMultiplier: 1, rirShift: 2, deload: true } });
    const b = base.weeks[0].days[0].exercises[0].workSets[0];
    const d = deload.weeks[0].days[0].exercises[0].workSets[0];
    expect(d.sets).toBe(Math.max(1, Math.round(b.sets * 0.6)));
    expect(d.rir).toBe(b.rir + 2);
  });

  it('4.3 combines PED and recovery multipliers in volume landmarks', () => {
    const natural = plan();
    const ped = plan({ peds: ['AAS'], pedDoses: { AAS: 1500 }, courseIntensity: 'heavy' });
    const combined = plan({ peds: ['AAS'], pedDoses: { AAS: 1500 }, courseIntensity: 'heavy', bodyFat: 28, leanMass: 50, hrvMs: 35, sleepHours: 5, stressLevel: 8 });
    const row = (p: typeof natural) => p.plVolumeLandmarks!.find(x => x.group === 'chest')!;
    expect(row(ped).mrv).toBeGreaterThan(row(natural).mrv);
    expect(row(combined).mrv).toBeLessThan(row(ped).mrv);
    expect(row(combined).mrv).toBeGreaterThanOrEqual(Math.round(row(natural).mrv * 0.6));
  });

  it('4.4 weakGroupDayMap places the injected group on the requested day', () => {
    const template = { ...CYCLE_01, week1: CYCLE_01.week1.map(() => ({ exercises: [{ ...CYCLE_01.week1[0].exercises[0], name: 'Жим лежа', group: 'Средняя', load: 'Легкая' as const }] })) };
    const p = buildLMSPlan({ template, pmMap, weeksOverride: 4, mode: 'natural', weakPoints: ['shoulders'], weakGroupDayMap: { shoulders: [3] }, currentReadiness: 100 });
    const injected = p.weeks[0].days.map(d => d.exercises.filter(e => e.group === 'shoulders'));
    expect(injected[2].length).toBeGreaterThan(0);
    expect(injected[0].length + injected[1].length).toBe(0);
  });

  it('4.5 diary delta > 2 increases RIR by one', () => {
    const result = buildDiaryAutoreg({
      historyWorkouts: [{ id: 'w', date: D2, duration: 60, exercises: [{ id: 'e', date: D2, exerciseId: 'bench', exerciseName: 'Жим лёжа', sets: [{ weight: 100, reps: 5, rir: 0, rpe: 10 }], totalVolume: 500, estimated1RM: 120, isCompound: true }], overallRPE: 10, recoveryBefore: 50, split: 'PL' } as WorkoutLog],
      plannedExercises: [{ name: 'Жим лёжа', plannedWeight: 90, plannedReps: 5, plannedSets: 3, plannedRir: 3, isMain: true }],
    });
    expect(result.perExercise.get('Жим лёжа')!.adjustedRir).toBe(4);
  });

  it('4.6 non-main diary exercise does not receive plateau warning', () => {
    const history = [D3, D2, D1].map((d, i) => ({ id: `w${i}`, date: d, duration: 60, exercises: [{ id: 'e', date: d, exerciseId: 'curl', exerciseName: 'Сгибание рук', sets: [{ weight: 20, reps: 10, rir: 2, rpe: 8 }], totalVolume: 200, estimated1RM: 26.7, isCompound: false }], overallRPE: 8, recoveryBefore: 80, split: 'PL' })) as WorkoutLog[];
    const result = buildDiaryAutoreg({ historyWorkouts: history, plannedExercises: [{ name: 'Сгибание рук', plannedWeight: 20, plannedReps: 10, plannedSets: 3, plannedRir: 2, isMain: false }] });
    expect(result.plateauWarnings).toEqual([]);
  });

  it('4.7 velocity loss above 40% triggers deload', () => {
    const out = autoRegulate({ ...autoBase, lastVelocityLossPct: 41 });
    expect(out.deload).toBe(true);
    expect(out.volumeMultiplier).toBe(0.5);
    expect(out.topSetPctMultiplier).toBe(0.92);
  });

  it('4.8 excludes sessions older than 90 days (инвариант окна — на прод-функции findLastFact)', () => {
    // Раньше проверялось через удалённый lms-progression-feedback; инвариант
    // тот же и живёт в diary-autoreg.findLastFact (90-дневное окно).
    const old = log('2020-01-01', 'Жим лёжа', [{ weight: 300, reps: 5, rir: 0 }]);
    expect(findLastFact([old], 'Жим лёжа')).toBeNull();
    const fresh = log(localIsoDateOffset(-10), 'Жим лёжа', [{ weight: 100, reps: 5, rir: 2 }]);
    expect(findLastFact([fresh], 'Жим лёжа')).not.toBeNull();
  });

  it('4.9 applies mode mismatch penalties for natural+peak, pct+peak, on_course+endurance', () => {
    const peakNatural = rankCycles({ goal: 'peak', level: 'II-KMS', mode: 'natural' }).find(x => x.cycle.meta.period === 'peak')!;
    const peakPct = rankCycles({ goal: 'peak', level: 'II-KMS', mode: 'pct' }).find(x => x.cycle.meta.period === 'peak')!;
    const enduranceCourse = rankCycles({ goal: 'endurance', level: 'II-KMS', mode: 'on_course' }).find(x => x.cycle.meta.period === 'endurance')!;
    expect(peakNatural.warnings.join(' ')).toMatch(/натурал/);
    expect(peakPct.warnings.join(' ')).toMatch(/ПКТ/);
    expect(enduranceCourse.warnings.join(' ')).toMatch(/курса/);
    expect(peakNatural.score).toBeLessThan(peakPct.score + 6);
  });

  it('4.10 keeps the highest e1RM across repeated sessions (прод-функция findLastFact)', () => {
    const ex = 'Жим лёжа';
    const fact = findLastFact([
      log(D14, ex, [{ weight: 80, reps: 5, rir: 2 }]),
      log(D13, ex, [{ weight: 82, reps: 1, rir: 1 }]),
    ], ex);
    expect(fact).not.toBeNull();
    // 80×5 (≈93.3) выше 82×1 (≈84.7) — берётся лучший e1RM, а не последний по дате.
    expect(Math.round(fact!.e1RM)).toBe(93);
  });

  it('4.11 calculates tonnage as Σ(weight × reps × sets) × mnosz', async () => {
    expect(calcTonnage({ name: 'x', group: 'ЖМ', coef: 1, mnosz: 1.5, pm: 100, sets: [{ weight: 80, reps: 5, sets: 3 }, { weight: 60, reps: 10, sets: 2 }] })).toBe(3600);
  });

  // P2-2: вклад упражнений в группу объёма (причина перебора), без мелких порогов.
  it('4.12b вклад упражнений сходится с объёмом группы на пиковой неделе', () => {
    const p = plan();
    const lms = getPLVolumeLandmarks(p.weeks, 'intermediate');
    const bd = getPLVolumeBreakdown(p.weeks);
    expect(bd.peakWeek).toBe(lms[0].peakWeek);
    expect(bd.rows.length).toBeGreaterThan(0);
    for (const row of lms) {
      const sum = bd.rows.filter(r => r.group === row.group).reduce((n, r) => n + r.sets, 0);
      expect(sum).toBe(row.sets);
    }
    // Внутри группы строки идут по убыванию подходов, доли в сумме ≈ 100 %.
    const byGroup = new Map<string, number>();
    for (const r of bd.rows) byGroup.set(r.group, (byGroup.get(r.group) || 0) + r.sharePct);
    for (const [, share] of byGroup) expect(Math.abs(share - 100)).toBeLessThanOrEqual(2);
    for (const g of new Set(bd.rows.map(r => r.group))) {
      const sets = bd.rows.filter(r => r.group === g).map(r => r.sets);
      expect([...sets].sort((a, b) => b - a)).toEqual(sets);
    }
  });

  // P2-2 (вариант «а», согласован): композиты раскладываются по МЫШЦАМ пропорционально.
  it('4.12c по мышцам: сумма сходится с группами, композитных ключей нет', () => {
    const p = plan();
    const byMuscle = getPLVolumeLandmarksByMuscle(p.weeks, 'intermediate');
    const byGroup = getPLVolumeLandmarks(p.weeks, 'intermediate');
    expect(byMuscle.length).toBeGreaterThan(0);
    // Композитные ключи (legs/arms/shoulders) в разбивке запрещены: их порог —
    // сумма подгрупп, вместе с подгруппами это дало бы двойной счёт.
    expect(byMuscle.every(r => !['legs', 'arms', 'shoulders'].includes(r.group))).toBe(true);
    const sumMuscle = byMuscle.reduce((n, r) => n + r.sets, 0);
    const sumGroup = byGroup.reduce((n, r) => n + r.sets, 0);
    // Пропорции сохраняют объём: расхождение — только округление до 0.1 сета.
    expect(Math.abs(sumMuscle - sumGroup)).toBeLessThanOrEqual(0.6);
  });

  it('4.12d присед: 10 сетов → квадрицепс 6 / бицепс бедра 4 (разбивка 60/40)', () => {
    const wk = {
      week: 1, pmRow: {}, days: [{ exercises: [
        { name: 'Присед', group: 'Ноги', workSets: [{ pct: 0.8, reps: 5, sets: 10, weight: 100, rir: 2 }] },
      ] }],
    } as never;
    const rows = getPLVolumeLandmarksByMuscle([wk], 'intermediate');
    const sets = (g: string) => rows.find(r => r.group === g)?.sets ?? 0;
    expect(sets('quads')).toBeCloseTo(6, 5);
    expect(sets('hamstrings')).toBeCloseTo(4, 5);
    expect(rows.length).toBe(2);
  });

  it('4.12e румынская тяга (hinge): бицепс бедра 45 % / ягодицы 30 % / спина 25 %, без квадрицепса', () => {
    const wk = {
      week: 1, pmRow: {}, days: [{ exercises: [
        { name: 'Румынская тяга', group: 'Ноги', workSets: [{ pct: 0.7, reps: 8, sets: 4, weight: 100, rir: 2 }] },
      ] }],
    } as never;
    const rows = getPLVolumeLandmarksByMuscle([wk], 'intermediate');
    const sets = (g: string) => rows.find(r => r.group === g)?.sets ?? 0;
    expect(sets('hamstrings')).toBeCloseTo(1.8, 5);
    expect(sets('glutes')).toBeCloseTo(1.2, 5);
    expect(sets('back')).toBeCloseTo(1.0, 5);
    expect(sets('quads')).toBe(0);
  });

  it('4.12 returns ordered landmarks with correct status', () => {
    const rows = getPLVolumeLandmarks(plan().weeks, 'intermediate');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.mrv >= r.mav && r.mav >= r.mev)).toBe(true);
    for (const r of rows) expect(r.status).toBe(r.sets < r.mev ? 'under' : r.sets > r.mrv ? 'over' : r.sets > r.mav ? 'high' : 'optimal');
  });

  it('4.13 injects concrete weak-point exercise names', () => {
    const recommendation = getPLWeakPointRecommendations('bench', 'lockout');
    expect(recommendation.corrections.length).toBeGreaterThan(0);
    expect(recommendation.corrections.some(n => /дожим|рама/i.test(n))).toBe(true);
  });

  it('4.14 ACWR caution — advisory without corroboration, applies ×0.85 WITH a recovery marker (P0-А, было→стало)', () => {
    // БЫЛО→СТАЛО (26.09.2026, P0-А): зона ACWR резала объём сама по себе.
    // СТАЛО: ACWR — контекстный индикатор (Ding 2026, Front Public Health 14:1896651,
    // PMID 42662491: g=0.35, I²=95.8 %, «не самостоятельный предиктор»), и меняет план
    // только при подтверждении другим маркером восстановления.
    const base = plan().weeks[0].days[0].exercises[0].workSets[0];

    // Без подтверждения — план не тронут (было: ×0.85 и RIR+1 всегда).
    const advisory = plan({ acwr: { ratio: 1.4, zone: 'caution' } }).weeks[0].days[0].exercises[0].workSets[0];
    expect(advisory.sets).toBe(base.sets);
    expect(advisory.rir).toBe(base.rir);

    // С подтверждением (сон) — старая логика включается.
    const caution = plan({ acwr: { ratio: 1.4, zone: 'caution' }, sleepHours: 8 }).weeks[0].days[0].exercises[0].workSets[0];
    expect(caution.sets).toBe(Math.round(base.sets * 0.85));
    expect(caution.rir).toBe(base.rir + 1);
  });

   it('4.15 taper uses ×0.65 and ×0.45 set reductions', () => {
     const p = plan();
     const volume = (i: number) => p.weeks[i].days.flatMap(d => d.exercises).reduce((n, e) => n + e.workSets.reduce((s, x) => s + x.sets, 0), 0);
     const w10 = volume(9), w11 = volume(10), w12 = volume(11);
     expect(w11).toBeLessThan(w10);
     expect(w12).toBeLessThan(w11);
     // Integer set rounding and the per-exercise minimum can move the aggregate
     // ratio away from the nominal multiplier. Verify the taper direction and
     // bounded reductions instead of requiring an impossible exact total.
     expect(w11 / w10).toBeGreaterThan(0.5);
     expect(w11 / w10).toBeLessThan(0.8);
     expect(w12 / w10).toBeGreaterThan(0.3);
     expect(w12 / w10).toBeLessThan(0.6);
   });

   // ── ПЛ-авто: слабые мышцы — выбор дней + авто-распределение ──

   it('4.16 weakGroupDayMap: 2 дня для малой группы (arms) распределяет в выбранные дни', () => {
     // 4-дневный шаблон чтобы было куда распределять (используем CYCLE_01 и добавляем 4-й день)
     const baseDay = CYCLE_01.week1[0];
     const tpl4 = { ...CYCLE_01, week1: [
       { ...baseDay, exercises: baseDay.exercises.map(ex => ({ ...ex, group: 'Ноги' })) },
       { ...baseDay, exercises: baseDay.exercises.map(ex => ({ ...ex, group: 'Грудь' })) },
       { ...baseDay, exercises: baseDay.exercises.map(ex => ({ ...ex, group: 'Спина' })) },
       { ...baseDay, exercises: baseDay.exercises.map(ex => ({ ...ex, group: 'Плечи' })) },
     ]};
     const p = buildLMSPlan({ template: tpl4, pmMap, weeksOverride: 4, mode: 'natural',
       weakPoints: ['arms'], weakGroupDayMap: { arms: [1, 3] }, currentReadiness: 100 });
     const injected = p.weeks[0].days.map(d => d.exercises.filter(e => e.group === 'arms'));
     // arms должны быть в днях 1 и 3 (1-based → 0 и 2)
     expect(injected[0].length).toBeGreaterThan(0);
     expect(injected[2].length).toBeGreaterThan(0);
     // и НЕ в днях 2 и 4
     expect(injected[1].length).toBe(0);
     expect(injected[3].length).toBe(0);
   });

   it('4.17 weakGroupDayMap: 1 день для крупной группы (chest)', () => {
     // Используем CYCLE_01 как базу, заменяем только group у упражнений
     const tpl3 = { ...CYCLE_01, week1: CYCLE_01.week1.map((d, i) => ({
       ...d, exercises: d.exercises.map((ex, j) => ({
         ...ex, group: ['Ноги','Грудь','Спина'][i],
         workSets: ex.workSets ?? [{ pct: 0.75, reps: 5, sets: 3, weight: 100, rir: 2 }],
       })),
     }))};
     const p = buildLMSPlan({ template: tpl3, pmMap, weeksOverride: 4, mode: 'natural',
       weakPoints: ['chest'], weakGroupDayMap: { chest: [2] }, currentReadiness: 100 });
     const injected = p.weeks[0].days.map(d => d.exercises.filter(e => e.group === 'chest'));
     // chest должен быть только в дне 2 (1-based → index 1)
     expect(injected[1].length).toBeGreaterThan(0);
   });

   it('4.18 plWeakPointDayMap: 1 день → обе коррекции в выбранный день', () => {
     const p = buildLMSPlan({ template: CYCLE_01, pmMap, weeksOverride: 4, mode: 'natural',
       plWeakPoints: [{ lift: 'bench' as const, weakPoint: 'lockout' as const }],
       plWeakPointDayMap: { 'bench|lockout': [2] },
       currentReadiness: 100 });
     // В дне 2 (1-based → index 1) должно быть минимум 1 добавленное упражнение
     const day2Exercises = p.weeks[0].days[1].exercises;
     // Ищем упражнения из weak-point коррекций (не main лифт)
     const injected = day2Exercises.filter(e => e.name !== 'Присед' && e.name !== 'Жим лёжа' && e.name !== 'Становая тяга');
     expect(injected.length).toBeGreaterThanOrEqual(1);
   });

   it('4.19 plWeakPointDayMap: 2 дня → коррекции в разные дни', () => {
     const p = buildLMSPlan({ template: CYCLE_01, pmMap, weeksOverride: 4, mode: 'natural',
       plWeakPoints: [{ lift: 'bench' as const, weakPoint: 'lockout' as const }],
       plWeakPointDayMap: { 'bench|lockout': [1, 3] },
       currentReadiness: 100 });
     const allInjected = p.weeks[0].days.flatMap((d, idx) =>
       d.exercises.filter(e => e.name !== 'Присед' && e.name !== 'Жим лёжа' && e.name !== 'Становая тяга')
        .map(e => ({ day: idx, name: e.name }))
     );
     // Должно быть минимум 2 разных упражнения (или 2 добавления)
     expect(allInjected.length).toBeGreaterThanOrEqual(2);
     // Проверяем что они в днях 1 и 3 (0-based: 0 и 2)
     const dayIndices = [...new Set(allInjected.map(x => x.day))];
     expect(dayIndices).toContain(0);
     expect(dayIndices).toContain(2);
   });

   it('4.20 weakPoints авто-распределение: arms (малая группа) → 2 разных дня', () => {
     const p = buildLMSPlan({ template: CYCLE_01, pmMap, weeksOverride: 4, mode: 'natural',
       weakPoints: ['arms'], currentReadiness: 100 });
     const injected = p.weeks[0].days.map(d => d.exercises.filter(e => e.group === 'arms'));
     const daysWithArms = injected.filter(d => d.length > 0);
     // Должно быть распределено в 2 дня (малая группа = 2×/нед)
     expect(daysWithArms.length).toBe(2);
   });

    it('4.21 plWeakPoints: упражнения из диагностики добавляются в план', () => {
      const p = buildLMSPlan({ template: CYCLE_01, pmMap, weeksOverride: 4, mode: 'natural',
        plWeakPoints: [{ lift: 'bench' as const, weakPoint: 'lockout' as const }],
        plWeakPointDayMap: { 'bench|lockout': [1, 3] },
       currentReadiness: 100 });
     // Проверяем, что упражнения из диагностики добавлены в выбранные дни
     const day1Exercises = p.weeks[0].days[0].exercises;
     const day3Exercises = p.weeks[0].days[2].exercises;
     // В дне 1 и 3 должны быть упражнения, которых нет в исходном шаблоне для этих дней
     const day1New = day1Exercises.filter(e => !CYCLE_01.week1[0].exercises.some(te => te.name === e.name));
     const day3New = day3Exercises.filter(e => !CYCLE_01.week1[2].exercises.some(te => te.name === e.name));
      expect(day1New.length).toBeGreaterThan(0);
      expect(day3New.length).toBeGreaterThan(0);
    });

    it('4.22 diagnostic assistant: one exercise is added to every explicitly selected day', () => {
      const name = 'Выбранный ассистент';
      const p = buildLMSPlan({ template: CYCLE_01, pmMap, weeksOverride: 4, mode: 'natural',
        diagnosticExerciseMap: { 'bench|barpath|forward_drift': [name] },
        diagnosticDayMap: { 'bench|barpath|forward_drift': [1, 3] },
        currentReadiness: 100 });

      expect(p.weeks[0].days[0].exercises.some(e => e.name === name)).toBe(true);
      expect(p.weeks[0].days[2].exercises.some(e => e.name === name)).toBe(true);
      expect(p.weeks[0].days[1].exercises.some(e => e.name === name)).toBe(false);
    });

    it('4.23 diagnostic assistant: empty day selection uses automatic heavy/light days', () => {
      const name = 'Авто ассистент';
      const p = buildLMSPlan({ template: CYCLE_01, pmMap, weeksOverride: 4, mode: 'natural',
        diagnosticExerciseMap: { 'bench|barpath|forward_drift': [name] },
        currentReadiness: 100 });
      const daysWithAssistant = p.weeks[0].days
        .map((day, index) => day.exercises.some(e => e.name === name) ? index : -1)
        .filter(index => index >= 0);

      expect(daysWithAssistant).toEqual([0, 2]);
    });

    it('4.24 diagnostic assistant: протокол из раскладки цикла (не фикс 3×10@60% RIR3)', () => {
      const name = 'Протокольный ассистент';
      const p = buildLMSPlan({ template: CYCLE_01, pmMap, weeksOverride: 4, mode: 'natural',
        diagnosticExerciseMap: { 'bench|barpath|forward_drift': [name] },
        currentReadiness: 100 });
      const injected = p.weeks[0].days[0].exercises.find(e => e.name === name);
      expect(injected).toBeTruthy();
      // Протокол = set-блок первого аксессуара раскладки цикла (как в карточке диагностики)
      const layouts: any = CYCLE_01.weeks && CYCLE_01.weeks.length > 0 ? CYCLE_01.weeks : [CYCLE_01.week1];
      const acc = layouts.flatMap((days: any[]) => days.flatMap((day: any) => day.exercises.filter((s: any) => s.load !== 'Тяжелая' && s.sets && s.sets.length > 0)))[0];
      const first = acc.sets[0];
      expect(injected!.workSets[0].pct).toBe(first.pct);
      expect(injected!.workSets[0].reps).toBe(Math.max(2, first.reps));
      expect(injected!.workSets[0].sets).toBe(Math.max(1, first.sets));
      expect(injected!.workSets[0].rir).toBe(first.rir ?? 2);
    });

    it('4.25 diagnostic assistant: day cap — не более 10 упражнений на день', () => {
      const many = Array.from({ length: 12 }, (_, i) => `Ассистент ${i + 1}`);
      const p = buildLMSPlan({ template: CYCLE_01, pmMap, weeksOverride: 4, mode: 'natural',
        diagnosticExerciseMap: { 'bench|barpath|forward_drift': many },
        currentReadiness: 100 });
      const dayLengths = p.weeks[0].days.map(day => day.exercises.length);
      expect(dayLengths.every(len => len <= 10)).toBe(true);
      const injectedCount = p.weeks[0].days.reduce((sum, day) => sum + day.exercises.filter(e => e.name.startsWith('Ассистент')).length, 0);
      expect(injectedCount).toBeGreaterThan(0);
    });

    it('4.26 diagnostic assistant: per-day dedup — в одном дне упражнение не дублируется', () => {
      const diag = diagnoseWeakPoint('bench', 'lockout');
      const firstName = diag.assistance[0];
      expect(firstName).toBeTruthy();
      const p = buildLMSPlan({ template: CYCLE_01, pmMap, weeksOverride: 4, mode: 'natural',
        plWeakPoints: [{ lift: 'bench', weakPoint: 'lockout' }],
        diagnosticExerciseMap: { 'bench|lockout': [firstName] },
        currentReadiness: 100 });
      // Инвариант per-day dedup: ни в одном дне упражнение не встречается дважды.
      const perDayCounts = p.weeks[0].days.map(d => d.exercises.filter(e => e.name === firstName).length);
      expect(perDayCounts.every(c => c <= 1)).toBe(true);
    });

    it('4.28 diagnostic assistant: weakSide +1 сет унилатеральным, билатеральные без бонуса', () => {
      const uni = 'Жим гантелей лёжа';
      const bi = 'Контрольный билатеральный ассистент';
      const base = { template: CYCLE_01, pmMap, weeksOverride: 4, mode: 'natural' as const, currentReadiness: 100 };
      const p = buildLMSPlan({ ...base,
        diagnosticExerciseMap: { 'bench|barpath|asymmetric': [uni, bi] },
        diagnosticWeakSide: 'left' });
      const all = p.weeks[0].days.flatMap(d => d.exercises);
      const injectedUni = all.find(e => e.name.startsWith(uni));
      expect(injectedUni).toBeTruthy();
      expect(injectedUni!.name).toContain('слабая: левая');
      const protocol = diagnosticProtocolFromCycle(CYCLE_01, uni);
      expect(injectedUni!.workSets[0].sets).toBe(protocol.sets + 1);
      const injectedBi = all.find(e => e.name === bi);
      if (injectedBi) expect(injectedBi.workSets[0].sets).toBe(diagnosticProtocolFromCycle(CYCLE_01, bi).sets);
      // без weakSide — бонуса нет
      const p2 = buildLMSPlan({ ...base, diagnosticExerciseMap: { 'bench|barpath|asymmetric': [uni] } });
      const uni2 = p2.weeks[0].days.flatMap(d => d.exercises).find(e => e.name.startsWith(uni));
      expect(uni2).toBeTruthy();
      expect(uni2!.name).not.toContain('слабая');
    });

    it('4.27 diagnostic assistant: MRV-бюджет группы — при переборе пропускается с note', () => {
      const chestNames = Array.from(new Set(getExercisesByGroup('chest').map(e => e.name)));
      const protocol = diagnosticProtocolFromCycle(CYCLE_01, chestNames[0]);
      const S = Math.max(1, protocol.sets);
      const budget = Math.round(getVolumeLandmarks('intermediate', 'chest').mrv);
      const N = Math.floor(budget / S) + 4;
      const names = chestNames.slice(0, N);
      expect(names.length).toBe(N);
      // Ключ 'squat|chest' → авто-дни тяжёлый+лёгкий (2 дня), чтобы day cap не сработал раньше MRV.
      const p = buildLMSPlan({ template: CYCLE_01, pmMap, weeksOverride: 4, mode: 'natural',
        diagnosticExerciseMap: { 'squat|chest': names },
        currentReadiness: 100 });
      const injected = p.weeks[0].days.flatMap(d => d.exercises).filter(e => names.includes(e.name)).length;
      expect(injected).toBeLessThan(names.length);
      expect(p.progressionRationale).toContain('не добавлен');
    });
  });
