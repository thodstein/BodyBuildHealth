/**
 * cardio-audit-2026-10.test.ts — лок аудита кардиоконструктора (Oct 2026).
 * Каждый дефект = тест. Промт: «полный анализ кардиоконструктора + интернет-
 * исследования; чего не хватает или что работает не так; исправь все баги».
 *
 * P0-1: cycle.totalKcal не пересчитывался адаптациями (hero/сводка/экспорт врали).
 * P0-3: wellness «влияет на автотюн» — сигнал не доезжал до движка.
 * P1-4: UTC-парс 10-символьных дат в .ics/раскладке (мимо стрocheчного guard'а).
 * P1-6: две шкалы нагрузки (мин×RPE/5 vs ×RPE/10) и inline-копии Banister.
 * P1-9: explainCardioChoice показывал зоны классической формулы, не выбранной.
 */
import { describe, expect, it } from 'vitest';
import {
  buildCardioCycle, rebuildCycle, cardioCycleSummary,
  adaptCardioToStrength, applyPLCardioTaper, applyBBCardioTaper,
  applyIndividualizedTaperToCycle, autoTuneCardioCycle, improveCardioCycle,
  bumpCardioZone2Volume, bumpCardioZone2VolumeGuarded, applyCardioCompetitionCascade,
  cardioCyclePeriodAware, moveCardioSessionInWeek, rescheduleCardioSession,
  cardioAcwr, explainCardioChoice, buildCardioIcs, spreadSessionsAcrossDays,
  cardioEntryLoad, maxHrByFormula, dailyTrimpMap, cardioHeartZones, cardioFactHrAdjustment,
} from '../cardio.engine';
import { individualizedTaperPlan } from '../cardio-taper-pro.engine';
import { todayLocalIso, parseLocalIso, addDaysIso, weekStartIso, dayOfWeekIso } from '../cardio-date-utils.engine';

const sumWeeksKcal = (c: { weeks: { totalKcal: number }[] }) =>
  c.weeks.reduce((s, w) => s + w.totalKcal, 0);

/** Утилита проверки инварианта «итоги цикла = сумма недель» для адаптаций. */
function expectCycleTotals(c: { totalKcal: number; weeks: { totalKcal: number }[] }, label: string) {
  expect(c.totalKcal, `${label}: cycle.totalKcal должен быть суммой недель`).toBe(sumWeeksKcal(c));
}

