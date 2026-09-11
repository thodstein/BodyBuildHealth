/**
 * bb-taper-pro2.test.ts — PRO-2 (docs/BB-TAPER-PRO-2.md): гейт манипуляций,
 * персональная доза загрузки, fiber/NaK/вода, last-hard, recovery-трек,
 * post-show лог, diet-break. Back-compat: существующие тесты не тронуты.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildBBContestPrepPlan,
  buildPeakWeek,
  nutritionTargetsForPrepDate,
  manipulationLockedFor,
  applyManipulationGate,
  manipulationLockNote,
  trialCarbDoseGPerKg,
  lastHardDayForMuscle,
  TAPER_VS_DELOAD_NOTE,
  postShowReverseDiet,
  postShowRecoveryDiet,
  activePostShowCurve,
  prepDietBreaks,
  isPrepDietBreakDay,
  prepRefeedDates,
  isPrepRefeedDay,
  configFromPlan,
  peakFamilyOf,
  dominantPeakFamily,
  LAST_HARD_DN,
  applyPeakWeekOverlayToBBPlan,
  CATEGORY_PROFILES,
  type BBContestPrepConfig,
  type TestPeakWeekResult,
} from '../bb-contest-prep.engine';
import {
  getPostShowLog,
  savePostShowEntry,
  removePostShowEntry,
  postShowRecoveryMarkers,
  postShowComedownNotes,
  POST_SHOW_LOG_KEY,
} from '../bb-prep-post-show-log.engine';

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function baseConfig(over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig {
  return {
    sex: 'male',
    category: 'mens_physique',
    weightKg: 80,
    bodyFatPct: 7,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 2,
    showDate: addDaysIso(todayIso(), 120),
    weeksOut: 2,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'stable',
    sodiumStrategy: 'stable',
    ...over,
  };
}

function mkTrial(over: Partial<TestPeakWeekResult['responses']> = {}, delta = 0): TestPeakWeekResult {
  return {
    id: 't1', planId: 'p1', createdAt: new Date().toISOString(), showDate: addDaysIso(todayIso(), 100),
    responses: { carbTolerance: 3, digestion: 3, fullness: 3, waterRetention: 3, pump: 3, sleep: 3, ...over },
    weightDeltaKg: delta, verdict: 'conservative', recommendation: '',
  };
}

beforeEach(() => {
  try { localStorage.removeItem(POST_SHOW_LOG_KEY); } catch { /* noop */ }
});

// ── P1: гейт ──
describe('PRO-2 P1 — гейт high water', () => {
  it('high без trial и confirm — locked, гейт возвращает stable', () => {
    const cfg = baseConfig({ waterStrategy: 'high' });
    expect(manipulationLockedFor(cfg)).toBe(true);
    expect(applyManipulationGate(cfg).waterStrategy).toBe('stable');
    expect(manipulationLockNote(cfg)).toMatch(/🔒/);
  });
  it('high с trial — не locked; high с confirm — не locked', () => {
    expect(manipulationLockedFor(baseConfig({ waterStrategy: 'high', hasTrialPeak: true }))).toBe(false);
    expect(manipulationLockedFor(baseConfig({ waterStrategy: 'high', confirmedManipulation: true }))).toBe(false);
    expect(manipulationLockNote(baseConfig({ waterStrategy: 'stable' }))).toBe(null);
  });
  it('tapered вода/натрий — warning-only, не locked (back-compat движка)', () => {
    const cfg = baseConfig({ waterStrategy: 'tapered', sodiumStrategy: 'tapered' });
    expect(manipulationLockedFor(cfg)).toBe(false);
    expect(applyManipulationGate(cfg)).toBe(cfg);
    // движок строит tapered без trial как раньше
    expect(buildPeakWeek(cfg).length).toBe(7);
  });
});

