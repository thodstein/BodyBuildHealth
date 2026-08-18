/**
 * cardio-prep-engine.test.ts — кардио-движок ↔ contest prep ББ:
 * buildCardioCycleFromPrep (фазы/минуты/пол/HIIT-политика/taper-кривая),
 * syncPrepCardioMinutes, cardioPeakWeekFromPrep, cardioCyclePeriodAware,
 * cardioAnemiaSignals, cardioRedSFlag, applyCardioCompetitionCascade,
 * cardioAcwr, cardioRestingHrSignal, cardioFactHrAdjustment, prepCardioKcalAdvice,
 * cardioPrepCheckIn (контрольные замеры prep).
 */
import { describe, it, expect } from 'vitest';
import {
  buildCardioCycleFromPrep, syncPrepCardioMinutes, cardioPeakWeekFromPrep,
  cardioCyclePeriodAware, cardioAnemiaSignals, cardioRedSFlag,
  applyCardioCompetitionCascade, cardioAcwr, cardioRestingHrSignal,
  cardioFactHrAdjustment, prepCardioKcalAdvice, cardioPrepCheckIn, bbCardioTaperMult,
  BB_CARDIO_TAPER_CURVE, type CardioCycle, type CardioPrepPlanLike,
} from '../cardio.engine';

const vol = (c: CardioCycle, w: number) => {
  const week = c.weeks[w - 1];
  return week.sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
};

const prepFemale: CardioPrepPlanLike = {
  id: 'prep-f',
  showDate: '2026-09-15',
  category: 'bikini',
  sex: 'female',
  preparation: {
    startDate: '2026-06-01',
    weeks: 10,
    finalWeeks: 2,
    targetRatePctPerWeek: 0.5,
    startingWeightKg: 60,
    currentCalories: 1400,
    stepsPerDay: 9000,
    cardioMinutesPerWeek: 120,
  },
  taper: { enabled: true, weeks: 2 },
  peakWeek: { enabled: true },
  phases: [
    { key: 'preparation', weekStart: 1, weekEnd: 8, dateStart: '2026-06-01', dateEnd: '2026-07-26' },
    { key: 'final_preparation', weekStart: 9, weekEnd: 10, dateStart: '2026-07-27', dateEnd: '2026-08-09' },
    { key: 'taper', weekStart: 11, weekEnd: 12, dateStart: '2026-08-10', dateEnd: '2026-08-23' },
    { key: 'peak_week', weekStart: 13, weekEnd: 13, dateStart: '2026-08-24', dateEnd: '2026-08-30' },
    { key: 'post_show', weekStart: 14, weekEnd: 15, dateStart: '2026-08-31', dateEnd: '2026-09-13' },
  ],
};

const prepMale: CardioPrepPlanLike = {
  ...prepFemale,
  id: 'prep-m',
  category: 'mens_bb',
  sex: 'male',
  preparation: { ...prepFemale.preparation, startingWeightKg: 88, currentCalories: 2600 },
};

describe('bbCardioTaperMult — единая taper-кривая', () => {
  it('кривая 0.6/0.7/0.85/0.9 и клампы', () => {
    expect(BB_CARDIO_TAPER_CURVE).toEqual({ 1: 0.6, 2: 0.7, 3: 0.85, 4: 0.9 });
    expect(bbCardioTaperMult(1)).toBe(0.6);
    expect(bbCardioTaperMult(2)).toBe(0.7);
    expect(bbCardioTaperMult(3)).toBe(0.85);
    expect(bbCardioTaperMult(4)).toBe(0.9);
    expect(bbCardioTaperMult(0)).toBe(0.6);
    expect(bbCardioTaperMult(9)).toBe(0.9);
    expect(bbCardioTaperMult(2.6)).toBe(0.85);
  });
});

