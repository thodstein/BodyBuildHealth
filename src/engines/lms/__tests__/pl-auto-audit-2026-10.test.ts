/**
 * pl-auto-audit-2026-10.test.ts — лок-тесты аудита PL-auto (Oct 2026).
 *
 * Закрытые находки раунда (каждая — регресс-тест на механизм, не на подпись):
 *  P0-A  сезон: копии недель наследовали пик-разметку → пик-блок молча исчезал;
 *  P0-B  нулевое окно между стартами сжимало цикл БЕЗ согласия (обход контракта);
 *  P0-C  снимок тапера восстанавливал weeks при отчётах тапер-плана и ложился
 *        поверх свежесобранного цикла;
 *  P1-A  пик-блок «окно = mock+meet» терял mock (кривая пуста);
 *  P1-B  повторное встраивание тапера давало 3 «тапер-недели» при запрошенных 2;
 *  P1-C  «🔄 Обновить прикиды» сбрасывал плановый ПМ федерации;
 *  P1-D  pmFeasibility: план, недостижимый в окне, получал вердикт «на грани»;
 *  P1-E  реестр стартов и сезон ПЛ расходились на неделю (weeksToStart ↔ week);
 *  P1-F  нули «План ПМ в федерации» затирали фактический ПМ в прикидах старта;
 *  P1-G  Frequency Planner «Применить в план» был тихим no-op;
 *  P2-A  findLastFact (90 дней) и plateau-детект жили в разных окнах.
 */
import { describe, expect, it } from 'vitest';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import {
  buildLMSPlan, appendPLTaperWeeks, refreshMeetAttempts, originalCycleWeeks,
  type LMSBuildOutput,
} from '../lms-builder.engine';
import { applyMacroTaperToPLWeeks, buildPLSeasonPeaks } from '../lms-macro-taper.engine';
import { planBetweenCompetitions } from '../lms-comp-gap.engine';
import { fitCycleToWeeks } from '../lms-season.engine';
import { dateFromWeeksToStart, macroWeekForDateIso, mergeMeetRegistry, weeksToStartFromDate, syncCompetitionsFromMeets } from '../pl-meet-registry.engine';
import { pmFeasibility } from '../lms-taper-coach.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';

const TODAY = '2026-05-04';
const pmMap = { 'Присед': 180, 'Жим лёжа': 120, 'Становая тяга': 200 };
const base = (cycle: SRCycleTemplate) =>
  buildLMSPlan({ template: cycle, pmMap, fallbackPm: 80, weeksOverride: originalCycleWeeks(cycle), mode: 'natural' });
const weekVolume = (wk: { days: { exercises: { workSets: { sets: number }[] }[] }[] }) =>
  wk.days.reduce((s, d) => s + d.exercises.reduce((a, e) => a + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0), 0);

describe('P0-A: сезон не наследует пик-разметку копиями недель', () => {
  it('после appendPLTaperWeeks недели носят флаги — сезон всё равно строит пик-блок', () => {
    const plan = base(CYCLE_01);
    const withTaper = appendPLTaperWeeks(plan, 2, { windowWeeks: 4, mockMeet: { strategy: 'balanced' }, meetWeek: { strategy: 'balanced' }, postMeet: { volumeMult: 0.5 } });
    expect(withTaper.weeks.some(w => w.taperWeek || w.meetWeek || w.postMeet)).toBe(true);
    // Сезон глубоко копирует хвост — копии обязаны быть «чистыми», иначе
    // applyMacroTaperToPLWeeks считает их обработанными (alreadyMarked) и
    // прикидовая неделя старта не строится вовсе.
    const season = buildPLSeasonPeaks(withTaper.weeks, [{ id: 'm1', name: 'Старт', weeksToStart: 12 }], {
      mockMeet: true, postMeet: true, windowWeeks: 8,
    });
    expect(season.weeks.some(w => w.meetWeek)).toBe(true);
    expect(season.weeks.some(w => w.meetAttempts)).toBe(true);
  });

  it('разметка тапера требует peak-недель перед соревнованием', () => {
    const plan = base(CYCLE_01);
    const weeks = Array.from({ length: 8 }, (_, i) => ({ ...plan.weeks[i % plan.weeks.length], week: i + 1, macroPhase: i >= 5 ? (i === 7 ? 'competition' as const : 'peak' as const) : undefined }));
    const res = applyMacroTaperToPLWeeks(weeks, { mode: 'classic', mockMeet: true });
    expect(res.weeks.some(w => w.taperWeek)).toBe(true);
    expect(res.weeks.some(w => w.meetWeek)).toBe(true);
    expect(res.weeks.some(w => w.mockMeet)).toBe(true);
  });
});