// ── P2: доза ──
describe('PRO-2 P2 — персональная доза загрузки', () => {
  it('доза в коридоре категории; spill → низ, flat → верх', () => {
    const [lo, hi] = CATEGORY_PROFILES.mens_physique.carbTotalBudgetGPerKg;
    const spill = trialCarbDoseGPerKg(mkTrial({ waterRetention: 1, fullness: 5 }, 2.5), 'mens_physique', 'male');
    const flat = trialCarbDoseGPerKg(mkTrial({ waterRetention: 5, fullness: 1 }, 0.5), 'mens_physique', 'male');
    expect(spill).toBe(lo);
    expect(flat).toBe(hi);
    expect(spill).toBeLessThan(flat);
  });
  it('без trial — середина коридора; buildPeakWeek с дозой меняет load-бюджет', () => {
    const [lo, hi] = CATEGORY_PROFILES.mens_physique.carbTotalBudgetGPerKg;
    expect(trialCarbDoseGPerKg(null, 'mens_physique', 'male')).toBeCloseTo((lo + hi) / 2, 5);
    const cfg = baseConfig();
    const plain = buildPeakWeek(cfg);
    const dosed = buildPeakWeek(cfg, { carbDoseGPerKg: lo });
    const sum = (days: typeof plain) => days.filter(d => d.phase.startsWith('load')).reduce((a, d) => a + d.carbsG, 0);
    expect(sum(dosed)).toBeLessThanOrEqual(sum(plain));
    expect(sum(dosed)).toBe(Math.round(80 * lo));
  });
  it('доза клампится коридором (вне — не вылетает)', () => {
    const [lo, hi] = CATEGORY_PROFILES.bikini.carbTotalBudgetGPerKg;
    expect(trialCarbDoseGPerKg(mkTrial({ waterRetention: 5, fullness: 1 }, 0), 'bikini', 'female')).toBe(hi);
    const dosed = buildPeakWeek(baseConfig({ sex: 'female', category: 'bikini', weightKg: 55 }), { carbDoseGPerKg: 99 });
    const total = dosed.filter(d => d.phase.startsWith('load')).reduce((a, d) => a + d.carbsG, 0);
    expect(total).toBeLessThanOrEqual(Math.round(55 * hi));
    expect(total).toBeGreaterThanOrEqual(Math.round(55 * lo) - dosed.length);
  });
});

// ── P3: фибра/Na/вода/калий ──
describe('PRO-2 P3 — fiber-curve + Na×K + кап воды', () => {
  it('фибра: деплеция 20, загрузка/пик 10–13, шоу ≤10', () => {
    const days = buildPeakWeek(baseConfig());
    for (const d of days) {
      if (d.phase.startsWith('deplete')) expect(d.fiberMaxG).toBe(20);
      else if (d.phase === 'show') expect(d.fiberMaxG).toBeLessThanOrEqual(10);
      else expect(d.fiberMaxG).toBeGreaterThanOrEqual(10);
    }
    const loads = days.filter(d => d.phase.startsWith('load'));
    for (const d of loads) expect(d.fiberMaxG).toBeLessThanOrEqual(13);
  });
  it('tapered натрий на load-днях ≥2200 (SGLT1-guard), калий не падает', () => {
    const days = buildPeakWeek(baseConfig({ sodiumStrategy: 'tapered' }));
    for (const d of days.filter(x => x.phase.startsWith('load'))) {
      expect(d.sodiumMg).toBeGreaterThanOrEqual(2200);
    }
    expect(days[6].potassiumMg).toBe(days[0].potassiumMg);
  });
  it('high-вода с trial+confirm: база ≤8 л (кап PRO-2)', () => {
    const days = buildPeakWeek(baseConfig({ waterStrategy: 'high', hasTrialPeak: true, confirmedManipulation: true }));
    expect(days[0].waterLiters).toBeLessThanOrEqual(8);
    expect(days[0].waterLiters).toBeGreaterThan(4);
  });
  it('калий в живых целях — по полу (Ж 3500 / М 4000)', () => {
    const base = { kcal: 2600, proteinG: 170, fatG: 65, carbsG: 300, waterMl: 3000, sodiumMg: 2800 };
    const mPlan = buildBBContestPrepPlan(baseConfig({ weightKg: 80 }), { prepWeeks: 8, taperWeeks: 2 });
    const fPlan = buildBBContestPrepPlan(baseConfig({ sex: 'female', category: 'bikini', weightKg: 58 }), { prepWeeks: 8, taperWeeks: 2 });
    expect(nutritionTargetsForPrepDate(mPlan.phases[0].dateStart, mPlan, base).potassiumMg).toBe(4000);
    expect(nutritionTargetsForPrepDate(fPlan.phases[0].dateStart, fPlan, base).potassiumMg).toBe(3500);
  });
});