describe('buildCardioCycleFromPrep — цикл из prep-плана', () => {
  it('женщина bikini: 15 нед (10 prep + 2 taper + пик + 2 post-show), БЕЗ HIIT/MISS', () => {
    const c = buildCardioCycleFromPrep(prepFemale, { daysAvailable: 7 })!;
    expect(c).not.toBeNull();
    expect(c.totalWeeks).toBe(15);
    expect(c.weeks).toHaveLength(15);
    expect(c.goal).toBe('bb_prep');
    for (const w of c.weeks) {
      for (const s of w.sessions) expect(s.type).not.toBe('hiit');
      for (const s of w.sessions) expect(s.type).not.toBe('miss');
    }
  });

  it('фазы: база 1-5 → build 6-10 → финальная ×0.9 (9-10) → taper → peak → post-show', () => {
    const c = buildCardioCycleFromPrep(prepFemale, { daysAvailable: 7 })!;
    expect(c.weeks[0].phase).toBe('base');
    expect(c.weeks[5].phase).toBe('build');
    expect(c.weeks[8].phase).toBe('contest_prep');
    expect(c.weeks[9].phase).toBe('contest_prep');
    expect(c.weeks[10].phase).toBe('taper');
    expect(c.weeks[11].phase).toBe('taper');
    expect(c.weeks[12].phase).toBe('peak');
    expect(c.weeks[13].phase).toBe('transition');
    expect(c.weeks[14].phase).toBe('transition');
    expect(c.weeks[12].sessions.every(s => s.type === 'recovery')).toBe(true);
  });

  it('taper: объём падает по кривой (неделя 12 ≈ ×0.6 от prep-минут)', () => {
    const c = buildCardioCycleFromPrep(prepFemale, { daysAvailable: 7 })!;
    const v11 = vol(c, 11), v12 = vol(c, 12);
    expect(v12).toBeLessThan(v11);
    expect(v12 / v11).toBeGreaterThan(0.7);
    expect(v12 / v11).toBeLessThan(1);
  });

  it('мужчина mens_bb: HIIT (чётные) / MISS (нечётные) на build-неделях 6-8, финальные 9-10 без интенсивного', () => {
    const c = buildCardioCycleFromPrep(prepMale, { daysAvailable: 7 })!;
    expect(c.weeks.slice(0, 5).every(w => !w.sessions.some(s => s.type === 'hiit' || s.type === 'miss'))).toBe(true);
    expect(c.weeks[5].sessions.some(s => s.type === 'hiit')).toBe(true);
    expect(c.weeks[6].sessions.some(s => s.type === 'miss')).toBe(true);
    expect(c.weeks[7].sessions.some(s => s.type === 'hiit')).toBe(true);
    expect(c.weeks[8].sessions.every(s => s.type !== 'miss' && s.type !== 'hiit')).toBe(true);
    expect(c.weeks[9].sessions.every(s => s.type !== 'miss' && s.type !== 'hiit')).toBe(true);
  });

  it('без phases: fallback-маппинг даёт те же границы (13 нед), post-show нет', () => {
    const noPhases: CardioPrepPlanLike = { ...prepFemale, phases: undefined };
    const c = buildCardioCycleFromPrep(noPhases, { daysAvailable: 7 })!;
    expect(c.totalWeeks).toBe(13);
    expect(c.weeks[10].phase).toBe('taper');
    expect(c.weeks[12].phase).toBe('peak');
  });

  it('daysAvailable 3: частота сессий ≤ 3', () => {
    const c = buildCardioCycleFromPrep(prepFemale, { daysAvailable: 3 })!;
    for (const w of c.weeks) {
      const freq = w.sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
      expect(freq).toBeLessThanOrEqual(3);
    }
  });

  it('конфиг: цель bb_prep, вес из prep, taperWeeks, peakWeek, пол', () => {
    const c = buildCardioCycleFromPrep(prepFemale, { daysAvailable: 7 })!;
    expect(c.config.goal).toBe('bb_prep');
    expect(c.config.bodyWeight).toBe(60);
    expect(c.config.sex).toBe('female');
    expect(c.config.taperWeeks).toBe(2);
    expect(c.config.peakWeek).toBe(true);
  });

  it('opts.age → целевые пульс-зоны в сессиях', () => {
    const c = buildCardioCycleFromPrep(prepFemale, { age: 30, restingHr: 60, daysAvailable: 7 })!;
    expect(c.weeks[0].sessions.some(s => s.targetHr && s.targetHr.min && s.targetHr.max)).toBe(true);
  });

  it('rationale содержит категорию и минуты', () => {
    const c = buildCardioCycleFromPrep(prepFemale, { daysAvailable: 7 })!;
    expect(c.rationale.join(' ')).toMatch(/bikini/);
    expect(c.rationale.join(' ')).toMatch(/120 мин\/нед/);
  });
});

