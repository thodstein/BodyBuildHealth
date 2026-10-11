/**
 * pl-season-pro.test.ts — PRO-довесок ПЛ-авто (сезонный ICS, план vs факт,
 * дрейф % плана, интенсивностная подсказка). Остаток аудита Oct 2026 §5.
 *
 * Раунд 3 (§5-bis): разбивка по дням, фактический VL из дневника (velocity),
 * экспорт отчёта в CSV/HTML, ICS с сессиями, дат-канон frozen-clock.
 */
import { describe, expect, it, afterEach, vi } from 'vitest';
import { buildLMSPlan, appendPLTaperWeeks, originalCycleWeeks, type LMSBuildOutput } from '../lms-builder.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import {
  buildPLSeasonIcs, plWeeklyCompliance, planFactDriftWarnings, driftWarningLine, plIntensityAdvisory, isoToIcsDate,
  plWeeklyComplianceByDays, plVelocityLossFact, buildPLComplianceCsv, buildPLComplianceHtml, plSeasonIcsFilename,
} from '../pl-season-pro.engine';
import type { WorkoutLog } from '../../../core/types';
import { localIsoDate } from '../../../core/local-date';

const TODAY = '2026-05-04';
const pmMap = { 'Присед': 180, 'Жим лежа': 120, 'Становая тяга': 200 };
const base = (): LMSBuildOutput => buildLMSPlan({ template: CYCLE_01, pmMap, fallbackPm: 80, weeksOverride: originalCycleWeeks(CYCLE_01), mode: 'natural' });

