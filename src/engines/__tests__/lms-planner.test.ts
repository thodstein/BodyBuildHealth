import { describe, it, expect } from 'vitest';
import { buildLMSPlan, extractExercises } from '../lms/lms-builder.engine';
import { pmProgression, workWeight, pmForWeek, progressionRationale } from '../lms/lms-progression.engine';
import { lmsPlanToSessions } from '../training-integration.engine';
import { CYCLE_01 } from '../../data/lms-cycles/cycle-01';
import type { SRCycleTemplate } from '../../data/lms-cycles/lms-types';

// ── Helpers ──
const pmMap = { 'Присед': 150, 'Жим лежа': 110, 'Становая тяга': 180 };

function buildCycle01Plan(overrides: Partial<Parameters<typeof buildLMSPlan>[0]> = {}) {
  return buildLMSPlan({
    template: CYCLE_01,
    pmMap,
    fallbackPm: 80,
    mode: 'natural',
    weeksOverride: 12,
    ...overrides,
  });
}

// ── buildLMSPlan ──
describe('buildLMSPlan', () => {
  it('генерирует 12 недель для cycle-01', () => {
    const plan = buildCycle01Plan();
    expect(plan.weeks).toHaveLength(12);
  });

  it('неделя 1 содержит 3 дня', () => {
    const plan = buildCycle01Plan();
    expect(plan.weeks[0].days).toHaveLength(3);
  });

  it('clamps readiness for fatigue budget and charges trimmed accessory sets', () => {
    const plan = buildCycle01Plan({ currentReadiness: 0 });
    for (const day of plan.weeks[0].days) {
      expect(day.exercises.every(ex => ex.workSets.every(ws => ws.sets >= 1))).toBe(true);
    }
  });

  it('applies fatigue budget after weak-point injections', () => {
    const plan = buildCycle01Plan({ currentReadiness: 0, weakPoints: ['arms', 'back', 'chest'] });
    for (const day of plan.weeks[0].days) {
      const accessories = day.exercises.filter(ex => ex.load !== 'Тяжелая');
      expect(accessories.every(ex => ex.workSets.every(workSet => workSet.sets >= 2))).toBe(true);
      expect(day.exercises.length).toBeLessThanOrEqual(8);
    }
  });

  it('PM растёт по неделям (natural, +0.5%/нед)', () => {
    const plan = buildCycle01Plan();
    const w1pm = plan.weeks[0].pmRow['Присед'];
    const w12pm = plan.weeks[11].pmRow['Присед'];
    expect(w12pm).toBeGreaterThan(w1pm);
    // (1.005)^11 ≈ 1.056
    expect(w12pm / w1pm).toBeCloseTo(1.056, 2);
  });

  it('rationale uses actual PM data, not a dummy PM0', () => {
    const plan = buildCycle01Plan();
    expect(plan.progressionRationale).not.toContain('PM0=100 кг');
    expect(plan.progressionRationale).toContain('PM0=');
  });

  it('rationale preserves an explicitly provided zero readiness', () => {
    const plan = buildCycle01Plan({ currentReadiness: 0 });
    expect(plan.progressionRationale).toContain('Ready: 0%');
  });

  it('PM week 1 = входной PM (без прогрессии в первую неделю)', () => {
    const plan = buildCycle01Plan();
    expect(plan.weeks[0].pmRow['Присед']).toBe(150);
    expect(plan.weeks[0].pmRow['Жим лежа']).toBe(110);
    expect(plan.weeks[0].pmRow['Становая тяга']).toBe(180);
  });

  it('faithful сохраняет исходные проценты и количество подходов каждой строки', () => {
    const plan = buildCycle01Plan({
      faithful: true,
      volumeGoal: 'mrv',
      currentReadiness: 0,
      acwr: { ratio: 1.8, zone: 'dangerous' },
      autoReg: { topSetPctMultiplier: 0.8, volumeMultiplier: 0.5, rirShift: 3, deload: true },
    });
    CYCLE_01.week1.forEach((sourceDay, dayIndex) => {
      expect(plan.weeks[0].days[dayIndex].exercises).toHaveLength(sourceDay.exercises.length);
      sourceDay.exercises.forEach((sourceExercise, exerciseIndex) => {
        const actual = plan.weeks[0].days[dayIndex].exercises[exerciseIndex];
        expect(actual.name).toBe(sourceExercise.name);
        expect(actual.workSets.map(({ pct, reps }) => ({ pct, reps })))
          .toEqual(sourceExercise.sets.map(s => ({ pct: s.pct, reps: s.reps })));
      });
    });
  });

  it('faithful сохраняет source и добавляет слабые группы и точки отдельным слоем', () => {
    const plan = buildCycle01Plan({
      faithful: true,
      weakPoints: ['shoulders'],
      weakGroupDayMap: { shoulders: [2] },
      plWeakPoints: [{ lift: 'bench', weakPoint: 'lockout' }],
      plWeakPointDayMap: { 'bench|lockout': [1] },
    });
    const sourceExerciseNames = new Set(CYCLE_01.week1[1].exercises.map(ex => ex.name));
    const dayTwo = plan.weeks[0].days[1].exercises;
    expect(dayTwo.filter(ex => sourceExerciseNames.has(ex.name))).toHaveLength(sourceExerciseNames.size);
    expect(dayTwo.some(ex => ex.group === 'shoulders')).toBe(true);
    expect(plan.weeks[0].days[0].exercises.some(ex => /дожим|трицепс|разгиб/i.test(ex.name))).toBe(true);
    const sourceBench = CYCLE_01.week1[1].exercises.find(ex => ex.name === 'Жим лежа')!;
    const actualBench = dayTwo.find(ex => ex.name === 'Жим лежа')!;
    expect(actualBench.workSets.map(({ pct, reps, sets }) => ({ pct, reps, sets }))).toEqual(sourceBench.sets);
  });

  it('каждое упражнение имеет workSets с weight > 0', () => {
    const plan = buildCycle01Plan();
    for (const wk of plan.weeks) {
      for (const day of wk.days) {
        for (const ex of day.exercises) {
          for (const ws of ex.workSets) {
            expect(ws.weight).toBeGreaterThan(0);
            expect(ws.sets).toBeGreaterThan(0);
            expect(ws.reps).toBeGreaterThan(0);
        }
      }
    }
    }
  });

  it('все упражнения имеют rir (фаза мезоцикла)', () => {
    const plan = buildCycle01Plan();
    for (const wk of plan.weeks) {
      for (const day of wk.days) {
        for (const ex of day.exercises) {
          for (const ws of ex.workSets) {
            expect(ws.rir).toBeGreaterThanOrEqual(0);
            expect(ws.rir).toBeLessThanOrEqual(5);
          }
        }
      }
    }
  });

  it('дельнейшая неделя при делоде имеет более высокий RIR', () => {
    const plan = buildCycle01Plan({ weeksOverride: 8 });
    // week 4 — deload (каждая 4-я неделя в base phase)
    const wk3Rir = plan.weeks[2].days[0].exercises[0].workSets[0].rir;
    const wk4Rir = plan.weeks[3].days[0].exercises[0].workSets[0].rir;
    expect(wk4Rir).toBeGreaterThanOrEqual(wk3Rir);
  });

  it('S-MRV floor: аксессуары ≥ 2 подходов (до taper)', () => {
    const plan = buildCycle01Plan();
    // Проверяем только первые недели (taper к финальным 2 неделям может снижать ниже 2)
    for (const wk of plan.weeks.slice(0, -2)) {
      for (const day of wk.days) {
        for (const ex of day.exercises) {
          if (ex.load !== 'Тяжелая') {
            for (const ws of ex.workSets) {
              expect(ws.sets).toBeGreaterThanOrEqual(2);
            }
          }
        }
      }
    }
  });

  it('volumeGoal=mrv даёт больше сетов аксессуарам чем mev', () => {
    const planMev = buildCycle01Plan({ volumeGoal: 'mev' });
    const planMrv = buildCycle01Plan({ volumeGoal: 'mrv' });
    // Сравниваем общее число сетов на неделе 1
    const setsMev = planMev.weeks[0].days[0].exercises.filter(e => e.load !== 'Тяжелая')
      .reduce((s, e) => s + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0);
    const setsMrv = planMrv.weeks[0].days[0].exercises.filter(e => e.load !== 'Тяжелая')
      .reduce((s, e) => s + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0);
    expect(setsMrv).toBeGreaterThanOrEqual(setsMev);
  });

  it('on_course mode увеличивает прогрессию', () => {
    const planNat = buildCycle01Plan({ mode: 'natural' });
    const planCourse = buildCycle01Plan({ mode: 'on_course', courseIntensity: 'moderate' });
    const w12Nat = planNat.weeks[11].pmRow['Присед'];
    const w12Course = planCourse.weeks[11].pmRow['Присед'];
    expect(w12Course).toBeGreaterThan(w12Nat);
  });

  it('focusLift = squat увеличивает объём приседаний', () => {
    const planBase = buildCycle01Plan();
    const planFocus = buildCycle01Plan({ focusLift: 'squat' });
    const setsBase = planBase.weeks[0].days.flatMap(d => d.exercises)
      .filter(e => e.name.toLowerCase().includes('присед'))
      .reduce((s, e) => s + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0);
    const setsFocus = planFocus.weeks[0].days.flatMap(d => d.exercises)
      .filter(e => e.name.toLowerCase().includes('присед'))
      .reduce((s, e) => s + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0);
    expect(setsFocus).toBeGreaterThanOrEqual(setsBase);
  });

  it('focusLift = bench не увеличивает объём жима ногами', () => {
    const legPress = {
      name: 'Жим ногами', group: 'Ноги', coef: 0.5, mnosz: 1,
      load: 'Средняя', sets: [{ pct: 0.5, reps: 10, sets: 3 }],
    };
    const template = {
      ...CYCLE_01,
      meta: { ...CYCLE_01.meta, sourceWeeks: false },
      weeks: undefined,
      week1: CYCLE_01.week1.map((day, index) => index === 0
        ? { ...day, exercises: [...day.exercises, legPress] }
        : day),
    };
    const base = buildLMSPlan({ template, pmMap, fallbackPm: 80, weeksOverride: 1 });
    const focused = buildLMSPlan({ template, pmMap, fallbackPm: 80, weeksOverride: 1, focusLift: 'bench' });
    const getSets = (plan: ReturnType<typeof buildLMSPlan>) => plan.weeks[0].days[0].exercises
      .find(ex => ex.name === 'Жим ногами')!.workSets[0].sets;
    expect(getSets(focused)).toBe(getSets(base));
  });

  it('метрики цикла присутствуют', () => {
    const plan = buildCycle01Plan();
    expect(plan.cycleMetrics).toBeDefined();
    expect(plan.cycleMetrics.tonnage).toBeGreaterThan(0);
    expect(plan.cycleMetrics.kpsh).toBeGreaterThan(0);
    expect(plan.cycleMetrics.sessions).toBeGreaterThan(0);
  });

  it('plVolumeLandmarks содержат группы', () => {
    const plan = buildCycle01Plan();
    expect(plan.plVolumeLandmarks.length).toBeGreaterThan(0);
    for (const r of plan.plVolumeLandmarks) {
      expect(r.group).toBeTruthy();
      expect(r.mrv).toBeGreaterThan(0);
      expect(r.mev).toBeGreaterThanOrEqual(0);
    }
  });

  it('бросает ошибку при невалидном шаблоне (no week1)', () => {
    const badTpl: SRCycleTemplate = {
      meta: { ...CYCLE_01.meta },
      week1: [],
    };
    expect(() => buildLMSPlan({ template: badTpl, pmMap, fallbackPm: 80 }))
      .toThrow('week1 must be a non-empty array');
  });

  it('бросает ошибку при невалидном fallbackPm', () => {
    expect(() => buildCycle01Plan({ fallbackPm: 0 }))
      .toThrow('fallbackPm must be > 0');
  });

  it('бросает ошибку при невалидном pct', () => {
    const badTpl: SRCycleTemplate = {
      ...CYCLE_01,
      week1: [{ exercises: [{ name: 'Присед', group: 'ЖМ', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{ pct: 1.5, reps: 6, sets: 4 }] }] }],
    };
    expect(() => buildLMSPlan({ template: badTpl, pmMap, fallbackPm: 80 }))
      .toThrow('invalid pct');
  });

  it('бросает ошибку при 0 sets', () => {
    const badTpl: SRCycleTemplate = {
      ...CYCLE_01,
      week1: [{ exercises: [{ name: 'Присед', group: 'ЖМ', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{ pct: 0.5, reps: 6, sets: 0 }] }] }],
    };
    expect(() => buildLMSPlan({ template: badTpl, pmMap, fallbackPm: 80 }))
      .toThrow('invalid sets count');
  });

  it('extractExercises извлекает уникальные имена', () => {
    const names = extractExercises(CYCLE_01);
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain('Присед');
    expect(names).toContain('Жим лежа');
    expect(names).toContain('Становая тяга');
    // должны быть уникальными
    expect(new Set(names).size).toBe(names.length);
  });

  it('faithful multi-week: weeks[1] не дублирует week[0]', () => {
    // Создаём faithful цикл с 2 явными неделями
    const week2Layout = CYCLE_01.week1.map(day => ({
      exercises: day.exercises.map(ex => ({
        ...ex,
        sets: ex.sets.map(s => ({ ...s, pct: s.pct * 1.02 })),
      })),
    }));
    const faithfulTpl: SRCycleTemplate = {
      ...CYCLE_01,
      meta: { ...CYCLE_01.meta, sourceWeeks: false },
      weeks: [CYCLE_01.week1, week2Layout],
    };
    const plan = buildLMSPlan({ template: faithfulTpl, pmMap, fallbackPm: 80 });
    expect(plan.weeks).toHaveLength(2);
    // PM прогрессирует по correctionPct даже для explicit weeks (faithful = исходный %, но PM растёт)
    expect(plan.weeks[1].pmRow['Присед']).toBeGreaterThan(plan.weeks[0].pmRow['Присед']);
  });

  // ── P1: ACWR / autoReg / PEDs интеграция ──

  it('ACWR zone=caution → объём снижен, RIR повышен', () => {
    const planBase = buildCycle01Plan();
    const planCaution = buildCycle01Plan({
      acwr: { ratio: 1.4, zone: 'caution' },
    });
    const baseSets = planBase.weeks[0].days[0].exercises.reduce((s, e) => s + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0);
    const cautionSets = planCaution.weeks[0].days[0].exercises.reduce((s, e) => s + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0);
    expect(cautionSets).toBeLessThanOrEqual(baseSets);
    // RIR должен быть выше при caution
    const baseRir = planBase.weeks[0].days[0].exercises[0].workSets[0].rir;
    const cautionRir = planCaution.weeks[0].days[0].exercises[0].workSets[0].rir;
    expect(cautionRir).toBeGreaterThanOrEqual(baseRir);
  });

  it('ACWR zone=dangerous → deload (объём ×0.65)', () => {
    const plan = buildCycle01Plan({
      acwr: { ratio: 1.6, zone: 'dangerous' },
    });
    const planBase = buildCycle01Plan();
    const baseSets = planBase.weeks[0].days[0].exercises.reduce((s, e) => s + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0);
    const dangerSets = plan.weeks[0].days[0].exercises.reduce((s, e) => s + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0);
    expect(dangerSets).toBeLessThan(baseSets);
  });

  it('autoReg topSetPctMultiplier < 1 → вес снижен', () => {
    const planBase = buildCycle01Plan();
    const planReg = buildCycle01Plan({
      autoReg: { topSetPctMultiplier: 0.9, volumeMultiplier: 1, rirShift: 1, deload: false },
    });
    const baseW = planBase.weeks[0].days[0].exercises[0].workSets[0].weight;
    const regW = planReg.weeks[0].days[0].exercises[0].workSets[0].weight;
    expect(regW).toBeLessThan(baseW);
  });

  it('autoReg rirShift → RIR увеличен', () => {
    const plan = buildCycle01Plan({
      autoReg: { topSetPctMultiplier: 1, volumeMultiplier: 1, rirShift: 2, deload: false },
    });
    const planBase = buildCycle01Plan();
    const baseRir = planBase.weeks[0].days[0].exercises[0].workSets[0].rir;
    const regRir = plan.weeks[0].days[0].exercises[0].workSets[0].rir;
    expect(regRir).toBe(baseRir + 2);
  });

  it('PEDs (AAS) → pedMrvMult > 1 (dose-aware)', () => {
    const plan = buildCycle01Plan({
      mode: 'on_course',
      peds: ['AAS' as any],
      pedDoses: { AAS: 500 },
      courseIntensity: 'moderate',
    });
    // PED-адаптация должна упоминаться в rationale
    expect(plan.progressionRationale).toContain('PED');
  });

  it('ACWR + autoReg комбинируются (объём и вес снижены)', () => {
    const plan = buildCycle01Plan({
      acwr: { ratio: 1.4, zone: 'caution' },
      autoReg: { topSetPctMultiplier: 0.92, volumeMultiplier: 0.85, rirShift: 1, deload: false },
    });
    const planBase = buildCycle01Plan();
    const baseW = planBase.weeks[0].days[0].exercises[0].workSets[0].weight;
    const regW = plan.weeks[0].days[0].exercises[0].workSets[0].weight;
    expect(regW).toBeLessThan(baseW);
  });

  // ── P1: PL Taper к финальным неделям ──

  it('Taper: финальная неделя имеет меньше сетов чем первая', () => {
    const plan = buildCycle01Plan();
    const firstWeekSets = plan.weeks[0].days[0].exercises.reduce((s, e) => s + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0);
    const lastWeekSets = plan.weeks[plan.weeks.length - 1].days[0].exercises.reduce((s, e) => s + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0);
    expect(lastWeekSets).toBeLessThan(firstWeekSets);
  });

  it('Taper: RIR финальной недели выше чем первой', () => {
    const plan = buildCycle01Plan();
    const firstRir = plan.weeks[0].days[0].exercises[0].workSets[0].rir;
    const lastRir = plan.weeks[plan.weeks.length - 1].days[0].exercises[0].workSets[0].rir;
    expect(lastRir).toBeGreaterThanOrEqual(firstRir);
  });

  it('Taper: rationale содержит упоминание taper', () => {
    const plan = buildCycle01Plan();
    expect(plan.progressionRationale).toContain('Taper');
  });

  it('Taper не применяется при ACWR deload (опасная зона)', () => {
    const plan = buildCycle01Plan({ acwr: { ratio: 1.6, zone: 'dangerous' } });
    // при ACWR deload taper не применяется (acwrDeload=true)
    expect(plan.progressionRationale).not.toContain('Taper');
  });

  it('Taper не применяется для faithful (explicit weeks)', () => {
    const week2Layout = CYCLE_01.week1.map(day => ({
      exercises: day.exercises.map(ex => ({ ...ex, sets: ex.sets.map(s => ({ ...s, pct: s.pct * 1.02 })) })),
    }));
    const faithfulTpl: SRCycleTemplate = { ...CYCLE_01, meta: { ...CYCLE_01.meta, sourceWeeks: false }, weeks: [CYCLE_01.week1, week2Layout] };
    const plan = buildLMSPlan({ template: faithfulTpl, pmMap, fallbackPm: 80 });
    // 2-недельный план < 4 нед → taper не применяется
    expect(plan.progressionRationale).not.toContain('Taper');
  });

  // ── P3: Recovery multiplier ──

  it('Recovery multiplier: хорошие метрики → упоминание в rationale', () => {
    const plan = buildCycle01Plan({
      bodyFat: 15, leanMass: 80, hrvMs: 75, sleepHours: 8, stressLevel: 2,
    });
    expect(plan.progressionRationale).toContain('Recovery multiplier');
    expect(plan.progressionRationale).toContain('×1.');
  });

  it('Recovery multiplier: плохой сон → множитель < 1', () => {
    const plan = buildCycle01Plan({
      bodyFat: 30, hrvMs: 30, sleepHours: 4, stressLevel: 8,
    });
    expect(plan.progressionRationale).toContain('Recovery multiplier');
    // множитель должен быть < 1 (плохие метрики)
    expect(plan.progressionRationale).toContain('×0.');
  });

  it('Recovery multiplier отсутствует если метрики не переданы', () => {
    const plan = buildCycle01Plan();
    expect(plan.progressionRationale).not.toContain('Recovery multiplier');
  });
});