describe('syncPrepCardioMinutes — фактический объём обратно в prep', () => {
  it('среднее по рабочим неделям записывается в prep (clamp 20-600)', () => {
    const c = buildCardioCycleFromPrep(prepFemale, { daysAvailable: 7 })!;
    const next = syncPrepCardioMinutes(prepFemale, c)!;
    const work = c.weeks.filter(w => w.phase === 'base' || w.phase === 'build' || w.phase === 'contest_prep');
    const avg = Math.round(work.reduce((s, w) => s + w.totalMinutes, 0) / work.length);
    expect(next.preparation.cardioMinutesPerWeek).toBe(Math.max(20, Math.min(600, avg)));
  });

  it('без изменений → null (идемпотентно)', () => {
    const c = buildCardioCycleFromPrep(prepFemale, { daysAvailable: 7 })!;
    const next = syncPrepCardioMinutes(prepFemale, c)!;
    expect(syncPrepCardioMinutes(next, c)).toBeNull();
  });

  it('без prep/цикла → null', () => {
    expect(syncPrepCardioMinutes(null, null)).toBeNull();
  });
});

describe('cardioPeakWeekFromPrep — 7 дней пик-недели', () => {
  it('шаги по протоколу, кардио 20→15→10→0, день 7 ≤ 20', () => {
    const c = buildCardioCycleFromPrep(prepFemale, { daysAvailable: 7 })!;
    const days = cardioPeakWeekFromPrep(prepFemale, c);
    expect(days).toHaveLength(7);
    expect(days[0].steps).toBe(12000);
    expect(days[0].cardioMin).toBe(20);
    expect(days[4].cardioMin).toBe(15);
    expect(days[5].cardioMin).toBe(10);
    expect(days[6].cardioMin).toBeLessThanOrEqual(20);
    expect(days[6].steps).toBe(4000);
    expect(days[6].dateIso).toBe(prepFemale.showDate);
  });

  it('без showDate → []', () => {
    expect(cardioPeakWeekFromPrep({ ...prepFemale, showDate: '' }, null)).toEqual([]);
  });
});

describe('cardioCyclePeriodAware — менструальный цикл', () => {
  it('лютеиновая фаза: HIIT → zone2 ×1.5, MISS → zone2, прошлые недели не тронуты', () => {
    const c = buildCardioCycleFromPrep(prepMale, { daysAvailable: 7 })!;
    // недели 6 (07-06, день 17) и 7 (07-13, день 24) — лютеиновая; неделя 8 (07-20) — фолликулярная
    const r = cardioCyclePeriodAware(c, { lastPeriodStartIso: '2026-06-20', cycleLengthDays: 28 });
    expect(r.changes.length).toBe(2);
    expect(r.changes.map(ch => ch.week)).toEqual([6, 7]);
    const w6 = r.cycle.weeks[5];
    expect(w6.sessions.some(s => s.type === 'hiit')).toBe(false);
    expect(w6.sessions.some(s => s.type === 'zone2')).toBe(true);
    const w7 = r.cycle.weeks[6];
    expect(w7.sessions.some(s => s.type === 'miss')).toBe(false);
    expect(w7.sessions.some(s => s.type === 'zone2')).toBe(true);
    expect(r.cycle.weeks[7].sessions.some(s => s.type === 'hiit')).toBe(true);
  });

  it('идемпотентно: повторный вызов без изменений', () => {
    const c = buildCardioCycleFromPrep(prepMale, { daysAvailable: 7 })!;
    const r1 = cardioCyclePeriodAware(c, { lastPeriodStartIso: '2026-06-20' });
    const r2 = cardioCyclePeriodAware(r1.cycle, { lastPeriodStartIso: '2026-06-20' });
    expect(r2.changes).toEqual([]);
  });

  it('без даты начала цикла → без изменений', () => {
    const c = buildCardioCycleFromPrep(prepMale, { daysAvailable: 7 })!;
    const r = cardioCyclePeriodAware(c, undefined);
    expect(r.changes).toEqual([]);
    expect(r.notes[0]).toMatch(/не задан/);
  });
});