describe('P0-1 rebuildCycle — итоги цикла пересчитываются всеми адаптациями', () => {
  const base = () => buildCardioCycle({
    goal: 'cut', totalWeeks: 8, daysAvailable: 5, startDate: '2026-09-07',
    competitions: [{ id: 'c1', name: 'Старт', week: 8 }],
  });

  it('баг: адаптации оставляли корневой totalKkal от сборки (сейчас — сумма недель)', () => {
    const c = base();
    const before = c.totalKkal;
    const adapted = adaptCardioToStrength(c, { acwrZone: 'caution' });
    // Минуты реально урезаны — недели изменились.
    expect(adapted.weeks.some((w, i) => w.totalKcal !== c.weeks[i].totalKcal)).toBe(true);
    // Было: adapted.totalKkal === before (старые ккал в UI/экспорте).
    expect(adapted.totalKcal).not.toBe(before);
    expectCycleTotals(adapted, 'adaptCardioToStrength');
  });

  it('PL/BB/индивидуальный taper: итоги пересчитаны', () => {
    const c = base();
    const pl = applyPLCardioTaper(c, { competitionWeek: 8, taperWeeks: 2 });
    expectCycleTotals(pl, 'applyPLCardioTaper');
    const bb = applyBBCardioTaper(c, { showWeek: 8, taperWeeks: 2 });
    expectCycleTotals(bb, 'applyBBCardioTaper');
    const plan = individualizedTaperPlan({ durationDays: 14, reductionPct: 50, tauDays: 7 });
    const ind = applyIndividualizedTaperToCycle(c, plan, { showWeek: 8 });
    expectCycleTotals(ind.cycle, 'applyIndividualizedTaperToCycle');
  });

  it('авто-тюн по дневнику: итоги пересчитаны и правка реальна', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, startDate: todayLocalIso() });
    const today = todayLocalIso();
    // Запись «сегодня» с высоким RPE → авто-тюн режет минуты текущей недели.
    const log = [{ date: today, durationMin: 40, rpe: 9, completed: true }];
    const tuned = autoTuneCardioCycle(c, log, { referenceIso: today });
    expect(tuned.changes.length).toBeGreaterThan(0);
    expect(tuned.cycle.weeks[0].totalKcal).not.toBe(c.weeks[0].totalKcal);
    expectCycleTotals(tuned.cycle, 'autoTuneCardioCycle');
  });

  it('авто-улучшение/бамп/каскад/период/перенос/смена дня — итоги пересчитаны', () => {
    const c = base();

    const improved = improveCardioCycle(c).cycle;
    expectCycleTotals(improved, 'improveCardioCycle');

    const bumped = bumpCardioZone2Volume(c, 15);
    expect(bumped.weeks.some((w, i) => w.totalKcal !== c.weeks[i].totalKcal)).toBe(true);
    expectCycleTotals(bumped, 'bumpCardioZone2Volume');
    const guarded = bumpCardioZone2VolumeGuarded(c, 15);
    expectCycleTotals(guarded.cycle, 'bumpCardioZone2VolumeGuarded');

    // Каскад стартов: цикл БЕЗ предсобранного тапера, иначе taper-недели
    // уже помечены и каскад (корректно) их не трогает.
    const cascadeCycle = buildCardioCycle({
      goal: 'cut', totalWeeks: 8, daysAvailable: 5, startDate: '2026-09-07',
      competitions: [{ id: 'c1', name: 'Старт', week: 8 }], taper: false,
    });
    const cascaded = applyCardioCompetitionCascade(cascadeCycle, [{ week: 8, priority: 'B' }]);
    // Старт на неделе 8 (приоритет B): недели 7-8 помечены taper — итоги меняются.
    expect(sumWeeksKcal(cascaded)).not.toBe(sumWeeksKcal(cascadeCycle));
    expectCycleTotals(cascaded, 'applyCardioCompetitionCascade');

    const period = cardioCyclePeriodAware(c, { lastPeriodStartIso: todayLocalIso(), cycleLengthDays: 28 });
    expectCycleTotals(period.cycle, 'cardioCyclePeriodAware');

    const moved = moveCardioSessionInWeek(c, 1, 0, ((c.weeks[0].sessions[0].dayOfWeek ?? 0) + 2) % 7);
    expect(moved).not.toBeNull();
    expectCycleTotals(moved!, 'moveCardioSessionInWeek');

    const rescheduled = rescheduleCardioSession(c, todayLocalIso());
    expect(rescheduled.changes.length).toBeGreaterThan(0);
    expectCycleTotals(rescheduled.cycle, 'rescheduleCardioSession');
  });

  it('сводка цикла показывает новые ккал (hero/печать/мост читают её)', () => {
    // Цикл без предсобранного тапера — иначе BB-taper'у нечего резать.
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, daysAvailable: 5, startDate: '2026-09-07' });
    const bb = applyBBCardioTaper(c, { showWeek: 8, taperWeeks: 2 });
    expect(sumWeeksKcal(bb)).not.toBe(sumWeeksKcal(c));
    const s = cardioCycleSummary(bb);
    expect(s.avgKcalPerWeek).toBe(Math.round(bb.totalKcal / bb.totalWeeks));
    // И это НЕ цифры от сборки.
    expect(s.avgKcalPerWeek).not.toBe(Math.round(c.totalKcal / c.totalWeeks));
  });
});

describe('P0-3 wellness реально влияет на авто-тюн', () => {
  const c = () => buildCardioCycle({ goal: 'cut', totalWeeks: 6, startDate: todayLocalIso() });

  it('низкая готовность (<4) → минуты −10% и HIIT убран с пометкой', () => {
    const r = autoTuneCardioCycle(c(), [], { wellnessReadiness: 2, referenceIso: todayLocalIso() });
    expect(r.changes.some(x => /Готовность/.test(x.label))).toBe(true);
    const future = r.cycle.weeks.filter(w => !w.deload && !w.taper && w.phase !== 'transition' && w.week > weekOf(r.cycle, todayLocalIso()) - 1);
    for (const w of future) expect(w.sessions.some(s => s.type === 'hiit')).toBe(false);
    expectCycleTotals(r.cycle, 'wellness-автотюн');
  });

  it('готовность в норме (≥4) и null → wellness-ветка не срабатывает', () => {
    const ok = autoTuneCardioCycle(c(), [], { wellnessReadiness: 8, referenceIso: todayLocalIso() });
    expect(ok.changes.some(x => /Готовность/.test(x.label))).toBe(false);
    const none = autoTuneCardioCycle(c(), [], { wellnessReadiness: null, referenceIso: todayLocalIso() });
    expect(none.changes.some(x => /Готовность/.test(x.label))).toBe(false);
  });

  it('«одна переменная за раз»: wellness не суммируется с RPE-веткой', () => {
    const log = [{ date: todayLocalIso(), durationMin: 40, rpe: 9, completed: true }];
    const r = autoTuneCardioCycle(c(), log, { wellnessReadiness: 2, referenceIso: todayLocalIso() });
    const labels = r.changes.map(x => x.label);
    expect(labels.some(l => /Готовность/.test(l))).toBe(true);
    expect(labels.some(l => /RPE/.test(l))).toBe(false);
  });
});