// ── pmProgression ──
describe('pmProgression', () => {
  it('week 1 = pm0 (без роста)', () => {
    const result = pmProgression({ pm0: 100, weeks: 8, mode: 'natural' });
    expect(result[0]).toBe(100);
  });

  it('натуральный режим: +0.5%/нед', () => {
    const result = pmProgression({ pm0: 100, weeks: 8, mode: 'natural' });
    expect(result[7]).toBeCloseTo(100 * Math.pow(1.005, 7), 0);
  });

  it('on_course moderate: ~+2%/нед', () => {
    const result = pmProgression({ pm0: 100, weeks: 4, mode: 'on_course', courseIntensity: 'moderate' });
    expect(result[3]).toBeCloseTo(100 * Math.pow(1.02, 3), 0);
  });

  it('PCT: −0.5%/нед', () => {
    const result = pmProgression({ pm0: 100, weeks: 4, mode: 'pct' });
    expect(result[3]).toBeCloseTo(100 * Math.pow(0.995, 3), 0);
  });

  it('weeklyPercent override', () => {
    const result = pmProgression({ pm0: 100, weeks: 4, mode: 'natural', weeklyPercent: 0.01 });
    expect(result[3]).toBeCloseTo(100 * Math.pow(1.01, 3), 0);
  });

  it('rejects invalid PM and progression inputs', () => {
    expect(() => pmProgression({ pm0: 0, weeks: 4, mode: 'natural' })).toThrow('pm0 must be > 0');
    expect(() => pmProgression({ pm0: 100, weeks: 4, mode: 'natural', weeklyPercent: -1 })).toThrow('greater than -100%');
    expect(() => pmProgression({ pm0: 100, weeks: -1, mode: 'natural' })).toThrow('weeks must be >= 0');
    expect(() => progressionRationale({ pm0: 100, weeks: 0, mode: 'natural' })).toThrow('weeks must be >= 1');
  });

  it('uses descending wording for PCT rationale', () => {
    expect(progressionRationale({ pm0: 100, weeks: 4, mode: 'pct' })).toContain('PM снижается');
  });

  it('rejects invalid builder week overrides and progression rates', () => {
    expect(() => buildLMSPlan({ template: CYCLE_01, pmMap, weeksOverride: Number.NaN })).toThrow('weeksOverride');
    expect(() => buildLMSPlan({ template: CYCLE_01, pmMap, weeklyPercent: -1 })).toThrow('weeklyPercent');
    expect(() => buildLMSPlan({ template: CYCLE_01, pmMap, weeksOverride: 0 })).toThrow('weeksOverride');
  });

  it('validates sets in explicit weeks, not only week1', () => {
    const explicit = {
      ...CYCLE_01,
      weeks: [CYCLE_01.week1, [{ ...CYCLE_01.week1[0], exercises: [{ ...CYCLE_01.week1[0].exercises[0], sets: [{ pct: 0, reps: 5, sets: 3 }] }] }]],
    };
    expect(() => buildLMSPlan({ template: explicit, pmMap })).toThrow('explicit week 2');
  });

  it('rejects empty exercise names and invalid readiness', () => {
    const emptyName = {
      ...CYCLE_01,
      week1: [{ ...CYCLE_01.week1[0], exercises: [{ ...CYCLE_01.week1[0].exercises[0], name: '   ' }] }],
    };
    expect(() => buildLMSPlan({ template: emptyName, pmMap })).toThrow('exercise name');
    expect(() => buildLMSPlan({ template: CYCLE_01, pmMap, currentReadiness: Number.NaN })).toThrow('currentReadiness');
  });

  it('ignores invalid PM map values and uses fallback', () => {
    const plan = buildLMSPlan({ template: CYCLE_01, pmMap: { 'Присед': Number.NaN, 'Жим лежа': -10 }, fallbackPm: 90, weeksOverride: 1 });
    const exercise = plan.weeks[0].days.flatMap(day => day.exercises).find(ex => ex.name === 'Присед');
    expect(exercise?.pm).toBe(90);
  });

  it('prefers the most specific PM fuzzy match', () => {
    const template = {
      ...CYCLE_01,
      meta: { ...CYCLE_01.meta, sourceWeeks: false },
      weeks: undefined,
      week1: CYCLE_01.week1.map(day => ({
        ...day,
        exercises: day.exercises.map(ex => ex.name === 'Жим лежа'
          ? { ...ex, name: 'Жим лежа узким хватом' }
          : ex),
      })),
    };
    const plan = buildLMSPlan({
      template,
      pmMap: { 'Жим': 80, 'Жим лежа узким хватом': 120 },
      fallbackPm: 90,
      weeksOverride: 1,
    });
    const exercise = plan.weeks[0].days.flatMap(day => day.exercises)
      .find(ex => ex.name === 'Жим лежа узким хватом');
    expect(exercise?.pm).toBe(120);
  });

  it('pmForWeek: единичная неделя', () => {
    expect(pmForWeek({ pm0: 200, weeks: 12, mode: 'natural' }, 5))
      .toBeCloseTo(200 * Math.pow(1.005, 4), 0);
  });
});