describe('cardioAnemiaSignals — анемия/железодефицит', () => {
  it('ферритин <30 → предупреждение', () => {
    const r = cardioAnemiaSignals({ ferritin: 20 }, 'female');
    expect(r.ferritinLow).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/Ферритин/);
    expect(r.volumeMult).toBe(1);
  });

  it('гемоглобин ниже порога пола → объём ×0.9', () => {
    const r = cardioAnemiaSignals({ hemoglobin: 110 }, 'female');
    expect(r.hbLow).toBe(true);
    expect(r.volumeMult).toBe(0.9);
    expect(cardioAnemiaSignals({ hemoglobin: 125 }, 'male').hbLow).toBe(true);
    expect(cardioAnemiaSignals({ hemoglobin: 125 }, 'female').hbLow).toBe(false);
  });

  it('гематокрит и здоровые показатели', () => {
    expect(cardioAnemiaSignals({ hct: 34 }, 'female').warnings.join(' ')).toMatch(/Гематокрит/);
    const ok = cardioAnemiaSignals({ ferritin: 60, hemoglobin: 140, hct: 42 }, 'male');
    expect(ok.warnings[0]).toBe('Анемия не обнаружена.');
    expect(ok.volumeMult).toBe(1);
  });

  it('без анализов — без предупреждений', () => {
    const r = cardioAnemiaSignals(null, 'female');
    expect(r.ferritinLow).toBe(false);
    expect(r.hbLow).toBe(false);
    expect(r.volumeMult).toBe(1);
  });
});

describe('cardioRedSFlag — энергетическая доступность', () => {
  it('женщина, EA <30 → флаг', () => {
    const low = { ...prepFemale, preparation: { ...prepFemale.preparation, currentCalories: 1200 } };
    const flag = cardioRedSFlag(low, { bodyFatPct: 25 });
    expect(flag).not.toBeNull();
    expect(flag).toMatch(/RED-S/);
  });

  it('женщина, EA ≥30 → null; мужчина → null; без веса → null', () => {
    const rich = { ...prepFemale, preparation: { ...prepFemale.preparation, currentCalories: 2000 } };
    expect(cardioRedSFlag(rich, { bodyFatPct: 25 })).toBeNull();
    expect(cardioRedSFlag(prepMale, { bodyFatPct: 20 })).toBeNull();
    const noWeight = { ...prepFemale, preparation: { ...prepFemale.preparation, startingWeightKg: 0 } };
    expect(cardioRedSFlag(noWeight, {})).toBeNull();
  });
});