function weekOf(cycle: { startDate?: string; totalWeeks: number }, iso: string): number {
  const ref = cycle.startDate ? parseLocalIso(cycle.startDate) : new Date();
  const t = parseLocalIso(iso);
  return Math.floor((t.getTime() - new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime()) / 86400000 / 7) + 1;
}

describe('P1-4 локальный парс дат: .ics и раскладка по дням', () => {
  it('buildCardioIcs: даты событий = канон недель/дней (локальный парс, не UTC-полночь)', () => {
    const start = '2026-09-10';
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, startDate: start });
    const ics = buildCardioIcs(c);
    const dates = [...ics.matchAll(/DTSTART:(\d{8})T/g)].map(m => m[1]);
    expect(dates.length).toBeGreaterThan(0);
    // Ожидание — из канона cardio-date-utils (тот же, что использует экспорт).
    const expected: string[] = [];
    for (const w of c.weeks) {
      for (const s of w.sessions) {
        const freq = Math.max(1, Math.round(s.weeklyFrequency));
        for (let k = 0; k < freq; k++) {
          const iso = s.dayOfWeek != null
            ? dayOfWeekIso(w.week, (s.dayOfWeek + k) % 7, start)
            : addDaysIso(weekStartIso(w.week, start), k);
          expected.push(iso.replace(/-/g, ''));
        }
      }
    }
    expect(dates.slice().sort()).toEqual(expected.slice().sort());
    // И самая ранняя дата — внутри недели старта цикла (не сутки назад).
    const min = dates.slice().sort()[0];
    expect(min >= '20260910' && min <= '20260916').toBe(true);
    expect(parseLocalIso(start).getDate()).toBe(10);
  });

  it('spreadSessionsAcrossDays: день недели — от локальной даты привязки', () => {
    const ref = '2026-09-23'; // среда
    const startDow = (parseLocalIso(ref).getDay() + 6) % 7;
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, startDate: ref });
    const spread = spreadSessionsAcrossDays(c.weeks[0], ref);
    expect(spread.length).toBeGreaterThan(0);
    expect(spread[0].dayOfWeek).toBe(startDow);
  });
});

describe('P1-6 единая шкала нагрузки + формулы ЧССмакс', () => {
  it('cardioEntryLoad: RPE/10, дефолт 6 (та же шкала, что в ACWR)', () => {
    expect(cardioEntryLoad(60, 8)).toBe(48);
    expect(cardioEntryLoad(60)).toBe(36);
    expect(cardioEntryLoad(0, 5)).toBe(0);
    // Было в дашборде монотонности: 60 × 8/5 = 96 — вдвое больше.
    expect(cardioEntryLoad(60, 8)).not.toBe(96);
  });

  it('ACWR считает нагрузку той же шкалой (acuteLoad === Σ cardioEntryLoad)', () => {
    const ref = '2026-08-15';
    const log: { date: string; durationMin: number; rpe?: number; completed: boolean }[] = [];
    // Острая неделя: 7 записей 09–15.08 (RPE 8).
    for (let i = 0; i < 7; i++) log.push({ date: addDaysIso('2026-08-09', i), durationMin: 40, rpe: 8, completed: true });
    // Хроническое окно: 18.07–01.08 (охват 14 дней — условие информативности).
    for (let i = 0; i < 15; i++) log.push({ date: addDaysIso('2026-07-18', i), durationMin: 35, rpe: 6, completed: true });
    const r = cardioAcwr(log, ref)!;
    expect(r).not.toBeNull();
    const acuteExpected = log.filter(e => e.date >= '2026-08-09').reduce((s, e) => s + cardioEntryLoad(e.durationMin, e.rpe), 0);
    expect(r.acuteLoad).toBe(Math.round(acuteExpected));
  });

  it('dailyTrimpMap — единая точка TRIMP (Banister при HR, иначе фактор)', () => {
    const map = dailyTrimpMap(
      [{ date: '2026-08-15', type: 'zone2', durationMin: 40, avgHr: 150, completed: true }],
      60, 190, 'male',
    );
    expect(map.get('2026-08-15')).toBeGreaterThan(0);
    // Без HR/ЧСС покоя — факторная оценка (не 0 и не NaN).
    const fallback = dailyTrimpMap([{ date: '2026-08-15', type: 'zone2', durationMin: 40, completed: true }], undefined, undefined, 'male');
    expect(fallback.get('2026-08-15')).toBeGreaterThan(0);
  });

  it('maxHrByFormula: classic/tanaka/gulati по формуле выбора', () => {
    expect(maxHrByFormula(30, 'male', 'classic')).toBe(190);
    expect(maxHrByFormula(30, 'female', 'classic')).toBe(196);
    expect(maxHrByFormula(30, 'male', 'tanaka')).toBe(187);
    expect(maxHrByFormula(30, 'female', 'gulati')).toBe(180);
  });
});