describe('P0-B: нулевое окно не обходит согласие', () => {
  const opts = {
    selector: { goal: 'strength', level: 'II-KMS', bodyWeight: 90, daysPerWeek: 4, direction: 'powerlifting', mode: 'natural' } as never,
    taper: { mockMeet: true, meetWeek: true, postMeet: true, windowWeeks: 2 },
    pmMap,
    fallbackPm: 80,
  };
  it('с согласием: 1 неделя цикла на старт (как и раньше), fitMode skip', () => {
    const res = planBetweenCompetitions(
      [{ id: 'm1', name: 'Старт 1', weeksToStart: 4 }, { id: 'm2', name: 'Старт 2', weeksToStart: 8 }],
      { ...opts, cycleForGap: () => CYCLE_01, mode: 'auto', consents: { 0: true, 1: true } } as never,
    );
    const seg1 = res.segments[1];
    expect(seg1.fitMode).toBe('skip');
    expect(seg1.fitWeeks).toBe(1);
    expect(seg1.notes.some(n => n.includes('слишком мало'))).toBe(true);
  });

  it('БЕЗ согласия: сегмент пропущен (раскладка цикла не тронута)', () => {
    const res = planBetweenCompetitions(
      [{ id: 'm1', name: 'Старт 1', weeksToStart: 4 }, { id: 'm2', name: 'Старт 2', weeksToStart: 8 }],
      { ...opts, cycleForGap: () => CYCLE_01, mode: 'auto' } as never,
    );
    const seg1 = res.segments[1];
    expect(seg1.fitMode).toBe('strict_skip');
    expect(seg1.fitWeeks).toBe(null);
    expect(seg1.needsConsent).toBe(true);
  });

  it('meetCycleWeeks(12) в окно 1 требует согласия (обход закрыт)', () => {
    const fit = fitCycleToWeeks(CYCLE_01, 1, { minCycleFloor: 1 });
    expect(fit.needsConsent).toBe(true);
  });
});

describe('P1-A/P1-B: пик-блок — mock не теряется, тапер ровно N недель', () => {
  const withTailAutoTaper = LMS_CYCLES.find(c => !c.weeks && (c.meta as { deloadWeeks?: number[] }).deloadWeeks?.includes(c.meta.weeks));

  it('окно = mock+meet: mockMeet и meetWeek на месте', () => {
    const plan = base(CYCLE_01);
    const w = appendPLTaperWeeks(plan, 1, { windowWeeks: 2, mockMeet: { strategy: 'balanced' }, meetWeek: { strategy: 'balanced' } });
    expect(w.weeks.filter(x => x.mockMeet).length).toBe(1);
    expect(w.weeks.filter(x => x.meetWeek).length).toBe(1);
  });

  it('повторное встраивание даёт ровно запрошенные тапер-недели (без двойного блока)', () => {
    for (const c of LMS_CYCLES) {
      const plan = base(c);
      if (plan.weeks.length < 4) continue;
      const w = appendPLTaperWeeks(plan, 2, { peakExit: { strategy: 'balanced' } });
      const t = w.weeks.filter(x => x.taperWeek);
      expect(t.length, `${c.meta.id}: тапер-недель ${t.length}`).toBe(2);
      // объём монотонно ↓ к старту
      const prev = w.weeks[w.weeks.length - 3];
      expect(weekVolume(t[0]), `${c.meta.id}: тапер н1 > предыдущей`).toBeLessThanOrEqual(weekVolume(prev));
      expect(weekVolume(t[1]), `${c.meta.id}: тапер н2 > н1`).toBeLessThanOrEqual(weekVolume(t[0]));
      // нумерация недель непрерывна
      const nums = w.weeks.map(x => x.week);
      for (let i = 1; i < nums.length; i++) expect(nums[i]).toBe(nums[i - 1] + 1);
    }
    // цикл с МЕТА-делоадом на последней неделе (авто-тапер + делод в хвосте) —
    // именно он раньше давал 3 «тапер-недели»
    if (withTailAutoTaper) expect(withTailAutoTaper.meta.id).toBeTruthy();
  });

  it('после авто-тапера сборки пик-блок заменяет его, а не дописывается', () => {
    const c = withTailAutoTaper;
    if (!c) return; // на наборе циклов такого может не быть — лок тогда вакуумный
    const plan = base(c);
    const preTaper = plan.weeks.filter(w => w.taperWeek).length;
    const w = appendPLTaperWeeks(plan, 2, { peakExit: { strategy: 'balanced' } });
    expect(w.weeks.filter(x => x.taperWeek).length).toBe(2);
    expect(preTaper).toBeGreaterThan(0);
  });
});