// ── P4: last-hard ──
describe('PRO-2 P4 — last-hard по группам', () => {
  it('ноги D-6 раньше верха D-4, руки только памп D-2', () => {
    expect(lastHardDayForMuscle('quads')).toMatch(/D-6/);
    expect(lastHardDayForMuscle('back')).toMatch(/D-5/);
    expect(lastHardDayForMuscle('chest')).toMatch(/D-4/);
    expect(lastHardDayForMuscle('biceps')).toMatch(/D-2/);
    expect(lastHardDayForMuscle('неизвестно')).toMatch(/D-4/);
  });
  it('explainer тапер≠делод — строка про ≥85%', () => {
    expect(TAPER_VS_DELOAD_NOTE).toMatch(/85%/);
    expect(TAPER_VS_DELOAD_NOTE).toMatch(/Делод/);
  });
});

// ── P5: recovery ──
describe('PRO-2 P5 — recovery-трек дефолтом', () => {
  it('recovery нед 1 = maintenance (выше дефицита), монотонна, кап +300', () => {
    const plan = buildBBContestPrepPlan(baseConfig({ weightKg: 80 }), { prepWeeks: 8, taperWeeks: 2 });
    expect(plan.postShowTrack).toBe('recovery');
    const curve = postShowRecoveryDiet(plan);
    expect(curve).toHaveLength(4);
    expect(curve[0].kcal).toBeGreaterThan(plan.preparation.currentCalories);
    for (let i = 1; i < curve.length; i++) expect(curve[i].kcal).toBeGreaterThanOrEqual(curve[i - 1].kcal);
    expect(curve[3].kcal - curve[0].kcal).toBeLessThanOrEqual(300);
    expect(curve[0].note).toMatch(/Recovery/);
  });
  it('recovery нед 1 ≥ reverse нед 1 (сразу maintenance), reverse opt-in жив', () => {
    const plan = buildBBContestPrepPlan(baseConfig({ weightKg: 80 }), { prepWeeks: 8, taperWeeks: 2 });
    const rec = postShowRecoveryDiet(plan)[0];
    const rev = postShowReverseDiet(plan)[0];
    expect(rec.kcal).toBeGreaterThanOrEqual(rev.kcal);
    const revPlan = buildBBContestPrepPlan(baseConfig({ weightKg: 80 }), { prepWeeks: 8, taperWeeks: 2, postShowTrack: 'reverse' });
    expect(revPlan.postShowTrack).toBe('reverse');
    expect(activePostShowCurve(revPlan)[0].kcal).toBe(rev.kcal);
    expect(activePostShowCurve(plan)[0].kcal).toBe(rec.kcal);
  });
  it('живые цели post-show: дефолт recovery, opts.reverse — reverse', () => {
    const base = { kcal: 2600, proteinG: 170, fatG: 65, carbsG: 300, waterMl: 3000, sodiumMg: 2800 };
    const plan = buildBBContestPrepPlan(baseConfig({ weightKg: 80 }), { prepWeeks: 8, taperWeeks: 2 });
    const postDay = addDaysIso(plan.showDate, 3);
    const def = nutritionTargetsForPrepDate(postDay, plan, base);
    const rev = nutritionTargetsForPrepDate(postDay, plan, base, { postShowTrack: 'reverse' });
    expect(def.note).toMatch(/recovery/);
    expect(rev.note).toMatch(/reverse/);
    expect(def.kcal).toBeGreaterThan(plan.preparation.currentCalories);
  });
});