const iso = (n: number): string => { const d = new Date(); d.setDate(d.getDate() - n); const p = (v: number) => String(v).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

/** Сессия дневника с RPE на всех сетах. */
const log = (week: number, rpe: number, sets = 3): WorkoutLog => ({
  id: `w${week}-${rpe}`, date: iso(28 - week * 7), duration: 60, overallRPE: rpe, recoveryBefore: 80, split: 'test',
  exercises: [{
    id: `e${week}`, date: iso(28 - week * 7), exerciseId: 'squat', exerciseName: 'Присед',
    sets: Array.from({ length: sets }, () => ({ weight: 150, reps: 3, rir: 2, rpe })),
    totalVolume: sets * 450, estimated1RM: 160, isCompound: true, weekNumber: week,
  }],
} as never);

describe('pl-season-pro: сезонный ICS', () => {
  it('соревнования из реестра + недели пик-блока с датами', () => {
    const plan = appendPLTaperWeeks(base(), 2, {
      windowWeeks: 4, reference: '2026-12-20', mockMeet: { strategy: 'balanced' }, meetWeek: { strategy: 'balanced' }, postMeet: { volumeMult: 0.5 },
    });
    const ics = buildPLSeasonIcs(plan.weeks, [{ id: 'm1', name: 'Кубок области', weeksToStart: 8, priority: 'A' }], { todayIso: TODAY });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('🏁 Кубок области [A]');
    // недели пик-блока имеют weekStart (dateWeeksBackward) → попадают в календарь
    expect(ics).toContain('📉 Тапер');
    expect(ics).toContain('🏁 Старт (нед');
    expect(ics).toContain('🔄 Пост-старт (нед');
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('недели без дат честно пропускаются (дат не выдумываем)', () => {
    const ics = buildPLSeasonIcs(base().weeks, [], { todayIso: TODAY });
    expect(ics).not.toContain('VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('start: ISO → ICS-дата; DTEND исклюзивен (+1 день)', () => {
    expect(isoToIcsDate('2026-12-20')).toBe('20261220');
    expect(isoToIcsDate('битая')).toBeNull();
  });

  it('встреча со стартом: weeksToStart=1 → сегодня (контракт недель)', () => {
    const ics = buildPLSeasonIcs([], [{ id: 'm1', name: 'Старт', weeksToStart: 1 }], { todayIso: TODAY });
    expect(ics).toContain(`DTSTART;VALUE=DATE:${TODAY.replace(/-/g, '')}`);
  });
});

describe('pl-season-pro: недельная сверка «план vs факт»', () => {
  it('факт дневника группируется по weekNumber записи', () => {
    const plan = base();
    const res = plWeeklyCompliance(plan, [log(1, 8)], { todayIso: TODAY, currentWeek: 3 });
    const w1 = res.weeks.find(w => w.week === 1)!;
    expect(w1.factSets).toBe(3);
    expect(w1.plannedSets).toBeGreaterThan(0);
    expect(w1.status).toBe('partial');
    expect(w1.setsPct).toBeLessThan(1);
    expect(res.past.length).toBeGreaterThan(0);
    expect(res.overallPct).toBeGreaterThan(0);
  });

  it('неделя без факта в прошлом — missed, будущая — upcoming', () => {
    const plan = base();
    const res = plWeeklyCompliance(plan, [], { todayIso: TODAY, currentWeek: 2 });
    const w1 = res.weeks.find(w => w.week === 1)!;
    expect(w1.status).toBe('missed');
    expect(w1.note).toContain('нет сессий');
    expect(res.notes.join(' ')).toContain('Дневник тренировок пуст');
    expect(res.hasDiary).toBe(false);
  });

  it('полное выполнение → done (100%)', () => {
    const plan = base();
    const w1planned = plan.weeks[0].days.reduce((s, d) => s + d.exercises.reduce((a, e) => a + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0), 0);
    const full: WorkoutLog = log(1, 8, w1planned);
    const res = plWeeklyCompliance(plan, [full], { todayIso: TODAY, currentWeek: 1 });
    expect(res.weeks.find(w => w.week === 1)!.status).toBe('done');
    expect(res.overallPct).toBe(1);
  });

  it('служебные строки («Отдых») не идут в план сверки', () => {
    const plan = base();
    plan.weeks[0].days[0].exercises.push({ name: 'Отдых', group: 'x', coef: 1, mnosz: 1, pm: 100, rir: 2, workSets: [{ pct: 1, reps: 1, sets: 5, weight: 100, rir: 2 }] } as never);
    const res = plWeeklyCompliance(plan, [], { todayIso: TODAY, currentWeek: 1 });
    const w1 = res.weeks.find(w => w.week === 1)!;
    w1.plannedSets; // без служебных строк план меньше — проверяем отсутствие 5 «отдыхных» сетов
    expect(plan.weeks[0].days[0].exercises.some(e => e.name === 'Отдых')).toBe(true);
    // сами «Отдых»-сеты в факт не попадут (нет weekNumber и они не упражнение)
    const res2 = plWeeklyCompliance(plan, [log(1, 8, 5)], { todayIso: TODAY, currentWeek: 1 });
    expect(res2.weeks.find(w => w.week === 1)!.factSets).toBe(5);
  });
});

describe('pl-season-pro: дрейф плана (факт тяжелее плана)', () => {
  it('RPE ≥9.5 три сессии подряд → предупреждение с советом авторегуляции', () => {
    const w = planFactDriftWarnings([log(1, 9.8), log(2, 10), log(3, 9.6)]);
    expect(w.length).toBe(1);
    expect(w[0].name).toBe('Присед');
    expect(w[0].sessions).toBe(3);
    expect(w[0].note).toContain('перейдите на авторегуляцию');
    expect(driftWarningLine(w)).toContain('Cowley 2025');
  });

  it('лёгкий факт → нет предупреждения', () => {
    expect(planFactDriftWarnings([log(1, 8), log(2, 7.5), log(3, 8)])).toEqual([]);
  });

  it('две сессии подряд — порог не достигнут', () => {
    expect(planFactDriftWarnings([log(1, 10), log(2, 10)])).toEqual([]);
  });
});

describe('pl-season-pro: интенсивностная подсказка', () => {
  it('план с RIR ≤1 на основных подходах → совет про velocity loss', () => {
    const plan = base();
    // Форсим RIR0 на всех основных сетах рабочих недель.
    plan.weeks.forEach(w => { if (w.deload || w.taperWeek) return; w.days.forEach(d => d.exercises.forEach(e => { if (e.load === 'Тяжелая') e.workSets.forEach(ws => { ws.rir = 0; }); })); });
    const adv = plIntensityAdvisory(plan);
    expect(adv.mainSets).toBeGreaterThan(0);
    expect(adv.nearFailureShare).toBeGreaterThan(0.5);
    expect(adv.advisory).toContain('velocity loss');
    expect(adv.advisory).toContain('Zhang 2023');
  });

  it('разгрузочные недели не считаются', () => {
    const plan = base();
    plan.weeks.forEach(w => { if (w.deload) w.days.forEach(d => d.exercises.forEach(e => e.workSets.forEach(ws => { ws.rir = 0; }))); });
    const adv = plIntensityAdvisory(plan);
    //andeload-сеты с RIR0 не должны поднять долю
    const before = adv.nearFailureShare;
    expect(before).toBeLessThan(0.5);
  });

  it('мягкий план → подсказки нет', () => {
    const plan = base();
    plan.weeks.forEach(w => w.days.forEach(d => d.exercises.forEach(e => e.workSets.forEach(ws => { ws.rir = 4; }))));
    const adv = plIntensityAdvisory(plan);
    expect(adv.nearFailureShare).toBe(0);
    expect(adv.advisory).toBe('');
  });
});

// ═══════════ Раунд 3 (§5-bis) ═══════════

/** Дневниковая сессия с фактическими скоростями подходов (VBT). */
const logVel = (week: number, name: string, vels: number[]): WorkoutLog => ({
  id: `v${week}-${name}-${vels.join('_')}`, date: iso(28 - week * 7), duration: 60, overallRPE: 8, recoveryBefore: 80, split: 'test',
  exercises: [{
    id: `ve${week}-${name}`, date: iso(28 - week * 7), exerciseId: 'squat', exerciseName: name,
    sets: vels.map(v => ({ weight: 150, reps: 3, rir: 1, rpe: 8, velocity: v })),
    totalVolume: vels.length * 450, estimated1RM: 160, isCompound: true, weekNumber: week,
  }],
} as never);

describe('раунд 3: разбивка «план vs факт» по дням', () => {
  it('неделя с частичным фактом: день 1 добран, остальные — missed, упражнения размечены', () => {
    const plan = base();
    const day1Ex = plan.weeks[0].days[0].exercises.filter(e => !/^(отдых|тест)/i.test(e.name))[0];
    // Дневник: только первое (по порядку имени) упражнение дня 1, все подходы.
    const planned = day1Ex.workSets.reduce((s, ws) => s + ws.sets, 0);
    const fact: WorkoutLog = {
      id: 'd1', date: iso(7), duration: 60, overallRPE: 8, recoveryBefore: 80, split: 'test',
      exercises: [{
        id: 'd1e', date: iso(7), exerciseId: 'x', exerciseName: day1Ex.name,
        sets: Array.from({ length: planned }, () => ({ weight: 100, reps: 3, rir: 2, rpe: 8 })),
        totalVolume: planned * 300, estimated1RM: 110, isCompound: true, weekNumber: 1,
      }],
    } as never;
    const res = plWeeklyComplianceByDays(plan, [fact], { todayIso: TODAY, currentWeek: 2 });
    const w1 = res.weeks.find(w => w.week === 1)!;
    expect(w1.days.length).toBeGreaterThan(0);
    const d1 = w1.days[0];
    const row = d1.exercises.find(e => e.name === day1Ex.name)!;
    expect(row.status).toBe('done');
    expect(row.factSets).toBeGreaterThanOrEqual(row.plannedSets);
    // Соседние упражнения дня — не выполнены
    expect(d1.exercises.some(e => e.status === 'missed')).toBe(true);
    expect(d1.status).toBe('partial');
    // Дальнейшие дни недели — без факта
    expect(w1.days.slice(1).every(d => d.status === 'missed')).toBe(true);
    expect(res.hasDiary).toBe(true);
  });

  it('без дневника — честный no-data, дни прошедших недель missed', () => {
    const res = plWeeklyComplianceByDays(base(), [], { todayIso: TODAY, currentWeek: 2 });
    expect(res.hasDiary).toBe(false);
    expect(res.notes.join(' ')).toContain('Дневник тренировок пуст');
    expect(res.weeks.find(w => w.week === 1)!.days.every(d => d.status === 'missed')).toBe(true);
  });

  it('будущая неделя без факта — upcoming (не ложный missed)', () => {
    const res = plWeeklyComplianceByDays(base(), [], { todayIso: TODAY, currentWeek: 1 });
    expect(res.weeks.find(w => w.week === 8)!.days.every(d => d.status === 'upcoming')).toBe(true);
  });

  it('одно движение в разных днях недели: факт закрашивает ПЕРВЫЙ день (не оба)', () => {
    // Регресс: ПЛ-циклы дублируют основное движение в разные дни — без закрепления
    // «выполнение» недели удваивалось, и оба дня выглядели частично выполненными.
    const plan = base();
    const w0 = plan.weeks[0];
    const exName = (w0.days[0].exercises.find(e => !/^(отдых|тест)/i.test(e.name)) || w0.days[0].exercises[0]).name;
    const exSets = w0.days[0].exercises[0].workSets.reduce((s, ws) => s + ws.sets, 0);
    // Кладим то же движение и во второй день плана.
    if (w0.days[1]) {
      w0.days[1].exercises.push({ ...w0.days[0].exercises[0], name: exName });
    } else {
      w0.days.push({ exercises: [{ ...w0.days[0].exercises[0], name: exName }], metrics: w0.days[0].metrics } as never);
    }
    const fact: WorkoutLog = {
      id: 'dupf', date: iso(7), duration: 60, overallRPE: 8, recoveryBefore: 80, split: 'test',
      exercises: [{
        id: 'dupe', date: iso(7), exerciseId: 'x', exerciseName: exName,
        sets: Array.from({ length: exSets }, () => ({ weight: 100, reps: 3, rir: 2, rpe: 8 })),
        totalVolume: exSets * 300, estimated1RM: 110, isCompound: true, weekNumber: 1,
      }],
    } as never;
    const res = plWeeklyComplianceByDays(plan, [fact], { todayIso: TODAY, currentWeek: 2 });
    const days = res.weeks.find(w => w.week === 1)!.days;
    const withEx = days.filter(d => d.exercises.some(e => e.name === exName));
    expect(withEx.length).toBeGreaterThanOrEqual(2);
    // Только первый день несёт факт; остальные — нет (иначе сумма удваивалась).
    expect(withEx[0].exercises.find(e => e.name === exName)!.factSets).toBe(exSets);
    expect(withEx.slice(1).every(d => d.exercises.find(e => e.name === exName)!.factSets === 0)).toBe(true);
    expect(withEx.slice(1).every(d => d.status === 'missed')).toBe(true);
    // Недельный факт равен одному проходу, а не N.
    expect(res.weeks.find(w => w.week === 1)!.factSets).toBe(exSets);
  });
});

describe('раунд 3: фактическая потеря скорости (VBT)', () => {
  it('скорости подходов → loss best→last; <2 скоростей не считаются', () => {
    const res = plVelocityLossFact([logVel(1, 'Присед', [0.9, 0.85, 0.8])]);
    expect(res.exercises.length).toBe(1);
    expect(res.exercises[0].name).toBe('Присед');
    // (0.9-0.8)/0.9 = 11.1%
    expect(res.exercises[0].avgLossPct).toBeCloseTo(11.1, 1);
    expect(res.avgLossPct).toBeCloseTo(11.1, 1);
    // одна скорость — сессия не информативна
    expect(plVelocityLossFact([logVel(1, 'Присед', [0.8])]).sessions).toBe(0);
    expect(plVelocityLossFact([]).avgLossPct).toBeNull();
  });

  it('подсказка интенсивности считается ПО ФАКТУ, когда есть скорости', () => {
    const plan = base();
    const adv = plIntensityAdvisory(plan, { sessions: [logVel(1, 'Присед', [0.9, 0.6, 0.45])] });
    expect(adv.source).toBe('diary-velocity');
    expect(adv.advisory).toContain('факту дневника');
    // (0.9-0.45)/0.9 = 50% → стоп-зона
    expect(adv.advisory).toContain('стоп-зона');
  });

  it('без скоростей подсказка остаётся расчётной по RIR (байт-в-байт)', () => {
    const plan = base();
    plan.weeks.forEach(w => { if (w.deload || w.taperWeek) return; w.days.forEach(d => d.exercises.forEach(e => { if (e.load === 'Тяжелая') e.workSets.forEach(ws => { ws.rir = 0; }); })); });
    const adv = plIntensityAdvisory(plan, { sessions: [logVel(1, 'Присед', [])] });
    expect(adv.source).toBe('plan-rir');
    expect(adv.nearFailureShare).toBeGreaterThan(0.5);
  });
});

describe('раунд 3: экспорт отчёта «план vs факт»', () => {
  const report = () => {
    const plan = base();
    const w1planned = plan.weeks[0].days.reduce((s, d) => s + d.exercises.reduce((a, e) => a + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0), 0);
    const res = plWeeklyCompliance(plan, [log(1, 9.8, w1planned)], { todayIso: TODAY, currentWeek: 2 });
    return {
      res,
      days: plWeeklyComplianceByDays(plan, [log(1, 9.8, w1planned)], { todayIso: TODAY, currentWeek: 2 }),
      drift: planFactDriftWarnings([log(1, 9.8), log(2, 10), log(3, 9.6)]),
    };
  };

  it('CSV: недели + дни + упражнения + дрейф, формульная защита', () => {
    const { res, days, drift } = report();
    const csv = buildPLComplianceCsv({ result: res, days, drift });
    expect(csv).toContain('Тип;Объект');
    expect(csv).toContain('Неделя;Нед 1;');
    expect(csv).toContain('День;Нед 1 Д1;');
    expect(csv).toContain('Упражнение;Нед 1 Д1');
    expect(csv).toContain('Дрейф;Присед;');
    // формульная инъекция: имя упражнения дрейфа с «=» в начале гасится апострофом
    const evil = buildPLComplianceCsv({
      result: res,
      days,
      drift: [{ name: '=1+1', sessions: 3, avgFactRpe: 9.7, note: 'тест' }],
    });
    expect(evil).toContain("Дрейф;'=1+1;");
  });

  it('HTML: статусы недель + экранирование пользовательских строк (XSS)', () => {
    const { res, days, drift } = report();
    const html = buildPLComplianceHtml({
      result: res, days, drift,
      title: '<script>alert(1)</script>',
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Разбивка по дням');
    expect(html).toContain('Дрейф плана');
  });
});

describe('раунд 3: сезонный ICS с тренировочными сессиями', () => {
  it('seasonStart + withTrainingSessions → VEVENT на каждый день недели', () => {
    const plan = base();
    const ics = buildPLSeasonIcs(plan.weeks, [], { todayIso: TODAY, seasonStart: '2026-09-07', withTrainingSessions: true });
    const events = (ics.match(/BEGIN:VEVENT/g) || []).length;
    const days = plan.weeks.reduce((s, w) => s + w.days.length, 0);
    expect(events).toBe(days);
    expect(ics).toContain('🏋 Н1 Д1');
    // дни раскладываются позиционно от начала недели: неделя 1 = seasonStart
    expect(ics).toContain('DTSTART;VALUE=DATE:20260907');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260908');
    // описание несёт упражнения с подходами
    expect(ics).toMatch(/DESCRIPTION:.*\d+×\d+ @\d+кг/);
  });

  it('без дат и seasonStart сессии честно пропускаются', () => {
    const ics = buildPLSeasonIcs(base().weeks, [], { todayIso: TODAY, withTrainingSessions: true });
    expect(ics).not.toContain('VEVENT');
  });

  it('withTrainingSessions=false — прежний состав событий (байт-в-байт)', () => {
    const plan = appendPLTaperWeeks(base(), 2, {
      windowWeeks: 4, reference: '2026-12-20', mockMeet: { strategy: 'balanced' }, meetWeek: { strategy: 'balanced' }, postMeet: { volumeMult: 0.5 },
    });
    const meets = [{ id: 'm1', name: 'Старт', weeksToStart: 8 }];
    const off = buildPLSeasonIcs(plan.weeks, meets, { todayIso: TODAY });
    const on = buildPLSeasonIcs(plan.weeks, meets, { todayIso: TODAY, withTrainingSessions: true });
    const offEvents = (off.match(/BEGIN:VEVENT/g) || []).length;
    const onEvents = (on.match(/BEGIN:VEVENT/g) || []).length;
    expect(offEvents).toBeGreaterThan(0);
    expect(onEvents).toBeGreaterThan(offEvents);
    // Сессии дописываются ПЕРЕД END:VCALENDAR: всё содержимое «off» — префикс «on».
    expect(on.startsWith(off.replace(/\r\nEND:VCALENDAR$/, ''))).toBe(true);
  });
});

describe('раунд 3: дат-канон (frozen clock, §5-bis п.6)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('«сегодня» по умолчанию — ЛОКАЛЬНАЯ дата замороженных часов (не UTC)', () => {
    // Граница суток: 23:45 UTC = утро следующего дня в UTC+10 — UTC-дата врёт.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T23:45:00Z'));
    const expected = localIsoDate();
    const res = plWeeklyCompliance(base(), [], { currentWeek: 1 });
    // Неделя 1 без weekStart и currentWeek=1 → «missed» (уже началась).
    expect(res.weeks.find(w => w.week === 1)!.status).toBe('missed');
    const days = plWeeklyComplianceByDays(base(), [], { currentWeek: 1 });
    expect(days.weeks.find(w => w.week === 1)!.days.every(d => d.status === 'missed')).toBe(true);
    // Имя файла календаря — тоже по локальной дате.
    expect(plSeasonIcsFilename('pl-season')).toBe(`pl-season-${expected}.ics`);
    expect(expected).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('ISO→ICS и позиционная раскладка сессий не зависят от часов', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-08T00:30:00Z'));
    const ics = buildPLSeasonIcs(base().weeks, [], { todayIso: '2026-05-04', seasonStart: '2026-09-07', withTrainingSessions: true });
    expect(ics).toContain('DTSTART;VALUE=DATE:20260907');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260914');
  });
});