describe('applyCardioCompetitionCascade — каскад стартов A/B/C', () => {
  it('A: неделя старта → recovery 20 мин; N-1 → −50% без HIIT/MISS; N-2 → −30% без HIIT', () => {
    const c = buildCardioCycleFromPrep(prepMale, { daysAvailable: 7 })!;
    const out = applyCardioCompetitionCascade(c, [{ week: 9, priority: 'A' }]);
    const w9 = out.weeks[8];
    expect(w9.phase).toBe('peak');
    expect(w9.sessions.every(s => s.type === 'recovery')).toBe(true);
    const w8 = out.weeks[7];
    expect(w8.sessions.some(s => s.type === 'hiit')).toBe(false);
    expect(w8.sessions.some(s => s.type === 'miss')).toBe(false);
    const v8 = vol(out, 8), v8b = vol(c, 8);
    expect(v8 / v8b).toBeLessThan(0.6);
    expect(out.rationale.some(r => r.includes('Каскад стартов ПЛ: A'))).toBe(true);
  });

  it('B: −30% без HIIT в окне 1 неделя; C: только неделя старта без HIIT', () => {
    const c = buildCardioCycleFromPrep(prepMale, { daysAvailable: 7 })!;
    // недели 11-13 в этом цикле — taper/peak (не трогаются каскадом): B ставим на 10
    const out = applyCardioCompetitionCascade(c, [{ week: 10, priority: 'B' }, { week: 14, priority: 'C' }]);
    const w10 = out.weeks[9];
    expect(w10.sessions.some(s => s.type === 'hiit')).toBe(false);
    expect(vol(out, 10) / vol(c, 10)).toBeLessThan(0.75);
    const w14 = out.weeks[13];
    expect(w14.sessions.some(s => s.type === 'hiit')).toBe(false);
    expect(w14.sessions.some(s => s.type === 'zone2')).toBe(true);
  });

  it('за пределами цикла отфильтрованы; вне окна недели не тронуты', () => {
    const c = buildCardioCycleFromPrep(prepMale, { daysAvailable: 7 })!;
    const out = applyCardioCompetitionCascade(c, [{ week: 99, priority: 'A' }]);
    expect(out.weeks.every((w, i) => w.sessions.length === c.weeks[i].sessions.length)).toBe(true);
    const out2 = applyCardioCompetitionCascade(c, [{ week: 1, priority: 'A' }]);
    expect(out2.weeks[0].sessions.every(s => s.type === 'recovery')).toBe(true);
  });

  it('идемпотентно: повторный каскад не режет снова', () => {
    const c = buildCardioCycleFromPrep(prepMale, { daysAvailable: 7 })!;
    const r1 = applyCardioCompetitionCascade(c, [{ week: 9, priority: 'A' }]);
    const r2 = applyCardioCompetitionCascade(r1, [{ week: 9, priority: 'A' }]);
    expect(r2.weeks[8].sessions.every(s => s.type === 'recovery')).toBe(true);
    expect(r2.weeks[7].sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0))
      .toBe(r1.weeks[7].sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0));
  });
});

describe('cardioAcwr — ACWR по дневнику кардио', () => {
  // Хроническое окно [ref−28д, ref−7д): 4 записи по 30 мин RPE5 → load 15 каждая,
  // хроническая нагрузка = 60/28×7 = 15.
  const chronic = [
    { date: '2026-07-18', durationMin: 30, rpe: 5 },
    { date: '2026-07-25', durationMin: 30, rpe: 5 },
    { date: '2026-08-01', durationMin: 30, rpe: 5 },
    { date: '2026-08-07', durationMin: 30, rpe: 5 },
  ];

  it('dangerous: резкий рост нагрузки', () => {
    const log = [
      ...chronic,
      { date: '2026-08-10', durationMin: 60, rpe: 9 },
      { date: '2026-08-12', durationMin: 60, rpe: 9 },
    ];
    const r = cardioAcwr(log, '2026-08-15')!;
    expect(r.zone).toBe('dangerous');
    expect(r.ratio).toBeGreaterThan(1.5);
  });

  it('caution / optimal / undertrained', () => {
    const caution = [
      ...chronic,
      { date: '2026-08-10', durationMin: 20, rpe: 5 },
      { date: '2026-08-12', durationMin: 20, rpe: 5 },
    ];
    expect(cardioAcwr(caution, '2026-08-15')!.zone).toBe('caution');
    const opt = [
      ...chronic,
      { date: '2026-08-10', durationMin: 30, rpe: 5 },
    ];
    expect(cardioAcwr(opt, '2026-08-15')!.zone).toBe('optimal');
    const under = [
      ...chronic,
      { date: '2026-08-10', durationMin: 20, rpe: 5 },
    ];
    expect(cardioAcwr(under, '2026-08-15')!.zone).toBe('undertrained');
  });

  it('недостаточно записей → null; невыполненные сессии исключаются', () => {
    expect(cardioAcwr([{ date: '2026-08-01', durationMin: 30 }], '2026-08-15')).toBeNull();
    const log = [
      ...chronic,
      { date: '2026-08-10', durationMin: 60, rpe: 9, completed: false },
    ];
    const r = cardioAcwr(log, '2026-08-15')!;
    expect(r.acuteLoad).toBe(0);
    expect(r.zone).toBe('undertrained');
  });
});