describe('P2 cardioFactHrAdjustment: зоны реально −5 (найдено локом)', () => {
  it('границы целевых зон будущих недель уменьшаются ровно на 5 (не только в подписи)', () => {
    const ref = todayLocalIso();
    const c = buildCardioCycle({
      goal: 'cut', totalWeeks: 8, daysAvailable: 5, startDate: addDaysIso(ref, -21), age: 30, restingHr: 60,
    });
    // Дневник «вчера» с пульсом выше потолка Z2.
    const r = cardioFactHrAdjustment(c, [{ date: addDaysIso(ref, -1), avgHr: 185 }], ref);
    expect(r.changes.length).toBeGreaterThan(0);
    const w5 = c.weeks[4];
    const w5after = r.cycle.weeks[4];
    const before = w5.sessions.find(s => s.type === 'zone2')!.targetHr!;
    const after = w5after.sessions.find(s => s.type === 'zone2')!.targetHr!;
    // Было: max оставался 151 при подписи «140-146» — вычитание жило в
    // nullish-ветке `?? max0 - 5` и не применялось к заданным границам.
    expect(after.max).toBe(before.max! - 5);
    expect(after.min).toBe(before.min! - 5);
    // Подпись изменения не врёт: to = фактические новые границы.
    const ch = r.changes.find(x => x.week === 5)!;
    expect(ch.to).toBe(`${after.min}-${after.max}`);
    // Итоги цикла согласованы с неделями.
    expect(r.cycle.totalKcal).toBe(r.cycle.weeks.reduce((s, w) => s + w.totalKcal, 0));
  });

  it('прошедшие недели не меняются', () => {
    const ref = todayLocalIso();
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, startDate: addDaysIso(ref, -21), age: 30, restingHr: 60 });
    const r = cardioFactHrAdjustment(c, [{ date: addDaysIso(ref, -1), avgHr: 185 }], ref);
    expect(r.cycle.weeks[0].sessions).toEqual(c.weeks[0].sessions);
  });

  it('факт в пределах зоны → корректировок нет', () => {
    const ref = todayLocalIso();
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, startDate: addDaysIso(ref, -21), age: 30, restingHr: 60 });
    const r = cardioFactHrAdjustment(c, [{ date: addDaysIso(ref, -1), avgHr: 120 }], ref);
    expect(r.changes).toEqual([]);
    expect(r.notes[0]).toMatch(/в пределах/);
  });
});

describe('P1-9 объяснение зон — по выбранной формуле ЧССмакс', () => {
  it('Tanaka: объяснение показывает зоны Tanaka, а не классические', () => {
    const input = { goal: 'health' as const, totalWeeks: 4, age: 30, sex: 'male' as const, maxHrFormula: 'tanaka' as const };
    const cycle = buildCardioCycle(input);
    const text = explainCardioChoice(input, cycle).join('\n');
    const tanakaZ2 = cardioHeartZones(30, undefined, undefined, 'male', 'tanaka')[1];
    const classicZ2 = cardioHeartZones(30, undefined, undefined, 'male', 'classic')[1];
    expect(text).toContain(`${tanakaZ2.bpmMin}-${tanakaZ2.bpmMax}`);
    // Классический диапазон при выбранной Tanaka в тексте быть не должно.
    if (classicZ2.bpmMin !== tanakaZ2.bpmMin) expect(text).not.toContain(`${classicZ2.bpmMin}-${classicZ2.bpmMax}`);
  });

  it('classic (дефолт): зоны классические — поведение прежнее', () => {
    const input = { goal: 'health' as const, totalWeeks: 4, age: 30, sex: 'male' as const };
    const text = explainCardioChoice(input, buildCardioCycle(input)).join('\n');
    const z2 = cardioHeartZones(30, undefined, undefined, 'male')[1];
    expect(text).toContain(`${z2.bpmMin}-${z2.bpmMax}`);
  });
});