// ── P6: post-show лог ──
describe('PRO-2 P6 — лог восстановления', () => {
  it('CRUD по неделям, битый стор → []', () => {
    expect(getPostShowLog('p1')).toEqual([]);
    savePostShowEntry('p1', { week: 2, dateIso: '2026-10-10', weightKg: 82, sleepH: 7.5, hunger1_5: 2, cycle: 'na', strengthReturnPct: 96 });
    savePostShowEntry('p1', { week: 2, dateIso: '2026-10-11', weightKg: 82.5 });
    const list = getPostShowLog('p1');
    expect(list).toHaveLength(1);
    expect(list[0].weightKg).toBe(82.5);
    expect(removePostShowEntry('p1', 2)).toEqual([]);
  });
  it('маркеры: 5/5 при полном восстановлении; вес-гейт +5% stage', () => {
    const m = postShowRecoveryMarkers(
      { week: 3, dateIso: '2026-10-20', weightKg: 84, sleepH: 8, hunger1_5: 2, cycle: 'na', strengthReturnPct: 98 },
      80,
    );
    expect(m.allRecovered).toBe(true);
    expect(m.recoveredCount).toBe(5);
    const low = postShowRecoveryMarkers(
      { week: 1, dateIso: '2026-10-05', weightKg: 80.5, sleepH: 6, hunger1_5: 5, cycle: 'absent', strengthReturnPct: 80 },
      80,
    );
    expect(low.allRecovered).toBe(false);
    expect(low.weightRegained).toBe(false);
  });
  it('comedown-памятка без доз, с врачом', () => {
    const notes = postShowComedownNotes();
    expect(notes.length).toBeGreaterThanOrEqual(4);
    expect(notes.join(' ')).toMatch(/врач/);
    expect(notes.join(' ')).not.toMatch(/\d+\s*мг/);
  });
});

// ── P7: diet-break ──
describe('PRO-2 P7 — diet-break длинного препа', () => {
  it('преп <16 нед — брейков нет; ≥16 — окна по 7 дней каждые 8 нед', () => {
    const short = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 12, taperWeeks: 2 });
    expect(prepDietBreaks(short)).toEqual([]);
    const long = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 20, taperWeeks: 2 });
    const breaks = prepDietBreaks(long);
    expect(breaks).toHaveLength(14); // нед 8 и 16
    expect(isPrepDietBreakDay(breaks[0], long)).toBe(true);
    expect(isPrepDietBreakDay(long.preparation.startDate, long)).toBe(false);
  });
  it('брейк-день: maintenance + пометка; не считается рефидом', () => {
    const base = { kcal: 2600, proteinG: 170, fatG: 65, carbsG: 300, waterMl: 3000, sodiumMg: 2800 };
    const long = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 20, taperWeeks: 2 });
    const bday = prepDietBreaks(long)[0];
    const t = nutritionTargetsForPrepDate(bday, long, base);
    expect(t.kcal).toBeGreaterThanOrEqual(base.kcal);
    expect(t.note).toMatch(/Diet break/);
    expect(isPrepRefeedDay(bday, long)).toBe(false);
    // календарь рефидов не содержит брейк-дней
    for (const d of prepRefeedDates(long)) expect(isPrepDietBreakDay(d, long)).toBe(false);
  });
});

// ── Доводка: доза в сборке, трек при пересборке, таблица с брейками, экспорт лога ──
describe('PRO-2 доводка — доза едет в план и питание', () => {
  it('buildBBContestPrepPlan хранит дозу; пик-день отражает dosed-бюджет', () => {
    const [lo] = CATEGORY_PROFILES.mens_physique.carbTotalBudgetGPerKg;
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2, carbDoseGPerKg: lo });
    expect(plan.peakWeek.carbDoseGPerKg).toBe(lo);
    const base = { kcal: 2600, proteinG: 170, fatG: 65, carbsG: 300, waterMl: 3000, sodiumMg: 2800 };
    const peakStart = plan.phases.find(p => p.key === 'peak_week')!.dateStart;
    const t = nutritionTargetsForPrepDate(peakStart, plan, base);
    expect(t.phase).toBe('deplete_1');
    // полный load-бюджет дня пика = доза × вес (деплеция не входит, проверяем через buildPeakWeek)
    const dosed = buildPeakWeek(configFromPlan(plan), { carbDoseGPerKg: lo });
    const sum = dosed.filter(d => d.phase.startsWith('load')).reduce((a, d) => a + d.carbsG, 0);
    expect(sum).toBe(Math.round(80 * lo));
    expect(t.carbsG).toBe(dosed[0].carbsG);
  });
  it('без дозы план хранит undefined и идёт по коридору (back-compat)', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2 });
    expect(plan.peakWeek.carbDoseGPerKg).toBe(undefined);
  });
  it('buildBBContestPrep с дозой: rationale + dosed-бюджет', async () => {
    const { buildBBContestPrep } = await import('../bb-contest-prep.engine');
    const [lo] = CATEGORY_PROFILES.mens_physique.carbTotalBudgetGPerKg;
    const res = buildBBContestPrep(baseConfig(), { carbDoseGPerKg: lo });
    expect(res.rationale.join(' ')).toMatch(/Доза trial/);
    const sum = res.peakWeek.filter(d => d.phase.startsWith('load')).reduce((a, d) => a + d.carbsG, 0);
    expect(sum).toBe(Math.round(80 * lo));
  });
});