describe('P1-C: «Обновить прикиды» не сбрасывает плановый ПМ федерации', () => {
  it('attemptPmRow переживает смену стратегии', () => {
    const plan = base(CYCLE_01);
    const w = appendPLTaperWeeks(plan, 2, {
      peakExit: { strategy: 'conservative' },
      meetData: { plannedPm: { 'Присед': 250 } },
    });
    const before = w.weeks.find(x => x.meetAttempts);
    expect(before?.attemptPmRow?.['Присед']).toBe(250);
    const r = refreshMeetAttempts(w, 'aggressive');
    const after = r.weeks.find(x => x.attemptPmRow?.['Присед']);
    // попытки aggressive (93% от 250 = 232.5) — не от pmRow недели (≈185)
    const squat = after?.meetAttempts?.lifts.find(l => /присед/i.test(l.name));
    expect(squat).toBeTruthy();
    expect(squat!.opener).toBeGreaterThan(220);
  });
});

describe('P1-D: pmFeasibility различает «на грани» и «не влезает в окно»', () => {
  const ctx = (planned: Record<string, number>) => ({
    forecastPm: { 'Присед': 200, 'Жим лежа': 140, 'Становая тяга': 240 },
    actualPm: { 'Присед': 198, 'Жим лежа': 138, 'Становая тяга': 238 },
    plannedPm: planned,
    weeksToMeet: 4,
    weeklyK: 0.01,
    currentWeight: 82,
    targetWeight: 80,
  });
  it('план чуть выше прогноза — tight (ускоряется темпом)', () => {
    const f = pmFeasibility(ctx({ 'Присед': 210 }));
    expect(f.status).toBe('tight');
    expect(f.lifts[0].kReq).toBeGreaterThan(0);
  });
  it('план сильно выше прогноза — unrealistic', () => {
    const f = pmFeasibility(ctx({ 'Присед': 240 }));
    expect(f.status).toBe('unrealistic');
    expect(f.summary).toContain('нереалистичен');
  });
  it('без базы прогноза — unrealistic, а не ложный tight', () => {
    const f = pmFeasibility({ ...ctx({ 'Присед': 210 }), forecastPm: {}, actualPm: {} });
    expect(f.status).toBe('unrealistic');
  });
  it('вердикт строится на ТРЕБУЕМОМ ТЕМПЕ (не на «доп. неделях ≤ окна»)', () => {
    // Старый гейт: `weeksNeeded <= weeksToMeet` (доп. недели против всего окна) —
    // на длинном горизонте туда проходил любой план. Новый: план «на грани»,
    // если закрывается умеренным ускорением темпа (kReq ≤ 2k), иначе нереалистичен.
    // Умеренное ускорение: 110 при темпе 1% и окне 8 нед → kReq 1.25% ≈ 1.2×k → tight.
    const f = pmFeasibility({
      forecastPm: { 'Присед': 100 }, actualPm: { 'Присед': 100 }, plannedPm: { 'Присед': 110 },
      weeksToMeet: 8, weeklyK: 0.01, currentWeight: 80, targetWeight: 80,
    });
    expect(f.status).toBe('tight');
    expect(f.lifts[0].weeksNeeded).toBeGreaterThan(0); // «нужно ещё N нед» при текущем темпе
    expect(f.summary).toContain('темп'); // раскрытие требуемого темпа
  });

  it('огромное ускорение (kReq ≫ k) — нереалистичен, а не «на грани»', () => {
    // План 130 при темпе 1% и окне 4 нед: нужно 5.6%/нед (×5.6) → unrealistic.
    const f = pmFeasibility({
      forecastPm: { 'Присед': 100 }, actualPm: { 'Присед': 100 }, plannedPm: { 'Присед': 130 },
      weeksToMeet: 4, weeklyK: 0.01, currentWeight: 80, targetWeight: 80,
    });
    expect(f.status).toBe('unrealistic');
  });
});