describe('cardioRestingHrSignal — ЧСС покоя', () => {
  it('рост >5% → warning', () => {
    const entries = [
      { date: '2026-08-05', hr: 58 },
      { date: '2026-08-07', hr: 59 },
      { date: '2026-08-10', hr: 62 },
      { date: '2026-08-12', hr: 63 },
      { date: '2026-08-14', hr: 62 },
    ];
    const r = cardioRestingHrSignal(entries, '2026-08-15');
    expect(r.deltaPct).toBeGreaterThan(5);
    expect(r.warning).toMatch(/ЧСС покоя/);
  });

  it('без данных → null-поля', () => {
    const r = cardioRestingHrSignal([], '2026-08-15');
    expect(r.avg7).toBeNull();
    expect(r.warning).toBeNull();
  });
});

describe('cardioFactHrAdjustment — факт-ЧСС против зон', () => {
  it('будущие недели получают зоны −5, прошедшие не тронуты', () => {
    const c = buildCardioCycleFromPrep(prepFemale, { age: 30, restingHr: 60, daysAvailable: 7 })!;
    const log = [
      { date: '2026-06-08', avgHr: 172 },
      { date: '2026-06-10', avgHr: 168 },
    ];
    const r = cardioFactHrAdjustment(c, log, '2026-06-01');
    expect(r.changes.length).toBeGreaterThan(0);
    const w1 = r.cycle.weeks[0];
    const w2 = r.cycle.weeks[1];
    expect(w1.sessions.every(s => !s.targetHr || s.targetHr.min === c.weeks[0].sessions.find(x => x.targetHr)?.targetHr?.min)).toBe(true);
    const z2 = w2.sessions.find(s => s.targetHr);
    expect(z2).toBeDefined();
    expect(z2!.targetHr!.min!).toBeLessThanOrEqual(c.weeks[1].sessions.find(s => s.targetHr)!.targetHr!.min!);
  });

  it('в пределах зон → без изменений', () => {
    const c = buildCardioCycleFromPrep(prepFemale, { age: 30, restingHr: 60, daysAvailable: 7 })!;
    const r = cardioFactHrAdjustment(c, [{ date: '2026-06-08', avgHr: 110 }], '2026-06-01');
    expect(r.changes).toEqual([]);
    expect(r.notes[0]).toMatch(/в пределах/);
  });
});