describe('PRO-2 доводка — трек хранится в плане', () => {
  it('reverse opt-in переживает чтение живого рациона из плана', () => {
    const base = { kcal: 2600, proteinG: 170, fatG: 65, carbsG: 300, waterMl: 3000, sodiumMg: 2800 };
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2, postShowTrack: 'reverse' });
    expect(plan.postShowTrack).toBe('reverse');
    const postDay = addDaysIso(plan.showDate, 10);
    // без opts — трек берётся из плана
    const t = nutritionTargetsForPrepDate(postDay, plan, base);
    expect(t.note).toMatch(/reverse/);
  });
});

describe('PRO-2 доводка — display-таблица знает брейки', () => {
  it('20 нед: нед 8 и 16 — Diet break без рефида; нед 3 — рефид', async () => {
    const { buildPrepNutritionPlan } = await import('../bb-prep-cycle.engine');
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 20, taperWeeks: 2 });
    const cfg = { category: 'mens_physique', sex: 'male', weightKg: 80 } as any;
    const table = buildPrepNutritionPlan(plan, cfg);
    const w8 = table.weeks.find(w => w.week === 8)!;
    const w16 = table.weeks.find(w => w.week === 16)!;
    const w3 = table.weeks.find(w => w.week === 3)!;
    expect(w8.note).toMatch(/Diet break/);
    expect(w8.refeed).toBe(false);
    expect(w16.note).toMatch(/Diet break/);
    expect(w16.refeed).toBe(false);
    expect(w3.refeed).toBe(true);
  });
  it('12 нед: брейков нет, рефиды как раньше (3/6/9 + финал)', async () => {
    const { buildPrepNutritionPlan } = await import('../bb-prep-cycle.engine');
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 12, taperWeeks: 2 });
    const cfg = { category: 'mens_physique', sex: 'male', weightKg: 80 } as any;
    const table = buildPrepNutritionPlan(plan, cfg);
    expect(table.weeks.some(w => w.note.includes('Diet break'))).toBe(false);
    expect(table.weeks.find(w => w.week === 3)!.refeed).toBe(true);
    expect(table.weeks.find(w => w.week === 6)!.refeed).toBe(true);
  });
});

describe('PRO-2 доводка — post-show лог в экспорте', () => {
  it('coach JSON несёт postShowLog; печать рисует секцию восстановления', async () => {
    const { buildPrepCoachJson, buildContestPrepPrintHtml } = await import('../bb-contest-prep.engine');
    const plan = buildBBContestPrepPlan(baseConfig(), { prepWeeks: 8, taperWeeks: 2 });
    const log = [
      { week: 1 as const, dateIso: addDaysIso(plan.showDate, 7), weightKg: 82, sleepH: 7.5, hunger1_5: 2, cycle: 'na' as const, strengthReturnPct: 96 },
    ];
    const json = JSON.parse(buildPrepCoachJson(plan, { postShowLog: log }));
    expect(json.postShowLog).toHaveLength(1);
    expect(json.postShowLog[0].weightKg).toBe(82);
    // без лога — пустой массив, секция в печати отсутствует
    expect(JSON.parse(buildPrepCoachJson(plan)).postShowLog).toEqual([]);
    const html = buildContestPrepPrintHtml(plan, { postShowLog: log });
    expect(html).toContain('Восстановление post-show');
    expect(html).toContain('82');
    expect(buildContestPrepPrintHtml(plan)).not.toContain('Восстановление post-show');
  });
});

