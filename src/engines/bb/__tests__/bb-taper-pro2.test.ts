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