describe('prepCardioKcalAdvice — совет по динамике веса', () => {
  const cycle = () => buildCardioCycleFromPrep(prepFemale, { daysAvailable: 7 })!;
  // ref в рабочей неделе 5 (startDate 2026-06-01 + 4 нед = 2026-06-29..07-05),
  // чтобы taper-недели (11+) не срабатывали как guard.
  const ref = '2026-07-01';
  const mk = (rows: [string, number][]) => rows.map(([date, weightKg]) => ({ date, weightKg }));

  it('слишком быстро → reduce_cardio (одна переменная)', () => {
    const advice = prepCardioKcalAdvice(
      prepFemale,
      cycle(),
      mk([['2026-06-19', 62.5], ['2026-06-21', 62.0], ['2026-06-24', 60.5], ['2026-06-27', 60.1], ['2026-07-01', 59.8]]),
      ref,
    )!;
    expect(advice.action).toBe('reduce_cardio');
    expect(advice.reason).toMatch(/кардио −10%|калории \+150/);
    expect(advice.cardioAvgKcalPerWeek).toBeGreaterThan(0);
  });

  it('слишком медленно → increase_cardio', () => {
    const advice = prepCardioKcalAdvice(
      prepFemale,
      cycle(),
      mk([['2026-06-19', 62.0], ['2026-06-21', 61.9], ['2026-06-24', 61.9], ['2026-06-27', 61.9], ['2026-07-01', 61.9]]),
      ref,
    )!;
    expect(advice.action).toBe('increase_cardio');
  });

  it('в цели → keep', () => {
    const advice = prepCardioKcalAdvice(
      prepFemale,
      cycle(),
      mk([['2026-06-19', 62.0], ['2026-06-21', 61.9], ['2026-06-24', 61.8], ['2026-06-27', 61.7], ['2026-07-01', 61.65]]),
      ref,
    )!;
    expect(advice.action).toBe('keep');
  });

  it('текущая неделя в taper/пике → keep (корректировки запрещены)', () => {
    // ref 2026-08-15 = неделя 11 (taper): даже при быстром снижении — keep.
    const advice = prepCardioKcalAdvice(
      prepFemale,
      cycle(),
      mk([['2026-08-05', 62.5], ['2026-08-07', 62.0], ['2026-08-10', 60.5], ['2026-08-13', 60.1], ['2026-08-15', 59.8]]),
      '2026-08-15',
    )!;
    expect(advice.action).toBe('keep');
    expect(advice.reason).toMatch(/Taper|тапер/);
  });
});