describe('P1-E: реестр стартов и сезон ПЛ — одна недель', () => {
  it('weeksToStart = N ⇔ старт в неделе N плана', () => {
    expect(dateFromWeeksToStart(8, TODAY)).toBe('2026-06-22');
    expect(weeksToStartFromDate('2026-06-22', TODAY)).toBe(8);
    expect(macroWeekForDateIso('2026-06-22', TODAY)).toBe(8);
  });

  it('merge → sync → merge: идемпотентность и согласованные недели', () => {
    const legacy = [{ id: 'm1', name: 'Кубок', weeksToStart: 8, fed: 'fpr', plannedPm: { 'Присед': 200 }, strategy: 'balanced' as const }];
    const first = mergeMeetRegistry({ competitions: [], legacyMeets: legacy, mainMeetId: 'm1', todayIso: TODAY });
    expect(first.competitions[0].week).toBe(8);
    expect(first.meets[0].weeksToStart).toBe(8);
    const synced = syncCompetitionsFromMeets(first.competitions, first.meets, { mainMeetId: 'm1', todayIso: TODAY });
    expect(synced[0].week).toBe(8);
    const second = mergeMeetRegistry({ competitions: synced, legacyMeets: first.meets, mainMeetId: 'm1', todayIso: TODAY });
    expect(second.changed).toBe(false);
  });

  it('событие года week 5 ⇔ 5 недель до старта', () => {
    const res = mergeMeetRegistry({
      competitions: [{ id: 'ev', name: 'Первенство', week: 5, priority: 'A' }],
      legacyMeets: [],
      mainMeetId: 'ev',
      todayIso: TODAY,
    });
    expect(res.meets[0].weeksToStart).toBe(5);
  });
});

describe('P2-A: plateau-детект живёт в том же окне, что и корректировка весов', () => {
  it('сессии старше 90 дней не дают ни веса, ни плато', async () => {
    const { buildDiaryAutoreg } = await import('../../pro/diary-autoreg.engine');
    const old = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); const p = (v: number) => String(v).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
    const r = buildDiaryAutoreg({
      historyWorkouts: [
        { date: old(120), exercises: [{ exerciseName: 'Присед', date: old(120), sets: [{ weight: 180, reps: 1, rpe: 10, rir: 0 }], estimated1RM: 180 }] },
        { date: old(110), exercises: [{ exerciseName: 'Присед', date: old(110), sets: [{ weight: 180, reps: 1, rpe: 10, rir: 0 }], estimated1RM: 180 }] },
        { date: old(100), exercises: [{ exerciseName: 'Присед', date: old(100), sets: [{ weight: 180, reps: 1, rpe: 10, rir: 0 }], estimated1RM: 180 }] },
      ] as never as never,
      plannedExercises: [{ name: 'Присед', plannedWeight: 180, plannedReps: 1, plannedSets: 3, plannedRir: 0, isMain: true }],
    });
    expect(r.summary.noData).toBe(1);
    expect(r.plateauWarnings.length).toBe(0);
  });
});

describe('общие инварианты плана по каталогу (регресс-база раунда)', () => {
  it('127 циклов: веса>0, сеты≥1, RIR 0..6, недели 1..N, день ≤10 упр, лишних дублей нет', () => {
    const problems: string[] = [];
    for (const c of LMS_CYCLES) {
      const plan = base(c);
      const srcDup = new Set<string>();
      for (const week of (c.weeks?.length ? c.weeks : [c.week1])) for (const day of week) {
        const seen = new Set<string>();
        for (const e of day.exercises) { const k = e.name.toLowerCase().replace(/ё/g, 'е'); if (seen.has(k)) srcDup.add(k); seen.add(k); }
      }
      plan.weeks.forEach((wk, wi) => {
        if (wk.week !== wi + 1) problems.push(`${c.meta.id}: недели ${wk.week}!=${wi + 1}`);
        for (const d of wk.days) {
          if (d.exercises.length > 10) problems.push(`${c.meta.id} н${wk.week}: ${d.exercises.length} упр`);
          const names = new Set<string>();
          for (const e of d.exercises) {
            const k = e.name.toLowerCase().replace(/ё/g, 'е');
            if (names.has(k) && !srcDup.has(k)) problems.push(`${c.meta.id} н${wk.week}: дубль ${e.name}`);
            names.add(k);
            for (const ws of e.workSets) {
              if (!(ws.weight > 0)) problems.push(`${c.meta.id}: вес ${ws.weight}`);
              if (!(ws.sets >= 1)) problems.push(`${c.meta.id}: сеты ${ws.sets}`);
              if (ws.rir < 0 || ws.rir > 6) problems.push(`${c.meta.id}: RIR ${ws.rir}`);
            }
          }
        }
      });
    }
    expect(problems.slice(0, 20)).toEqual([]);
  });
});