describe('PRO-2 P4-wire — last-hard в сессиях пик-недели', () => {
  it('семьи мышц и доминанта сессии', () => {
    expect(peakFamilyOf('quads')).toBe('legs');
    expect(peakFamilyOf('back_width')).toBe('back');
    expect(peakFamilyOf('delt_mid')).toBe('chest');
    expect(peakFamilyOf('biceps')).toBe('arms');
    expect(peakFamilyOf('неизвестно')).toBe(null);
    expect(peakFamilyOf('')).toBe(null);
    expect(LAST_HARD_DN).toEqual({ legs: 6, back: 5, chest: 4, arms: 0 });
    expect(dominantPeakFamily({ exercises: [{ muscle: 'quads' }, { muscle: 'hamstrings' }, { muscle: 'chest' }] })).toBe('legs');
    expect(dominantPeakFamily({ exercises: [] })).toBe(null);
  });
  it('ноги после D-6 и спина после D-5 уходят в отдых, грудь D-4 держится', () => {
    const mkSess = (muscle: string): any => ({
      day: 1, character: 'тяж',
      exercises: [{
        muscle, name: muscle, role: 'primary', character: 'тяж', sets: 4,
        repsRange: [8, 12] as [number, number], rir: 2,
        workSets: [{ reps: 10, rir: 2, weight: 60 }], comment: '',
      }],
    });
    const plan: any = {
      pattern: {}, rotationMuscleVolume: {}, rationale: [],
      weeks: [{
        week: 1, phase: 'accumulation', deload: false,
        sessions: [mkSess('quads'), mkSess('quads'), mkSess('back'), mkSess('chest'), mkSess('biceps'), mkSess('chest')],
      }],
    };
    const out = applyPeakWeekOverlayToBBPlan(plan, baseConfig(), { weekNumber: 1 });
    const ss = (out.weeks[0].sessions as any[]);
    // si0 DN6 ноги — тренируется; si1 DN5 ноги — отдых по last-hard
    expect(ss[0].exercises.length).toBeGreaterThan(0);
    expect(ss[1].exercises).toEqual([]);
    expect(ss[1].peakWeekLastHardRest).toBe(true);
    // si2 DN4 спина — отдых по last-hard; грудь на si3 — отдых по фазе (load), без флага
    expect(ss[2].exercises).toEqual([]);
    expect(ss[2].peakWeekLastHardRest).toBe(true);
    expect(ss[3].exercises).toEqual([]);
    expect(ss[3].peakWeekLastHardRest).toBe(undefined);
  });
  it('грудь и руки на ранних deplete-днях тренируются (памп)', () => {
    const mkSess = (muscle: string): any => ({
      day: 1, character: 'тяж',
      exercises: [{
        muscle, name: muscle, role: 'primary', character: 'тяж', sets: 4,
        repsRange: [8, 12] as [number, number], rir: 2,
        workSets: [{ reps: 10, rir: 2, weight: 40 }], comment: '',
      }],
    });
    const plan: any = {
      pattern: {}, rotationMuscleVolume: {}, rationale: [],
      weeks: [{
        week: 1, phase: 'accumulation', deload: false,
        sessions: [mkSess('chest'), mkSess('chest'), mkSess('biceps')],
      }],
    };
    const out = applyPeakWeekOverlayToBBPlan(plan, baseConfig(), { weekNumber: 1 });
    const ss = (out.weeks[0].sessions as any[]);
    expect(ss[0].exercises.length).toBeGreaterThan(0); // si0 DN6
    expect(ss[1].exercises.length).toBeGreaterThan(0); // si1 DN5, верх держится
    expect(ss[2].exercises.length).toBeGreaterThan(0); // si2 DN4, руки — памп
  });
});