describe('cardioPrepCheckIn — контрольные замеры prep', () => {
  const cycle = () => buildCardioCycleFromPrep(prepFemale, { daysAvailable: 7 })!;

  it('null без prep/цикла', () => {
    expect(cardioPrepCheckIn(null, cycle(), [], [], [])).toBeNull();
    expect(cardioPrepCheckIn(prepFemale, null, [], [], [])).toBeNull();
  });

  it('полный замер: неделя 2 (base), дней до шоу, вес Δ7/Δ14', () => {
    const c = cycle();
    const check = cardioPrepCheckIn(
      prepFemale,
      c,
      [{ date: '2026-06-10', durationMin: 40, completed: true }],
      [
        { date: '2026-05-20', weightKg: 61.6 },
        { date: '2026-05-27', weightKg: 61.2 },
        { date: '2026-06-03', weightKg: 60.8 },
        { date: '2026-06-08', weightKg: 60.4 },
        { date: '2026-06-10', weightKg: 60.0 },
      ],
      [{ date: '2026-06-10', hr: 72 }],
      '2026-06-10',
    )!;
    expect(check).not.toBeNull();
    expect(check.week).toBe(2);
    expect(check.totalWeeks).toBe(15);
    expect(check.phase).toBe('base');
    expect(check.daysToShow).toBe(97);
    expect(check.weight.lastKg).toBe(60.0);
    expect(check.weight.delta7d).toBeCloseTo(60.4 - 61.2, 5);
    expect(check.weight.delta14d).toBeCloseTo(60.4 - 61.6, 5);
    expect(check.weight.measurements).toBe(5);
  });

  it('adherence недели из журнала (план vs факт + пропуски)', () => {
    const c = cycle();
    const week2 = c.weeks[1];
    const check = cardioPrepCheckIn(
      prepFemale,
      c,
      [
        { date: '2026-06-09', durationMin: 40, completed: true },
        { date: '2026-06-10', durationMin: 40, completed: true },
        { date: '2026-06-12', durationMin: 40, completed: false },
      ],
      [],
      [],
      '2026-06-10',
    )!;
    expect(check.adherence.plannedMinutes).toBe(week2.totalMinutes);
    expect(check.adherence.doneMinutes).toBe(80);
    expect(check.adherence.pct).toBe(Math.round((80 / week2.totalMinutes) * 100));
    expect(check.adherence.skippedSessions).toBe(1);
  });

  it('ЧСС покоя ↑ >5% → warning в notes', () => {
    const check = cardioPrepCheckIn(
      prepFemale,
      cycle(),
      [],
      [],
      [
        { date: '2026-05-10', hr: 64 }, { date: '2026-05-15', hr: 65 }, { date: '2026-05-20', hr: 66 },
        { date: '2026-06-03', hr: 67 },
        { date: '2026-06-08', hr: 72 }, { date: '2026-06-10', hr: 73 },
      ],
      '2026-06-10',
    )!;
    expect(check.restingHr.deltaPct).toBeGreaterThan(5);
    expect(check.notes.some(n => /ЧСС покоя ↑/.test(n))).toBe(true);
  });

  it('ACWR из журнала кардио (≥4 хронических сессий за 28д)', () => {
    const check = cardioPrepCheckIn(
      prepFemale,
      cycle(),
      [
        { date: '2026-05-16', durationMin: 40, rpe: 6, completed: true },
        { date: '2026-05-23', durationMin: 40, rpe: 6, completed: true },
        { date: '2026-05-30', durationMin: 40, rpe: 6, completed: true },
        { date: '2026-06-02', durationMin: 40, rpe: 6, completed: true },
        { date: '2026-06-04', durationMin: 60, rpe: 7, completed: true },
        { date: '2026-06-06', durationMin: 60, rpe: 7, completed: true },
        { date: '2026-06-08', durationMin: 60, rpe: 8, completed: true },
        { date: '2026-06-10', durationMin: 60, rpe: 8, completed: true },
      ],
      [],
      [],
      '2026-06-10',
    )!;
    expect(check.acwr).not.toBeNull();
    expect(['dangerous', 'caution', 'optimal', 'undertrained']).toContain(check.acwr!.zone);
    expect(check.notes.some(n => /ACWR/.test(n))).toBe(true);
  });

  it('недельное выполнение <60% → note', () => {
    const check = cardioPrepCheckIn(
      prepFemale,
      cycle(),
      [{ date: '2026-06-09', durationMin: 25, completed: true }],
      [],
      [],
      '2026-06-10',
    )!;
    expect(check.adherence.pct).toBeLessThan(60);
    expect(check.notes.some(n => /Выполнение недели/.test(n))).toBe(true);
  });

  it('за 14 дней до шоу (не transition) → note «До шоу N дн»', () => {
    const prep = { ...prepFemale, showDate: '2026-08-30' };
    const check = cardioPrepCheckIn(prep, cycle(), [], [], [], '2026-08-26')!;
    expect(check.week).toBe(13);
    expect(check.phase).toBe('peak');
    expect(check.daysToShow).toBe(4);
    expect(check.notes.some(n => /До шоу 4 дн/.test(n))).toBe(true);
  });

  it('всё в норме → нейтральная note', () => {
    const c = cycle();
    const week2Minutes = c.weeks[1].totalMinutes;
    const check = cardioPrepCheckIn(
      prepFemale,
      c,
      [{ date: '2026-06-09', durationMin: week2Minutes, completed: true }],
      [{ date: '2026-06-05', weightKg: 60.2 }, { date: '2026-06-08', weightKg: 60.0 }, { date: '2026-06-10', weightKg: 60.0 }],
      [{ date: '2026-06-10', hr: 62 }],
      '2026-06-10',
    )!;
    expect(check.notes.some(n => /в норме/.test(n))).toBe(true);
  });
});