// ── workWeight ──
describe('workWeight', () => {
  it('workWeight = PM × pct (с точностью до десятых)', () => {
    const w = workWeight(137, 0.68);
    expect(w).toBeCloseTo(137 * 0.68, 1);
  });
});

// ── lmsPlanToSessions ──
describe('lmsPlanToSessions', () => {
  it('конвертирует план в сессии', () => {
    const plan = buildCycle01Plan();
    const sessions = lmsPlanToSessions(plan);
    expect(sessions.length).toBe(12 * 3); // 12 недель × 3 дня
  });

  it('focus содержит номер дня (Нед1 День1)', () => {
    const plan = buildCycle01Plan({ weeksOverride: 1 });
    const sessions = lmsPlanToSessions(plan);
    expect(sessions[0].focus).toMatch(/Нед1 День1/);
    expect(sessions[1].focus).toMatch(/Нед1 День2/);
    expect(sessions[2].focus).toMatch(/Нед1 День3/);
  });

  it('totalReps > 0', () => {
    const plan = buildCycle01Plan({ weeksOverride: 1 });
    const sessions = lmsPlanToSessions(plan);
    for (const s of sessions) {
      expect(s.totalReps).toBeGreaterThan(0);
    }
  });

  it('каждый set имеет weight > 0 и RPE = 10 - RIR', () => {
    const plan = buildCycle01Plan({ weeksOverride: 1 });
    const sessions = lmsPlanToSessions(plan);
    for (const s of sessions) {
      for (const ex of s.exercises) {
        for (const set of ex.sets) {
          expect(set.weightKg).toBeGreaterThan(0);
          expect(set.rpe + set.rir).toBe(10);
        }
      }
    }
  });

  it('source = SRC', () => {
    const plan = buildCycle01Plan({ weeksOverride: 1 });
    const sessions = lmsPlanToSessions(plan);
    for (const s of sessions) {
      expect(s.source).toBe('SRC');
    }
  });

  it('weekNumber корректен', () => {
    const plan = buildCycle01Plan({ weeksOverride: 1 });
    const sessions = lmsPlanToSessions(plan);
    expect(sessions[0].weekNumber).toBe(1);
  });

  it('сохраняет фазу макроцикла в bridge-сессиях', () => {
    const plan = buildLMSPlan({ template: CYCLE_01, pmMap, fallbackPm: 80, weeksOverride: 2 });
    plan.weeks[0].macroPhase = 'strength';
    const sessions = lmsPlanToSessions(plan);
    expect(sessions[0].macroPhase).toBe('strength');
  });
});
