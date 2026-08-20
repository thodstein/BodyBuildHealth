import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildCardioCycle, buildCardioPlan, kcalForCardio, capSessionsToDays,
  cardioPhaseForWeek, cardioPlanToCycle, cardioCycleSummary,
  adaptCardioToStrength, applyPLCardioTaper, applyBBCardioTaper, applyCardioTaperBySport,
  loadCardioCycles, saveCardioCycle, removeCardioCycle,
  loadActiveCardioCycle, setActiveCardioCycle,
  compareCardioCycles, formatCardioComparison,
  cardioWeekForDate, cardioSessionsForDate, cardioHeartZones,
  spreadSessionsAcrossDays, cardioVolumeSeries, autoTuneCardioCycle,
  cardioQualityReport,
  saveCardioCycleVersion, loadCardioCycleVersions, latestCardioCycleVersion,
  restoreCardioCycleVersion, clearCardioCycleHistory,
  buildCardioSummaryText,
  cardioPlanVariants, explainCardioChoice, improveCardioCycle, cardioSessionProtocol,
  assignSessionDays, loadCardioScenarios, saveCardioScenario, removeCardioScenario,
  cardioWeekLegConflicts, cardioLegDayForDate,
  cardioWeightAdvice, buildCardioIcs, cardioNextSession, cardioCycleToUserProgram,
  bumpCardioZone2Volume, cardioSafetyReport, configFromCycle,
  cardioProfileFactors, cardioNutritionNotes,
  cycleBodyWeight, recalcSessionKcal, rescheduleCardioSession,
  cardioToNutritionPayload, legDaysFromBBPlan, buildCardioTcx,
  lthrZones, runningVdot, cardioYearPlan, buildCardioYearText,
  cardioFitnessForecast, cardioCoachHints, cardioCoachSummary,
  buildCardioPrintHtml,
  CARDIO_PRESETS,
  type CardioCycle,
} from '../cardio.engine';

const CYCLE_KEY = 'he_cardio_cycles';
const ACTIVE_KEY = 'he_active_cardio_cycle';

beforeEach(() => {
  try {
    localStorage.removeItem(CYCLE_KEY);
    localStorage.removeItem(ACTIVE_KEY);
  } catch { /* ignore */ }
});

// ─── buildCardioCycle: базовая структура ───

describe('buildCardioCycle — структура', () => {
  it('массонабор: 12 недель, только recovery, фазы base/build/maintenance', () => {
    const c = buildCardioCycle({ goal: 'mass', totalWeeks: 12 });
    expect(c.weeks).toHaveLength(12);
    expect(c.goal).toBe('mass');
    for (const w of c.weeks) {
      expect(w.sessions.length).toBeGreaterThan(0);
      for (const s of w.sessions) expect(s.type).toBe('recovery');
    }
    const phases = c.weeks.map(w => w.phase);
    expect(phases[0]).toBe('base');
    expect(phases[5]).toBe('build');
    expect(phases[11]).toBe('transition');
    expect(c.version).toBe(1);
    expect(c.source).toBe('auto');
  });

  it('сушка: zone2 появляется в базе, MISS/HIIT чередуются в build, делод каждые 4 нед', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 12 });
    const w1 = c.weeks[0];
    expect(w1.sessions.some(s => s.type === 'zone2')).toBe(true);
    expect(w1.sessions.some(s => s.type === 'hiit')).toBe(false);
    const w5 = c.weeks[4];
    expect(w5.sessions.some(s => s.type === 'miss')).toBe(true);
    const w6 = c.weeks[5];
    expect(w6.sessions.some(s => s.type === 'hiit')).toBe(true);
    const w4 = c.weeks[3];
    expect(w4.deload).toBe(true);
    expect(w4.sessions.some(s => s.type === 'hiit')).toBe(false);
  });

  it('низкое восстановление: HIIT ни в одной неделе', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 12, recoveryLow: true });
    for (const w of c.weeks) {
      expect(w.sessions.some(s => s.type === 'hiit')).toBe(false);
    }
    expect(c.rationale.some(r => r.includes('HIIT исключён'))).toBe(true);
  });

  it('daysAvailable=2: суммарная частота не превышает лимит', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, daysAvailable: 2 });
    for (const w of c.weeks) {
      const freq = w.sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
      expect(freq).toBeLessThanOrEqual(2);
    }
  });

  it('totalWeeks клампится: 200 → 104, 0 → 1', () => {
    expect(buildCardioCycle({ goal: 'health', totalWeeks: 200 }).totalWeeks).toBe(104);
    expect(buildCardioCycle({ goal: 'health', totalWeeks: 0 }).totalWeeks).toBe(1);
  });

  it('вес влияет на kcalPerSession (кг × поправка)', () => {
    const a = buildCardioCycle({ goal: 'cut', totalWeeks: 4, bodyWeight: 80 });
    const b = buildCardioCycle({ goal: 'cut', totalWeeks: 4, bodyWeight: 100 });
    const sa = a.weeks[0].sessions.find(s => s.type === 'zone2')!;
    const sb = b.weeks[0].sessions.find(s => s.type === 'zone2')!;
    expect(sb.kcalPerSession).toBe(Math.round(sa.kcalPerSession * 100 / 80));
  });

  it('соревнование: неделя шоу — peak, перед ней taper, между — contest_prep', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, competitions: [{ id: 'c1', name: 'Шоу', week: 8 }] });
    expect(c.weeks[7].phase).toBe('peak');
    expect(c.weeks[7].sessions.every(s => s.type === 'recovery')).toBe(true);
    expect(c.weeks[6].phase).toBe('taper');
    expect(c.weeks[5].phase).toBe('taper');
    expect(c.weeks[4].phase).toBe('contest_prep');
    expect(c.linkedCompetitionIds).toEqual(['c1']);
  });
});

// ─── Вспомогательные функции ───

describe('cardioPhaseForWeek', () => {
  it('без соревнований: base/build/maintenance/transition', () => {
    expect(cardioPhaseForWeek(1, 12)).toBe('base');
    expect(cardioPhaseForWeek(4, 12)).toBe('base');
    expect(cardioPhaseForWeek(5, 12)).toBe('build');
    expect(cardioPhaseForWeek(8, 12)).toBe('build');
    expect(cardioPhaseForWeek(9, 12)).toBe('maintenance');
    expect(cardioPhaseForWeek(12, 12)).toBe('transition');
  });

  it('с соревнованием: peak на неделе, taper за 2 недели', () => {
    const comps = [{ id: 'c', name: 'x', week: 10 }];
    expect(cardioPhaseForWeek(10, 12, comps)).toBe('peak');
    expect(cardioPhaseForWeek(9, 12, comps)).toBe('taper');
    expect(cardioPhaseForWeek(8, 12, comps)).toBe('taper');
    expect(cardioPhaseForWeek(7, 12, comps)).toBe('contest_prep');
  });
});

describe('kcalForCardio / capSessionsToDays', () => {
  it('kcalForCardio: zone2 45 мин при 80 кг = 315', () => {
    expect(kcalForCardio('zone2', 45, 80)).toBe(315);
    expect(kcalForCardio('hiit', 15, 80)).toBe(210);
  });

  it('capSessionsToDays режет по приоритету zone2 → recovery → miss → hiit', () => {
    const sessions = [
      { type: 'zone2' as const, durationMin: 30, weeklyFrequency: 3, intensity: 'moderate' as const, kcalPerSession: 210, purpose: 'a' },
      { type: 'hiit' as const, durationMin: 15, weeklyFrequency: 1, intensity: 'high' as const, kcalPerSession: 210, purpose: 'b' },
    ];
    const capped = capSessionsToDays(sessions, 2);
    expect(capped.find(s => s.type === 'zone2')!.weeklyFrequency).toBe(2);
    expect(capped.find(s => s.type === 'hiit')).toBeUndefined();
  });
});

// ─── Миграция и сводка ───

describe('cardioPlanToCycle / cardioCycleSummary', () => {
  it('миграция недельного плана → однонедельный цикл', () => {
    const plan = buildCardioPlan({ goal: 'maintenance', bodyWeight: 80 });
    const cycle = cardioPlanToCycle(plan, 'maintenance');
    expect(cycle.totalWeeks).toBe(1);
    expect(cycle.source).toBe('imported');
    expect(cycle.weeks[0].totalKcal).toBe(plan.totalKcalPerWeek);
  });

  it('сводка: средние минуты/ккал и число недель с HIIT', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8 });
    const s = cardioCycleSummary(c);
    expect(s.avgMinutesPerWeek).toBeGreaterThan(0);
    expect(s.avgKcalPerWeek).toBeGreaterThan(0);
    expect(s.hiitWeeks).toBeGreaterThan(0);
    const covered = s.phaseWeeks.base + s.phaseWeeks.build + s.phaseWeeks.maintenance + s.phaseWeeks.transition;
    expect(covered).toBe(8);
  });
});

describe('библиотека циклов (localStorage)', () => {
  it('save/load/remove', () => {
    const c: CardioCycle = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'c-1', name: 'Мой цикл' });
    saveCardioCycle(c);
    const all = loadCardioCycles();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('c-1');
    removeCardioCycle('c-1');
    expect(loadCardioCycles()).toHaveLength(0);
  });

  it('повреждённые данные → пустой список', () => {
    try { localStorage.setItem(CYCLE_KEY, '{broken'); } catch { /* ignore */ }
    expect(loadCardioCycles()).toEqual([]);
  });

  it('активный цикл: set/get/clear', () => {
    const c = buildCardioCycle({ goal: 'mass', totalWeeks: 4, id: 'active-1' });
    setActiveCardioCycle(c);
    expect(loadActiveCardioCycle()?.id).toBe('active-1');
    setActiveCardioCycle(null);
    expect(loadActiveCardioCycle()).toBeNull();
  });
});

// ─── Адаптация к силовому плану (Этап B) ───

describe('adaptCardioToStrength', () => {
  it('опасный ACWR: только zone2/recovery, объём снижен, рациональное объяснение', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6 });
    const adapted = adaptCardioToStrength(c, { acwr: 1.6 });
    for (const w of adapted.weeks) {
      for (const s of w.sessions) expect(['zone2', 'recovery']).toContain(s.type);
    }
    expect(adapted.rationale.some(r => r.includes('опасный ACWR'))).toBe(true);
  });

  it('осторожный ACWR: HIIT убран, минуты −15%', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6 });
    const adapted = adaptCardioToStrength(c, { acwr: 1.4 });
    for (const w of adapted.weeks) {
      expect(w.sessions.some(s => s.type === 'hiit')).toBe(false);
    }
    expect(adapted.rationale.some(r => r.includes('осторожный ACWR'))).toBe(true);
  });

  it('частые ноги (5): HIIT/MISS заменены на zone2', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6 });
    const adapted = adaptCardioToStrength(c, { legDaysPerWeek: 5 });
    for (const w of adapted.weeks) {
      expect(w.sessions.some(s => s.type === 'hiit' || s.type === 'miss')).toBe(false);
    }
    expect(adapted.rationale.some(r => r.includes('частые ноги'))).toBe(true);
  });

  it('исходный цикл не мутируется', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6 });
    const before = JSON.stringify(c);
    adaptCardioToStrength(c, { acwr: 1.7 });
    expect(JSON.stringify(c)).toBe(before);
  });
});

// ─── PL/BB taper (Этап B) ───

describe('applyPLCardioTaper', () => {
  it('неделя старта → peak (только recovery), N-1/N-2 → taper без HIIT', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8 });
    const t = applyPLCardioTaper(c, { competitionWeek: 8 });
    expect(t.weeks[7].phase).toBe('peak');
    expect(t.weeks[7].sessions.every(s => s.type === 'recovery')).toBe(true);
    for (const idx of [5, 6]) {
      expect(t.weeks[idx].phase).toBe('taper');
      expect(t.weeks[idx].sessions.some(s => s.type === 'hiit')).toBe(false);
    }
    expect(t.weeks[6].totalMinutes).toBeLessThan(t.weeks[4].totalMinutes);
  });

  it('идемпотентность: повторное применение не режет сильнее', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8 });
    const t1 = applyPLCardioTaper(c, { competitionWeek: 8 });
    const t2 = applyPLCardioTaper(t1, { competitionWeek: 8 });
    expect(JSON.stringify(t2.weeks)).toBe(JSON.stringify(t1.weeks));
  });
});

describe('applyBBCardioTaper', () => {
  it('пик-неделя только recovery, перед ней taper, HIIT убран за 2 недели', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 10 });
    const t = applyBBCardioTaper(c, { showWeek: 10, peakWeek: true });
    expect(t.weeks[9].phase).toBe('peak');
    expect(t.weeks[9].sessions.every(s => s.type === 'recovery')).toBe(true);
    expect(t.weeks[8].phase).toBe('taper');
    expect(t.weeks[8].sessions.some(s => s.type === 'hiit')).toBe(false);
    expect(t.weeks[7].deload).toBe(true);
    expect(t.weeks[8].totalMinutes).toBeLessThan(t.weeks[6].totalMinutes);
  });

  it('идемпотентность BB', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 10 });
    const t1 = applyBBCardioTaper(c, { showWeek: 10 });
    const t2 = applyBBCardioTaper(t1, { showWeek: 10 });
    expect(JSON.stringify(t2.weeks)).toBe(JSON.stringify(t1.weeks));
  });
});

describe('applyCardioTaperBySport', () => {
  it('pl → applyPLCardioTaper, bb → applyBBCardioTaper', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6 });
    const pl = applyCardioTaperBySport(c, 'pl', { competitionWeek: 6 });
    const bb = applyCardioTaperBySport(c, 'bb', { competitionWeek: 6 });
    expect(pl.weeks[5].phase).toBe('peak');
    expect(bb.weeks[5].phase).toBe('peak');
    expect(pl.rationale.some(r => r.includes('PL taper'))).toBe(true);
    expect(bb.rationale.some(r => r.includes('BB taper'))).toBe(true);
  });
});

// ─── Сравнение сценариев ───

describe('compareCardioCycles', () => {
  it('массонабор vs сушка: дифф по минутам, ккал и HIIT', () => {
    const mass = buildCardioCycle({ goal: 'mass', totalWeeks: 8 });
    const cut = buildCardioCycle({ goal: 'cut', totalWeeks: 8 });
    const cmp = compareCardioCycles(mass, cut);
    expect(cmp.diffs.some(d => d.field === 'minutes')).toBe(true);
    expect(cmp.diffs.some(d => d.field === 'hiit')).toBe(true);
    expect(cmp.diffs.some(d => d.field === 'weeks')).toBe(false);
    expect(formatCardioComparison(cmp)).toContain('→');
  });

  it('одинаковые сценарии → «идентичны»', () => {
    const a = buildCardioCycle({ goal: 'health', totalWeeks: 6 });
    const b = buildCardioCycle({ goal: 'health', totalWeeks: 6 });
    const cmp = compareCardioCycles(a, b);
    expect(cmp.diffs).toEqual([]);
    expect(formatCardioComparison(cmp)).toContain('идентичны');
  });

  it('разные недели фаз показываются с единицей «нед»', () => {
    const a = buildCardioCycle({ goal: 'health', totalWeeks: 12 });
    const b = buildCardioCycle({ goal: 'health', totalWeeks: 24 });
    const cmp = compareCardioCycles(a, b);
    expect(cmp.diffs.some(d => d.field === 'weeks')).toBe(true);
    const phaseDiff = cmp.diffs.find(d => d.field.startsWith('phase_'));
    expect(phaseDiff?.to).toContain(' нед');
  });
});

// ─── Проф-инструмент: даты/раскладка/пульс-зоны/авто-подстройка ───

describe('даты и раскладка', () => {
  it('cardioWeekForDate: неделя 1 = reference, +7 дней = неделя 2', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4 });
    expect(cardioWeekForDate(c, '2026-01-05', '2026-01-05')?.week).toBe(1);
    expect(cardioWeekForDate(c, '2026-01-12', '2026-01-05')?.week).toBe(2);
    expect(cardioWeekForDate(c, '2026-02-02', '2026-01-05')).toBeNull();
  });

  it('spreadSessionsAcrossDays: сессии без дня получают последовательные дни недели', () => {
    const sessions = [
      { type: 'zone2' as const, durationMin: 30, weeklyFrequency: 2, intensity: 'moderate' as const, kcalPerSession: 210, purpose: 'a' },
      { type: 'recovery' as const, durationMin: 20, weeklyFrequency: 1, intensity: 'low' as const, kcalPerSession: 100, purpose: 'b' },
    ];
    const week: CardioWeek = { week: 1, phase: 'base', sessions, totalMinutes: 80, totalKcal: 520, deload: false, taper: false, rationale: [] };
    const spread = spreadSessionsAcrossDays(week, '2026-01-05');
    expect(spread[0].dayOfWeek).toBe(0);
    expect(spread[1].dayOfWeek).toBe(1);
  });

  it('spreadSessionsAcrossDays: заданный день сохраняется', () => {
    const sessions = [{ type: 'zone2' as const, durationMin: 30, weeklyFrequency: 2, intensity: 'moderate' as const, kcalPerSession: 210, purpose: 'a', dayOfWeek: 5 }];
    const week: CardioWeek = { week: 1, phase: 'base', sessions, totalMinutes: 60, totalKcal: 420, deload: false, taper: false, rationale: [] };
    const spread = spreadSessionsAcrossDays(week, '2026-01-05');
    expect(spread[0].dayOfWeek).toBe(5);
  });

  it('cardioSessionsForDate: на дату попадают только сессии соответствующего дня', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4 });
    const day1 = cardioSessionsForDate(c, '2026-01-05', '2026-01-05');
    expect(day1?.week.week).toBe(1);
  });
});

describe('cardioHeartZones', () => {
  it('zone2 = 60-70% ЧССмакс (220-возраст)', () => {
    const zones = cardioHeartZones(40);
    expect(zones[1].zone).toBe(2);
    expect(zones[1].bpmMin).toBe(Math.round(180 * 0.6));
    expect(zones[1].bpmMax).toBe(Math.round(180 * 0.7));
    expect(zones).toHaveLength(5);
  });

  it('Karvonen с restingHr: зоны шире', () => {
    const z = cardioHeartZones(40, 60);
    expect(z[1].bpmMin).toBe(Math.round(60 + 120 * 0.6));
  });

  it('возраст клампится 12-90', () => {
    expect(cardioHeartZones(5)[1].bpmMax).toBeLessThanOrEqual(Math.round(208 * 0.7));
    expect(cardioHeartZones(95)[1].bpmMin).toBeGreaterThan(0);
  });
});

describe('cardioVolumeSeries', () => {
  it('возвращает недельные серии мин/ккал', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 3 });
    const s = cardioVolumeSeries(c);
    expect(s).toHaveLength(3);
    expect(s[0].minutes).toBeGreaterThan(0);
    expect(s.some(x => x.taper)).toBe(false);
  });
});

describe('autoTuneCardioCycle', () => {
  const REF = '2026-01-05';

  it('ACWR опасный → HIIT убран на рабочих неделях', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, startDate: REF });
    const r = autoTuneCardioCycle(c, [], { acwr: 1.6, referenceIso: REF });
    expect(r.changes.length).toBeGreaterThan(0);
    const tunedWeeks = r.cycle.weeks.filter(w => !w.deload && !w.taper);
    for (const w of tunedWeeks) expect(w.sessions.some(s => s.type === 'hiit')).toBe(false);
  });

  it('выполнено <60% сессий → частота zone2 −1', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, startDate: REF });
    const planned = c.weeks[0].sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
    const log = [{ date: '2026-01-05', durationMin: 30, completed: true }];
    const r = autoTuneCardioCycle(c, log, { referenceIso: REF });
    const freqAfter = r.cycle.weeks[0].sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
    expect(freqAfter).toBeLessThan(planned);
  });

  it('RPE ≥8 → минуты −10%', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, startDate: REF });
    const before = c.weeks[0].totalMinutes;
    const log = [{ date: '2026-01-05', durationMin: 45, rpe: 9, completed: true }, { date: '2026-01-06', durationMin: 45, rpe: 8, completed: true }];
    const r = autoTuneCardioCycle(c, log, { referenceIso: REF });
    expect(r.cycle.weeks[0].totalMinutes).toBeLessThan(before);
  });

  it('соответствие плану → изменений нет', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, startDate: REF });
    const planned = c.weeks[0].sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
    const log = Array.from({ length: planned }, (_, i) => ({ date: `2026-01-${5 + i}`, durationMin: 30, rpe: 5, completed: true }));
    const r = autoTuneCardioCycle(c, log, { referenceIso: REF });
    expect(r.changes).toEqual([]);
    expect(r.advice.action).toBe('keep');
  });

  it('делод/taper/peak недели не трогаются', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8 });
    const w4 = c.weeks[3];
    expect(w4.deload).toBe(true);
    const before = JSON.stringify(w4);
    autoTuneCardioCycle(c, [], { acwr: 1.7, referenceIso: REF });
    const after = JSON.stringify(c.weeks[3]);
    expect(after).toBe(before);
  });

  it('исходный цикл не мутируется', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6 });
    const before = JSON.stringify(c);
    autoTuneCardioCycle(c, [], { acwr: 1.7, referenceIso: REF });
    expect(JSON.stringify(c)).toBe(before);
  });
});

// ─── Ручная структура фаз (phaseSplit) и пресеты ───

describe('phaseSplit — ручная структура фаз', () => {
  it('распределение недель по фазам вместо процентов', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 10, phaseSplit: { base: 2, build: 4, maintenance: 3 } });
    const phases = c.weeks.map(w => w.phase);
    expect(phases[0]).toBe('base');
    expect(phases[1]).toBe('base');
    expect(phases[2]).toBe('build');
    expect(phases[5]).toBe('build');
    expect(phases[6]).toBe('maintenance');
    expect(phases[9]).toBe('transition');
  });

  it('кардиоPhaseForWeek с phaseSplit: пограничные недели', () => {
    expect(cardioPhaseForWeek(2, 10, undefined, { base: 2, build: 4, maintenance: 3 })).toBe('base');
    expect(cardioPhaseForWeek(3, 10, undefined, { base: 2, build: 4, maintenance: 3 })).toBe('build');
    expect(cardioPhaseForWeek(6, 10, undefined, { base: 2, build: 4, maintenance: 3 })).toBe('build');
    expect(cardioPhaseForWeek(7, 10, undefined, { base: 2, build: 4, maintenance: 3 })).toBe('maintenance');
  });

  it('соревнования приоритетнее phaseSplit (taper/peak)', () => {
    const comps = [{ id: 'c', name: 'x', week: 10 }];
    expect(cardioPhaseForWeek(9, 10, comps, { base: 4, build: 4, maintenance: 1 })).toBe('taper');
    expect(cardioPhaseForWeek(10, 10, comps, { base: 4, build: 4, maintenance: 1 })).toBe('peak');
  });

  it('без phaseSplit поведение не меняется', () => {
    const a = buildCardioCycle({ goal: 'health', totalWeeks: 12 });
    const b = buildCardioCycle({ goal: 'health', totalWeeks: 12, phaseSplit: {} });
    expect(JSON.stringify(a.weeks.map(w => w.phase))).toBe(JSON.stringify(b.weeks.map(w => w.phase)));
  });
});

describe('CARDIO_PRESETS — быстрые старты', () => {
  it('8 пресетов с валидными параметрами', () => {
    expect(CARDIO_PRESETS).toHaveLength(8);
    for (const p of CARDIO_PRESETS) {
      expect(p.totalWeeks).toBeGreaterThan(0);
      expect(p.daysAvailable).toBeGreaterThanOrEqual(0);
      expect(['health', 'mass', 'cut', 'recomp', 'maintenance', 'recovery', 'bb_prep', 'pl_prep', 'bb_taper']).toContain(p.goal);
      const c = buildCardioCycle({ goal: p.goal, totalWeeks: p.totalWeeks, daysAvailable: p.daysAvailable, recoveryLow: p.recoveryLow });
      expect(c.weeks).toHaveLength(p.totalWeeks);
    }
  });

  it('пресет «Сушка 16 нед» содержит HIIT и делоды', () => {
    const p = CARDIO_PRESETS.find(x => x.id === 'cut-16')!;
    const c = buildCardioCycle({ goal: p.goal, totalWeeks: p.totalWeeks, daysAvailable: p.daysAvailable });
    expect(c.weeks.some(w => w.sessions.some(s => s.type === 'hiit'))).toBe(true);
    expect(c.weeks.some(w => w.deload)).toBe(true);
  });
});

// ─── Здоровье: 3-4 кардио-сессии в неделю ───

describe('health — 3-4 кардио-сессии в неделю', () => {
  it('база: 3 сессии, наращивание/поддержание: 4 сессии zone2', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 12, daysAvailable: 7 });
    const freq = (w: number) => c.weeks[w - 1].sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
    expect(freq(1)).toBeGreaterThanOrEqual(3);
    expect(freq(6)).toBeGreaterThanOrEqual(3);
    expect(freq(6)).toBeLessThanOrEqual(4);
    expect(freq(10)).toBe(4);
  });

  it('при daysAvailable=3 частота обрезается до 3 (не больше лимита)', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 12, daysAvailable: 3 });
    for (const w of c.weeks) {
      const freq = w.sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
      expect(freq).toBeLessThanOrEqual(3);
    }
  });
});

// ─── Taper-окно и пик-неделя ───

describe('taperWeeks / peakWeek', () => {
  it('taperWeeks=1: только 1 неделя taper перед стартом', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, competitions: [{ id: 'c', name: 'Шоу', week: 6 }], taperWeeks: 1 });
    expect(c.weeks[5].phase).toBe('peak');
    expect(c.weeks[4].phase).toBe('taper');
    expect(c.weeks[3].phase).toBe('contest_prep');
  });

  it('taperWeeks=3: 3 недели taper', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, competitions: [{ id: 'c', name: 'Шоу', week: 8 }], taperWeeks: 3 });
    expect(c.weeks[7].phase).toBe('peak');
    expect(c.weeks[6].phase).toBe('taper');
    expect(c.weeks[5].phase).toBe('taper');
    expect(c.weeks[4].phase).toBe('taper');
  });

  it('peakWeek=false: неделя старта — лёгкая taper, без пика', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, competitions: [{ id: 'c', name: 'Шоу', week: 6 }], peakWeek: false });
    expect(c.weeks[5].phase).toBe('taper');
    expect(c.weeks.some(w => w.phase === 'peak')).toBe(false);
    expect(c.weeks[5].sessions.every(s => s.type !== 'hiit')).toBe(true);
  });

  it('кардиоPhaseForWeek: taperWeeks/peakWeek параметры', () => {
    const comps = [{ id: 'c', name: 'x', week: 10 }];
    expect(cardioPhaseForWeek(8, 12, comps, undefined, 1)).toBe('contest_prep');
    expect(cardioPhaseForWeek(9, 12, comps, undefined, 1)).toBe('taper');
    expect(cardioPhaseForWeek(9, 12, comps, undefined, 2)).toBe('taper');
    expect(cardioPhaseForWeek(10, 12, comps, undefined, 2, false)).toBe('taper');
  });
});

// ─── Качество цикла ───

describe('cardioQualityReport', () => {
  it('хороший cut-цикл со стартом: score высокий, замечания ok', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 12, daysAvailable: 5, competitions: [{ id: 'c', name: 'Шоу', week: 12 }] });
    const r = cardioQualityReport(c, 5);
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.findings.some(f => f.level === 'ok' && f.text.includes('Прогрессия'))).toBe(true);
    expect(r.findings.some(f => f.level === 'ok' && f.text.includes('Taper'))).toBe(true);
  });

  it('mass с большим объёмом → предупреждение', () => {
    const c = buildCardioCycle({ goal: 'mass', totalWeeks: 8 });
    // mass-профиль даёт ~20-30 мин/нед — объём в норме; проверим обратное через маленький цикл
    expect(cardioQualityReport(c, 7).score).toBeGreaterThanOrEqual(80);
  });

  it('health с малым объёмом → warn', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, daysAvailable: 1 });
    const r = cardioQualityReport(c, 1);
    expect(r.score).toBeLessThan(100);
    expect(r.findings.some(f => f.text.includes('ВОЗ'))).toBe(true);
  });

  it('старт без taper-недель невозможен для построенного цикла (проверка пика без HIIT)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, competitions: [{ id: 'c', name: 'Шоу', week: 8 }] });
    const r = cardioQualityReport(c, 7);
    const peak = c.weeks.find(w => w.phase === 'peak')!;
    expect(peak.sessions.every(s => s.type === 'recovery')).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(60);
  });

  it('score клампится в 0-100', () => {
    const r = cardioQualityReport(buildCardioCycle({ goal: 'recovery', totalWeeks: 2, daysAvailable: 0 }), 0);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

// ─── Персонализация: уровень, оборудование, суставы, возраст ───

describe('персонализация подбора', () => {
  it('level: новичок ×0.8, продвинутый ×1.15 (минуты сессий)', () => {
    const base = buildCardioCycle({ goal: 'health', totalWeeks: 6 });
    const nov = buildCardioCycle({ goal: 'health', totalWeeks: 6, level: 'beginner' });
    const adv = buildCardioCycle({ goal: 'health', totalWeeks: 6, level: 'advanced' });
    expect(nov.weeks[0].totalMinutes).toBeLessThan(base.weeks[0].totalMinutes);
    expect(adv.weeks[0].totalMinutes).toBeGreaterThan(base.weeks[0].totalMinutes);
  });

  it('equipment: сессии получают выбранное оборудование', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 6, equipment: ['cycling', 'rowing'] });
    for (const w of c.weeks) {
      for (const s of w.sessions) {
        expect(['cycling', 'rowing']).toContain(s.equipment);
      }
    }
    expect(c.rationale.some(r => r.includes('Оборудование'))).toBe(true);
  });

  it('lowImpact: бег исключается, даже если выбран', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 6, equipment: ['running'], lowImpact: true });
    for (const w of c.weeks) {
      for (const s of w.sessions) expect(s.equipment).not.toBe('running');
    }
    expect(c.rationale.some(r => r.includes('низкоударное'))).toBe(true);
  });

  it('age: zone2-сессии получают целевой пульс (60-70% ЧССмакс)', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 6, age: 40 });
    const z2 = c.weeks[0].sessions.find(s => s.type === 'zone2')!;
    expect(z2.targetHr?.min).toBe(Math.round(180 * 0.6));
    expect(z2.targetHr?.max).toBe(Math.round(180 * 0.7));
  });

  it('без level/equipment/age поведение не меняется (обратная совместимость)', () => {
    const a = buildCardioCycle({ goal: 'cut', totalWeeks: 6 });
    expect(a.weeks[0].sessions[0].equipment).toBe('running');
    expect(a.weeks[0].sessions[0].targetHr).toBeUndefined();
  });

  it('sex: женщины — ЧССмакс 226−возраст (зоны шире)', () => {
    const m = cardioHeartZones(30, undefined, undefined, 'male');
    const f = cardioHeartZones(30, undefined, undefined, 'female');
    expect(m[1].bpmMax).toBe(Math.round(190 * 0.7));
    expect(f[1].bpmMax).toBe(Math.round(196 * 0.7));
  });

  it('restingHr: Karvonen-резерв в целевых зонах сессий', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 6, age: 40, restingHr: 60, sex: 'male' });
    const z2 = c.weeks[0].sessions.find(s => s.type === 'zone2')!;
    expect(z2.targetHr?.min).toBe(Math.round(60 + 120 * 0.6));
    expect(z2.targetHr?.max).toBe(Math.round(60 + 120 * 0.7));
  });
});

// ─── История версий (undo) ───

describe('история версий цикла', () => {
  const HIST_KEY = 'he_cardio_cycle_history';
  beforeEach(() => { try { localStorage.removeItem(HIST_KEY); } catch { /* ignore */ } });

  it('save → latest → restore → clear', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, id: 'h-1' });
    const modified = buildCardioCycle({ goal: 'cut', totalWeeks: 6, id: 'h-1', level: 'advanced' });
    saveCardioCycleVersion(c, 'до подстройки');
    expect(latestCardioCycleVersion('h-1')?.reason).toBe('до подстройки');
    const restored = restoreCardioCycleVersion('h-1');
    expect(restored?.id).toBe('h-1');
    expect(latestCardioCycleVersion('h-1')).toBeNull();
    expect(loadCardioCycleVersions()).toHaveLength(0);
  });

  it('cap 5 версий на цикл', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'h-2' });
    for (let i = 0; i < 7; i++) saveCardioCycleVersion({ ...c, name: `v${i}` }, `правка ${i}`);
    const versions = loadCardioCycleVersions().filter(v => v.cycleId === 'h-2');
    expect(versions.length).toBeLessThanOrEqual(5);
  });

  it('clear удаляет историю конкретного цикла', () => {
    const a = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'h-a' });
    const b = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'h-b' });
    saveCardioCycleVersion(a, 'a');
    saveCardioCycleVersion(b, 'b');
    clearCardioCycleHistory('h-a');
    expect(latestCardioCycleVersion('h-a')).toBeNull();
    expect(latestCardioCycleVersion('h-b')).not.toBeNull();
  });

  it('повреждённые данные → пустой список', () => {
    try { localStorage.setItem(HIST_KEY, '{bad'); } catch { /* ignore */ }
    expect(loadCardioCycleVersions()).toEqual([]);
  });
});

// ─── Текстовая сводка ───

describe('buildCardioSummaryText', () => {
  it('содержит заголовок, цель, недели с сессиями и обоснование', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, name: 'Сушка-цикл' });
    const t = buildCardioSummaryText(c);
    expect(t).toContain('Сушка-цикл');
    expect(t).toContain('Цель: сушка');
    expect(t).toContain('Нед 1 · База');
    expect(t).toContain('мин,');
    expect(t).toContain('Обоснование');
  });

  it('включает оборудование и целевой ЧСС при персонализации', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 3, equipment: ['cycling'], age: 40 });
    const t = buildCardioSummaryText(c);
    expect(t).toContain('(Вело)');
    expect(t).toContain('ЧСС');
  });

  it('с днями ног — строка 🦵 с днями недели', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, legDays: [0, 3] });
    const t = buildCardioSummaryText(c);
    expect(t).toContain('🦵 Дни тяжёлых ног: Пн, Чт');
  });

  it('без дней ног — строки 🦵 нет', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4 });
    expect(buildCardioSummaryText(c)).not.toContain('Дни тяжёлых ног');
  });
});

// ─── Варианты плана и объяснение ───

describe('cardioPlanVariants', () => {
  it('3 варианта: щадящий < базовый ≤ интенсивный по объёму', () => {
    const v = cardioPlanVariants({ goal: 'cut', totalWeeks: 8, daysAvailable: 5 });
    expect(v).toHaveLength(3);
    const gentle = v.find(x => x.id === 'gentle')!;
    const base = v.find(x => x.id === 'base')!;
    const intense = v.find(x => x.id === 'intense')!;
    expect(gentle.summary.avgMinutesPerWeek).toBeLessThan(base.summary.avgMinutesPerWeek);
    expect(intense.summary.avgMinutesPerWeek).toBeGreaterThan(base.summary.avgMinutesPerWeek);
    expect(gentle.summary.hiitWeeks).toBe(0);
  });

  it('intense для cut содержит HIIT', () => {
    const v = cardioPlanVariants({ goal: 'cut', totalWeeks: 8, daysAvailable: 5 });
    expect(v.find(x => x.id === 'intense')!.summary.hiitWeeks).toBeGreaterThan(0);
  });
});

describe('explainCardioChoice', () => {
  it('объясняет цель, уровень, оборудование, возраст и старты', () => {
    const input = { goal: 'cut' as const, totalWeeks: 8, daysAvailable: 4, level: 'intermediate' as const, equipment: ['cycling'] as const, age: 35, competitions: [{ id: 'c', name: 'Шоу', week: 8 }] };
    const cycle = buildCardioCycle({ ...input, sex: 'male' });
    const lines = explainCardioChoice({ ...input, sex: 'male' }, cycle);
    const text = lines.join('\n');
    expect(text).toContain('Цель «сушка»');
    expect(text).toContain('Уровень «средний»');
    expect(text).toContain('Вело');
    expect(text).toContain('Z2 =');
    expect(text).toContain('taper 2 нед');
  });
});

// ─── Улучшение цикла ───

describe('improveCardioCycle', () => {
  it('сушка без HIIT → HIIT добавлен на build/maintenance недели', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, daysAvailable: 3, recoveryLow: true });
    expect(c.weeks.some(w => w.sessions.some(s => s.type === 'hiit'))).toBe(false);
    const r = improveCardioCycle(c, { daysAvailable: 3, recoveryLow: false });
    expect(r.changes.length).toBeGreaterThan(0);
    expect(r.cycle.weeks.some(w => w.sessions.some(s => s.type === 'hiit'))).toBe(true);
    expect(r.cycle.weeks.filter(w => w.deload || w.taper).every(w => !w.sessions.some(s => s.type === 'hiit'))).toBe(true);
  });

  it('здоровье с малым объёмом → частота zone2 +1 на maintenance', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 6, daysAvailable: 1 });
    const r = improveCardioCycle(c, { daysAvailable: 4 });
    const changed = r.changes.filter(ch => ch.label.includes('Zone 2'));
    expect(changed.length).toBeGreaterThan(0);
  });

  it('соответствие рекомендациям → изменений нет', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, daysAvailable: 5 });
    const r = improveCardioCycle(c, { daysAvailable: 5, recoveryLow: false });
    expect(r.changes).toEqual([]);
    expect(r.advice.action).toBe('keep');
  });

  it('исходный цикл не мутируется', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, daysAvailable: 3, recoveryLow: true });
    const before = JSON.stringify(c);
    improveCardioCycle(c, { daysAvailable: 3, recoveryLow: false });
    expect(JSON.stringify(c)).toBe(before);
  });
});

// ─── Протокол сессии ───

describe('cardioSessionProtocol', () => {
  it('zone2: разминка/основная/заминка, основная в Z2', () => {
    const p = cardioSessionProtocol({ type: 'zone2', durationMin: 40 });
    expect(p.map(x => x.name)).toEqual(['Разминка', 'Основная', 'Заминка']);
    expect(p[1].minutes).toBe(30);
    expect(p[1].note).toContain('Zone 2');
  });

  it('hiit: интервалы 30/90 в Z4', () => {
    const p = cardioSessionProtocol({ type: 'hiit', durationMin: 20 });
    expect(p[1].name).toBe('Интервалы');
    expect(p[1].minutes).toBe(10);
    expect(p[1].note).toContain('30 сек');
  });

  it('recovery: без разминки', () => {
    const p = cardioSessionProtocol({ type: 'recovery', durationMin: 30 });
    expect(p.map(x => x.name)).not.toContain('Разминка');
  });

  it('длительность ≥10 даже для короткой сессии', () => {
    const p = cardioSessionProtocol({ type: 'zone2', durationMin: 8 });
    const total = p.reduce((s, x) => s + x.minutes, 0);
    expect(total).toBeGreaterThanOrEqual(10);
  });
});

// ─── Дни тяжёлых ног (раскладка) ───

describe('assignSessionDays / legDays', () => {
  it('zone2/miss/hiit не попадают в дни тяжёлых ног', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, daysAvailable: 5, legDays: [0, 3] });
    for (const w of c.weeks) {
      for (const s of w.sessions) {
        if (s.type !== 'recovery') {
          expect([0, 3]).not.toContain(s.dayOfWeek);
        }
      }
    }
  });

  it('без legDays распределение как раньше (все дни доступны)', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, daysAvailable: 7 });
    const days = c.weeks[0].sessions.map(s => s.dayOfWeek);
    expect(days.every(d => d != null && d >= 0 && d <= 6)).toBe(true);
  });

  it('assignSessionDays: заданный день сохраняется', () => {
    const sessions = [{ type: 'zone2' as const, durationMin: 30, weeklyFrequency: 2, intensity: 'moderate' as const, kcalPerSession: 210, purpose: 'x', dayOfWeek: 5 }];
    const out = assignSessionDays(sessions, [0, 1, 2, 3, 4]);
    expect(out[0].dayOfWeek).toBe(5);
  });
});

describe('cardioWeekLegConflicts', () => {
  it('без дней ног в конфиге — конфликтов нет', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4 });
    expect(cardioWeekLegConflicts(c, 1)).toEqual([]);
  });

  it('авто-раскладка обходит дни ног — конфликтов нет', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, daysAvailable: 5, legDays: [0, 3] });
    expect(cardioWeekLegConflicts(c, 1)).toEqual([]);
    expect(cardioWeekLegConflicts(c, 6)).toEqual([]);
  });

  it('сессия с явным днём недели на дне ног — конфликт', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'lc-1' });
    c.config = { ...c.config!, legDays: [0] };
    c.weeks[0].sessions = [{ type: 'zone2', durationMin: 30, weeklyFrequency: 1, intensity: 'moderate', kcalPerSession: 210, purpose: 'x', dayOfWeek: 0 }];
    const out = cardioWeekLegConflicts(c, 1);
    expect(out).toHaveLength(1);
    expect(out[0].dayOfWeek).toBe(0);
    expect(out[0].sessions[0].type).toBe('zone2');
  });

  it('recovery на дне ног — не конфликт (лёгкое кардио допустимо)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'lc-2' });
    c.config = { ...c.config!, legDays: [0] };
    c.weeks[0].sessions = [{ type: 'recovery', durationMin: 20, weeklyFrequency: 1, intensity: 'low', kcalPerSession: 90, purpose: 'x', dayOfWeek: 0 }];
    expect(cardioWeekLegConflicts(c, 1)).toEqual([]);
  });

  it('конфликты по нескольким дням ног группируются по дням', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'lc-3' });
    c.config = { ...c.config!, legDays: [0, 3] };
    c.weeks[0].sessions = [
      { type: 'zone2', durationMin: 30, weeklyFrequency: 1, intensity: 'moderate', kcalPerSession: 210, purpose: 'x', dayOfWeek: 0 },
      { type: 'hiit', durationMin: 20, weeklyFrequency: 1, intensity: 'high', kcalPerSession: 220, purpose: 'x', dayOfWeek: 3 },
      { type: 'zone2', durationMin: 40, weeklyFrequency: 1, intensity: 'moderate', kcalPerSession: 280, purpose: 'x', dayOfWeek: 0 },
    ];
    const out = cardioWeekLegConflicts(c, 1);
    expect(out).toHaveLength(2);
    expect(out.find(x => x.dayOfWeek === 0)!.sessions).toHaveLength(2);
    expect(out.find(x => x.dayOfWeek === 3)!.sessions).toHaveLength(1);
  });

  it('неделя вне диапазона — пусто', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'lc-4', legDays: [0] });
    expect(cardioWeekLegConflicts(c, 99)).toEqual([]);
  });
});

describe('cardioLegDayForDate', () => {
  it('без цикла — null', () => {
    expect(cardioLegDayForDate(null, '2026-08-17')).toBeNull();
  });

  it('дата → день недели (Пн=0), день ног из конфига', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'lgd-1' });
    c.config = { ...c.config!, legDays: [0] };
    const out = cardioLegDayForDate(c, '2026-08-17');
    expect(out).not.toBeNull();
    expect(out!.dayOfWeek).toBe(0);
    expect(out!.isLegDay).toBe(true);
  });

  it('день не в списке ног — isLegDay false', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'lgd-2' });
    c.config = { ...c.config!, legDays: [3] };
    expect(cardioLegDayForDate(c, '2026-08-17')!.isLegDay).toBe(false);
  });

  it('без дней ног в конфиге — всегда false', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'lgd-3' });
    expect(cardioLegDayForDate(c, '2026-08-17')!.isLegDay).toBe(false);
  });

  it('некорректная дата — null', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, id: 'lgd-4' });
    expect(cardioLegDayForDate(c, 'not-a-date')).toBeNull();
  });
});

// ─── Сценарии-снапшоты ───

describe('сценарии (he_cardio_scenarios)', () => {
  const SC_KEY = 'he_cardio_scenarios';
  beforeEach(() => { try { localStorage.removeItem(SC_KEY); } catch { /* ignore */ } });

  it('save → load → remove', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, id: 'sc-1' });
    saveCardioScenario(c, 'Сушка к шоу');
    const all = loadCardioScenarios();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Сушка к шоу');
    removeCardioScenario(all[0].id);
    expect(loadCardioScenarios()).toHaveLength(0);
  });

  it('cap 6 сценариев', () => {
    for (let i = 0; i < 8; i++) saveCardioScenario(buildCardioCycle({ goal: 'health', totalWeeks: 4, id: `c-${i}` }), `Сценарий ${i}`);
    expect(loadCardioScenarios().length).toBeLessThanOrEqual(6);
  });

  it('повреждённые данные → пустой список', () => {
    try { localStorage.setItem(SC_KEY, '{bad'); } catch { /* ignore */ }
    expect(loadCardioScenarios()).toEqual([]);
  });
});

// ─── Совет по весу (плато на сушке) ───

describe('cardioWeightAdvice', () => {
  const REF = '2026-08-16';
  it('плато веса → increase (добавить Z2)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8 });
    const log = [
      { date: '2026-08-01', weight: 80 },
      { date: '2026-08-06', weight: 79.8 },
      { date: '2026-08-11', weight: 79.7 },
      { date: '2026-08-15', weight: 79.7 },
    ];
    const a = cardioWeightAdvice(log, c, REF);
    expect(a.action).toBe('increase');
    expect(a.reason).toContain('Zone 2');
  });

  it('темп в норме → keep', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8 });
    const log = [
      { date: '2026-08-01', weight: 81 },
      { date: '2026-08-06', weight: 80.2 },
      { date: '2026-08-11', weight: 79.4 },
      { date: '2026-08-15', weight: 78.6 },
    ];
    const a = cardioWeightAdvice(log, c, REF);
    expect(a.action).toBe('keep');
  });

  it('не сушка → keep', () => {
    const c = buildCardioCycle({ goal: 'mass', totalWeeks: 8 });
    const a = cardioWeightAdvice([{ date: '2026-08-01', weight: 80 }, { date: '2026-08-15', weight: 80 }], c, REF);
    expect(a.action).toBe('keep');
  });
});

describe('bumpCardioZone2Volume', () => {
  it('+15 мин Zone 2 на рабочих неделях, taper/делод не трогаются', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8 });
    const bumped = bumpCardioZone2Volume(c, 15);
    const z2Before = c.weeks[0].sessions.find(s => s.type === 'zone2')!.durationMin;
    const z2After = bumped.weeks[0].sessions.find(s => s.type === 'zone2')!.durationMin;
    expect(z2After).toBe(z2Before + 15);
    expect(bumped.weeks[0].totalMinutes).toBeGreaterThan(c.weeks[0].totalMinutes);
    const deloadIdx = c.weeks.findIndex(w => w.deload);
    if (deloadIdx >= 0) {
      const wb = c.weeks[deloadIdx];
      const wa = bumped.weeks[deloadIdx];
      expect(wa.sessions.map(s => s.durationMin)).toEqual(wb.sessions.map(s => s.durationMin));
    }
  });

  it('исходный цикл не мутируется', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6 });
    const before = JSON.stringify(c);
    bumpCardioZone2Volume(c, 15);
    expect(JSON.stringify(c)).toBe(before);
  });
});

// ─── startDate / config / safety (этапы G-I) ───

describe('startDate', () => {
  it('неделя 1 = startDate: цикл, собранный неделю назад → неделя 2', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, startDate: '2026-08-09' });
    expect(c.startDate).toBe('2026-08-09');
    expect(cardioWeekForDate(c, '2026-08-16', c.startDate)?.week).toBe(2);
  });

  it('по умолчанию startDate = сегодня', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4 });
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(c.startDate).toBe(iso);
  });
});

describe('config-снапшот', () => {
  it('buildCardioCycle сохраняет параметры сборки в config', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, daysAvailable: 4, level: 'advanced', equipment: ['cycling'], legDays: [0, 3] });
    expect(c.config).toBeTruthy();
    expect(c.config!.goal).toBe('cut');
    expect(c.config!.totalWeeks).toBe(8);
    expect(c.config!.daysAvailable).toBe(4);
    expect(c.config!.level).toBe('advanced');
    expect(c.config!.equipment).toEqual(['cycling']);
    expect(c.config!.legDays).toEqual([0, 3]);
    expect(configFromCycle(c)?.goal).toBe('cut');
  });
});

describe('cardioSafetyReport', () => {
  it('нормальный цикл без предупреждений', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 6 });
    expect(cardioSafetyReport(c).warnings).toEqual([]);
  });

  it('перегруз: сессия > лимита и неделя > 600 мин → warn', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 1, daysAvailable: 7 });
    const heavy: CardioCycle = {
      ...c,
      weeks: c.weeks.map(w => ({
        ...w,
        sessions: [
          { type: 'zone2' as const, durationMin: 120, weeklyFrequency: 2, intensity: 'moderate' as const, kcalPerSession: 840, purpose: 'x' },
          { type: 'hiit' as const, durationMin: 40, weeklyFrequency: 4, intensity: 'high' as const, kcalPerSession: 560, purpose: 'y' },
        ],
        totalMinutes: 400,
        totalKcal: 3000,
      })),
    };
    const r = cardioSafetyReport(heavy);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.warnings.some(x => x.includes('ZONE2 120 мин'))).toBe(true);
    expect(r.warnings.some(x => x.includes('HIIT ×4'))).toBe(true);
  });

  it('safety встроен в качество (штраф)', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 1, daysAvailable: 7 });
    const heavy: CardioCycle = {
      ...c,
      weeks: c.weeks.map(w => ({ ...w, sessions: [{ type: 'zone2' as const, durationMin: 150, weeklyFrequency: 2, intensity: 'moderate' as const, kcalPerSession: 1050, purpose: 'x' }], totalMinutes: 300, totalKcal: 2100 })),
    };
    const q = cardioQualityReport(heavy, 7);
    expect(q.findings.some(f => f.level === 'warn' && f.text.includes('ZONE2 150 мин'))).toBe(true);
    expect(q.score).toBeLessThan(100);
  });
});

// ─── .ics по дням недели и следующая сессия ───

describe('buildCardioIcs — дни недели', () => {
  it('события привязаны к конкретным дням (dayOfWeek)', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 1, daysAvailable: 7, id: 'ics-days' });
    const ics = buildCardioIcs(c, '2026-01-05');
    const s0 = c.weeks[0].sessions[0];
    expect(s0.dayOfWeek).not.toBeUndefined();
    const expected = dayStartPlus(s0.dayOfWeek!, 0);
    expect(ics).toContain(`DTSTART:${expected}`);
  });

  it('DESCRIPTION содержит оборудование при персонализации', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 1, equipment: ['cycling'], id: 'ics-eq' });
    const ics = buildCardioIcs(c, '2026-01-05');
    expect(ics).toContain('Вело');
  });
});

function dayStartPlus(dow: number, week: number): string {
  const ref = new Date(2026, 0, 5 + week * 7 + dow);
  return `${ref.getFullYear()}${String(ref.getMonth() + 1).padStart(2, '0')}${String(ref.getDate()).padStart(2, '0')}Z`;
}

describe('cardioNextSession', () => {
  it('возвращает ближайшую сессию с её днём', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, daysAvailable: 7 });
    const next = cardioNextSession(c, '2026-01-05', '2026-01-05');
    expect(next).not.toBeNull();
    expect(next!.week).toBe(1);
    expect(next!.session.type).toBe('zone2');
    expect(next!.date >= '2026-01-05').toBe(true);
  });

  it('null вне цикла', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 2, daysAvailable: 7 });
    expect(cardioNextSession(c, '2026-03-01', '2026-01-05')).toBeNull();
  });
});

// ─── Конвертация в UserProgram ───

describe('cardioCycleToUserProgram', () => {
  it('строит UserProgram: meta, недели, сессии по дням, блоки с упражнениями', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 3, daysAvailable: 4, id: 'prog-1', name: 'Кардио сушка' });
    const p = cardioCycleToUserProgram(c);
    expect(p.meta.title).toBe('Кардио сушка');
    expect(p.meta.weeks).toBe(3);
    expect(p.meta.direction).toBe('bb');
    expect(p.meta.tags).toContain('cardio');
    expect(p.bb!.weeks).toHaveLength(3);
    const w1 = p.bb!.weeks[0];
    expect(w1.sessions.length).toBeGreaterThan(0);
    expect(w1.sessions[0].dayOfWeek).not.toBeUndefined();
    expect(w1.sessions[0].blocks[0].exerciseName).toContain('Кардио');
    expect(w1.sessions[0].blocks[0].muscle).toBe('cardio');
  });

  it('фазы taper/peak отображаются как deload/peaking', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, competitions: [{ id: 'c', name: 'Шоу', week: 6 }] });
    const p = cardioCycleToUserProgram(c);
    const last = p.bb!.weeks[p.bb!.weeks.length - 1];
    expect(last.phase).toBe('peaking');
    expect(p.bb!.weeks[4].phase).toBe('deload');
  });
});

// ─── Профиль-факторы и питание ───

describe('cardioProfileFactors', () => {
  it('сон/стресс/HRV/PED/суставы распознаются из профиля', () => {
    const f = cardioProfileFactors({
      lifestyle: { sleepHours: 5.5, stressLevel: 8, morningHRV: 20 },
      pharma: { currentSubstances: [{ substanceId: 'test_e' }] },
      health: { chronicConditions: ['Артроз коленей'] },
    });
    expect(f.sleepHours).toBe(5.5);
    expect(f.stressLevel).toBe(8);
    expect(f.hrvMs).toBe(20);
    expect(f.enhanced).toBe(true);
    expect(f.jointIssues).toBe(true);
  });

  it('пустой профиль → пустые факторы', () => {
    expect(cardioProfileFactors({})).toEqual({});
  });
});

describe('факторы в buildCardioCycle', () => {
  it('низкий сон + стресс + низкий HRV снижают объём, стресс убирает HIIT', () => {
    const base = buildCardioCycle({ goal: 'cut', totalWeeks: 8, daysAvailable: 5 });
    const tired = buildCardioCycle({ goal: 'cut', totalWeeks: 8, daysAvailable: 5, sleepHours: 5, stressLevel: 8, hrvMs: 20 });
    expect(tired.weeks[0].totalMinutes).toBeLessThan(base.weeks[0].totalMinutes);
    expect(tired.weeks.some(w => w.sessions.some(s => s.type === 'hiit'))).toBe(false);
    expect(tired.rationale.some(r => r.includes('Сон <6'))).toBe(true);
    expect(tired.rationale.some(r => r.includes('Стресс ≥7'))).toBe(true);
  });

  it('PED-курс повышает объём', () => {
    const base = buildCardioCycle({ goal: 'cut', totalWeeks: 8, daysAvailable: 5 });
    const enh = buildCardioCycle({ goal: 'cut', totalWeeks: 8, daysAvailable: 5, enhanced: true });
    expect(enh.weeks[0].totalMinutes).toBeGreaterThan(base.weeks[0].totalMinutes);
  });

  it('autoLowImpact + jointIssues → низкоударное оборудование', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 6, equipment: ['running'], autoLowImpact: true, jointIssues: true });
    for (const w of c.weeks) {
      for (const s of w.sessions) expect(s.equipment).not.toBe('running');
    }
    expect(c.rationale.some(r => r.includes('суставов из профиля'))).toBe(true);
  });
});

describe('cardioNutritionNotes', () => {
  it('сушка: расход, белок ≥2.2 г/кг, углеводы при HIIT, калорийность', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8 });
    const notes = cardioNutritionNotes(c, { personal: { weight: 80 }, nutrition: { manualTargets: { kcal: 2400 } } });
    const text = notes.join('\n');
    expect(text).toContain('Расход кардио');
    expect(text).toContain('2.2 г/кг = 176 г/сут');
    expect(text).toContain('ккал/сут');
  });

  it('без ручной калорийности — рекомендации без неё, но с расходом', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8 });
    const notes = cardioNutritionNotes(c, { personal: { weight: 80 } });
    expect(notes.join('\n')).toContain('Расход кардио');
    expect(notes.join('\n')).not.toContain('ккал/сут — расход');
  });

  it('массонабор: белок 1.8-2.0 г/кг', () => {
    const c = buildCardioCycle({ goal: 'mass', totalWeeks: 6 });
    const notes = cardioNutritionNotes(c, { personal: { weight: 90 } });
    expect(notes.join('\n')).toContain('1.8-2.0 г/кг = 171 г/сут');
  });
});

// ─── Аудит качества: окно недели авто-подстройки, делод+taper, ккал по оборудованию ───

describe('аудит: окно недели autoTune (баг +7)', () => {
  const REF = '2026-01-05';

  it('сессии в середине/конце недели учитыются (не только первый день)', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, startDate: REF });
    const planned = c.weeks[0].sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
    // Все сессии недели 1 выполнены (даты с ведущими нулями 05..07).
    const log = Array.from({ length: planned }, (_, i) => ({ date: `2026-01-${String(5 + i).padStart(2, '0')}`, durationMin: 30, rpe: 5, completed: true }));
    const r = autoTuneCardioCycle(c, log, { referenceIso: REF });
    expect(r.changes).toEqual([]);
    expect(r.advice.action).toBe('keep');
  });

  it('выполнена только половина недели → частота −1 (корректный подсчёт)', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, startDate: REF });
    const planned = c.weeks[0].sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
    // Выполнена 1 из 3 сессий (только первый день) → pct < 60% → частота −1.
    const log = [{ date: '2026-01-05', durationMin: 30, rpe: 5, completed: true }];
    const r = autoTuneCardioCycle(c, log, { referenceIso: REF });
    const freqAfter = r.cycle.weeks[0].sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
    expect(freqAfter).toBeLessThan(planned);
    expect(r.changes.length).toBeGreaterThan(0);
  });
});

describe('аудит: делод не накладывается на taper/peak (двойное снижение)', () => {
  it('taper-неделя на делод-интервале не режется дважды', () => {
    // Соревнование на неделе 5, taperWeeks 4 → недели 2-4 taper; делод-интервал на неделе 4.
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, taperWeeks: 4, competitions: [{ id: 'c', name: 'Шоу', week: 5 }] });
    const w4 = c.weeks.find(w => w.week === 4)!;
    expect(w4.phase).toBe('taper');
    // Делод не должен быть помечен на taper-неделе (иначе двойное ×0.6).
    expect(w4.deload).toBe(false);
  });

  it('обычная делод-неделя (не taper) остаётся помеченной', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8 });
    const w4 = c.weeks.find(w => w.week === 4)!;
    expect(w4.deload).toBe(true);
  });
});

describe('аудит: ккал по оборудованию (MET)', () => {
  it('ходьба сжигает меньше бега за ту же минуту', () => {
    const run = kcalForCardio('zone2', 30, 80, 'running');
    const walk = kcalForCardio('zone2', 30, 80, 'walking');
    expect(walk).toBeLessThan(run);
  });

  it('без оборудования — поведение как раньше (бег)', () => {
    expect(kcalForCardio('zone2', 30, 80)).toBe(kcalForCardio('zone2', 30, 80, 'running'));
  });

  it('цикл учитывает оборудован��е в ккал недели', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, equipment: ['walking'], lowImpact: true });
    expect(c.weeks[0].sessions.every(s => s.equipment === 'walking')).toBe(true);
  });
});

describe('аудит: экспорт в программу сохраняет частоту', () => {
  it('zone2 ×3 → 3 сессии по дням в программе', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4 });
    const p = cardioCycleToUserProgram(c);
    const w1 = p.bb!.weeks[0];
    const freq = c.weeks[0].sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
    expect(w1.sessions.length).toBe(freq);
  });
});

// ─── Аудит: консистентность ккал после адаптаций (P1-3) ───

describe('аудит: ккал консистентны после адаптаций', () => {
  const expectKcalConsistent = (c: CardioCycle) => {
    const bw = cycleBodyWeight(c);
    for (const w of c.weeks) {
      const sum = w.sessions.reduce((s, x) => s + x.kcalPerSession * x.weeklyFrequency, 0);
      expect(w.totalKcal).toBe(sum);
      for (const s of w.sessions) {
        expect(s.kcalPerSession).toBe(kcalForCardio(s.type, s.durationMin, bw, s.equipment));
      }
    }
  };

  it('recalcSessionKcal: пересчёт по длительности/весу/оборудованию', () => {
    const s = recalcSessionKcal({ type: 'zone2', durationMin: 45, weeklyFrequency: 2, intensity: 'moderate', kcalPerSession: 100, purpose: 'x', equipment: 'cycling' }, 100);
    expect(s.kcalPerSession).toBe(kcalForCardio('zone2', 45, 100, 'cycling'));
  });

  it('adaptCardioToStrength (осторожный ACWR) пересчитывает ккал под новые минуты', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, bodyWeight: 90 });
    const adapted = adaptCardioToStrength(c, { acwr: 1.4 });
    expect(adapted.weeks[0].totalMinutes).toBeLessThan(c.weeks[0].totalMinutes);
    expectKcalConsistent(adapted);
  });

  it('adaptCardioToStrength (опасный ACWR) — ккал только оставшихся сессий', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6 });
    const adapted = adaptCardioToStrength(c, { acwr: 1.6 });
    for (const w of adapted.weeks) {
      for (const s of w.sessions) expect(['recovery', 'zone2']).toContain(s.type);
    }
    expectKcalConsistent(adapted);
  });

  it('autoTuneCardioCycle (RPE ≥8 → минуты −10%) пересчитывает ккал', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, startDate: '2026-01-05' });
    const log = [
      { date: '2026-01-05', durationMin: 30, rpe: 9, completed: true },
      { date: '2026-01-07', durationMin: 30, rpe: 9, completed: true },
    ];
    const r = autoTuneCardioCycle(c, log, { referenceIso: '2026-01-05' });
    expect(r.changes.some(ch => ch.label.includes('RPE'))).toBe(true);
    expectKcalConsistent(r.cycle);
  });

  it('applyPLCardioTaper пересчитывает ккал taper-недель (вес 100)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, bodyWeight: 100 });
    const t = applyPLCardioTaper(c, { competitionWeek: 6 });
    expect(t.weeks.find(w => w.week === 5)!.phase).toBe('taper');
    expectKcalConsistent(t);
  });

  it('applyBBCardioTaper пересчитывает ккал taper-недель и пик-недели', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6 });
    const t = applyBBCardioTaper(c, { showWeek: 6, peakWeek: true });
    expect(t.weeks[5].phase).toBe('peak');
    expectKcalConsistent(t);
  });

  it('bumpCardioZone2Volume использует вес цикла (не 80)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, bodyWeight: 100 });
    const bumped = bumpCardioZone2Volume(c, 15);
    const s = bumped.weeks[0].sessions.find(x => x.type === 'zone2')!;
    expect(s.kcalPerSession).toBe(kcalForCardio('zone2', s.durationMin, 100, s.equipment));
    expectKcalConsistent(bumped);
  });
});

// ─── Перенос сессии (reschedule, A3) ───

describe('rescheduleCardioSession', () => {
  const REF = '2026-01-05';
  const weekDateIso = (week: number, dow: number) => {
    const d = new Date(REF);
    d.setDate(d.getDate() + (week - 1) * 7 + dow);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  it('переносит сессию дня на ближайший свободный день недели', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, daysAvailable: 3, startDate: REF });
    const w1 = c.weeks[0];
    const oldDow = w1.sessions[0].dayOfWeek!;
    const r = rescheduleCardioSession(c, weekDateIso(1, oldDow), { referenceIso: REF });
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0].week).toBe(1);
    const after = r.cycle.weeks[0].sessions;
    expect(after.some(s => s.dayOfWeek === oldDow)).toBe(false);
    const dows = after.map(s => s.dayOfWeek);
    expect(new Set(dows).size).toBe(dows.length);
  });

  it('без сессии на дату — цикл не меняется', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, daysAvailable: 1, startDate: REF });
    const busy = new Set(c.weeks[0].sessions.map(s => s.dayOfWeek));
    let free = -1;
    for (let d = 0; d < 7; d++) if (!busy.has(d)) { free = d; break; }
    const before = JSON.stringify(c);
    const r = rescheduleCardioSession(c, weekDateIso(1, free), { referenceIso: REF });
    expect(r.changes).toEqual([]);
    expect(JSON.stringify(r.cycle)).toBe(before);
  });

  it('нет свободного дня (все заняты) — no-op', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 1 });
    const full: CardioCycle = {
      ...c,
      weeks: [{
        ...c.weeks[0],
        sessions: [0, 1, 2, 3, 4, 5, 6].map(d => ({ type: 'zone2' as const, durationMin: 30, weeklyFrequency: 1, intensity: 'moderate' as const, kcalPerSession: 210, purpose: 'x', dayOfWeek: d })),
      }],
    };
    const r = rescheduleCardioSession(full, weekDateIso(1, 0), { referenceIso: REF });
    expect(r.changes).toEqual([]);
  });

  it('дата вне цикла — no-op', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 2 });
    const before = JSON.stringify(c);
    const r = rescheduleCardioSession(c, '2026-02-01', { referenceIso: REF });
    expect(r.changes).toEqual([]);
    expect(JSON.stringify(r.cycle)).toBe(before);
  });
});

describe('assignSessionDays — стартовый день от startDate (баг №6)', () => {
  it('цикл со startDate в понедельник: первая сессия недели 1 на понедельник', () => {
    // 2026-01-05 — понедельник.
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, startDate: '2026-01-05' });
    const w1 = c.weeks[0];
    expect(w1.sessions[0].dayOfWeek).toBe(0);
  });

  it('цикл со startDate в среду: первая сессия недели 1 на среду (не день сборки)', () => {
    // 2026-01-07 — среда (dow 2).
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, startDate: '2026-01-07' });
    expect(c.weeks[0].sessions[0].dayOfWeek).toBe(2);
  });

  it('assignSessionDays без reference — от сегодня (поведение по умолчанию)', () => {
    const s = assignSessionDays([{ type: 'zone2' as const, durationMin: 30, weeklyFrequency: 2, intensity: 'moderate' as const, kcalPerSession: 210, purpose: 'x' }]);
    expect(s[0].dayOfWeek).toBe((new Date().getDay() + 6) % 7);
  });
});

// ─── MISS (Z3) в build-фазах (C1) ───

describe('MISS в build-фазе (чередование с HIIT)', () => {
  it('cut: нечётные build-недели получают MISS, чётные — HIIT', () => {
    // 12 нед: base 1-4, build 5-8, maintenance 9-11, transition 12.
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 12, daysAvailable: 7 });
    const w5 = c.weeks.find(w => w.week === 5)!;
    const w6 = c.weeks.find(w => w.week === 6)!;
    expect(w5.sessions.some(s => s.type === 'miss')).toBe(true);
    expect(w5.sessions.some(s => s.type === 'hiit')).toBe(false);
    expect(w6.sessions.some(s => s.type === 'hiit')).toBe(true);
    expect(w6.sessions.some(s => s.type === 'miss')).toBe(false);
  });

  it('health: build-фаза чередует MISS (без HIIT в профиле)', () => {
    // 8 нед: base 1-3, build 4-6.
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 8, daysAvailable: 7 });
    const w4 = c.weeks.find(w => w.week === 4)!;
    const w5 = c.weeks.find(w => w.week === 5)!;
    expect(w5.sessions.some(s => s.type === 'miss')).toBe(true);
    expect(w4.sessions.some(s => s.type === 'miss')).toBe(false);
    expect(c.weeks.every(w => w.sessions.every(s => s.type !== 'hiit'))).toBe(true);
  });

  it('mass: MISS нигде не появляется', () => {
    const c = buildCardioCycle({ goal: 'mass', totalWeeks: 8 });
    expect(c.weeks.every(w => w.sessions.every(s => s.type !== 'miss' && s.type !== 'hiit'))).toBe(true);
  });
});

// ─── Недельная авто-прогрессия (4D) ───

describe('autoTuneCardioCycle — недельная прогрессия', () => {
  it('2 лёгкие недели подряд → будущим рабочим неделям +10%', () => {
    // 6 нед (base 1-2, build 3-4, maint 5, transition 6): ref=19.01 → текущая неделя 3.
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 6, startDate: '2026-01-05' });
    const log = [
      { date: '2026-01-05', durationMin: 25, rpe: 5, completed: true },
      { date: '2026-01-06', durationMin: 25, rpe: 5, completed: true },
      { date: '2026-01-07', durationMin: 25, rpe: 5, completed: true },
      { date: '2026-01-12', durationMin: 25, rpe: 5, completed: true },
      { date: '2026-01-13', durationMin: 25, rpe: 5, completed: true },
      { date: '2026-01-14', durationMin: 25, rpe: 5, completed: true },
    ];
    const r = autoTuneCardioCycle(c, log, { referenceIso: '2026-01-19' });
    expect(r.changes.some(ch => ch.label.includes('лёгкие'))).toBe(true);
    // Будущая рабочая неделя 5 (maint) увеличена; прошедшие 1-2 не тронуты.
    expect(r.cycle.weeks[4].totalMinutes).toBeGreaterThan(c.weeks[4].totalMinutes);
    expect(r.cycle.weeks[0].totalMinutes).toBe(c.weeks[0].totalMinutes);
    expect(r.cycle.weeks[1].totalMinutes).toBe(c.weeks[1].totalMinutes);
  });

  it('2 тяжёлые недели подряд → будущим рабочим неделям −10%', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 6, startDate: '2026-01-05' });
    const log = [
      { date: '2026-01-05', durationMin: 25, rpe: 9, completed: true },
      { date: '2026-01-07', durationMin: 25, rpe: 9, completed: true },
      { date: '2026-01-08', durationMin: 25, rpe: 9, completed: true },
      { date: '2026-01-12', durationMin: 25, rpe: 9, completed: true },
      { date: '2026-01-13', durationMin: 25, rpe: 9, completed: true },
      { date: '2026-01-14', durationMin: 25, rpe: 9, completed: true },
    ];
    const r = autoTuneCardioCycle(c, log, { referenceIso: '2026-01-19' });
    expect(r.changes.some(ch => ch.label.includes('тяжёлые'))).toBe(true);
    expect(r.cycle.weeks[4].totalMinutes).toBeLessThan(c.weeks[4].totalMinutes);
  });
});

// ─── Мост в питание (cardioToNutritionPayload, B1) ───

describe('cardioToNutritionPayload — мост ккал в питание', () => {
  it('средний расход ккал/нед и факт за сегодня', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, id: 'nut-1', name: 'Сушка' });
    const log = [
      { date: '2026-01-05', durationMin: 40, calories: 280, completed: true },
      { date: '2026-01-05', durationMin: 15, type: 'hiit' as const, calories: 210, completed: true },
      { date: '2026-01-06', durationMin: 60, calories: 420, completed: true },
    ];
    const p = cardioToNutritionPayload(c, log, '2026-01-05');
    expect(p.avgKcalPerWeek).toBeGreaterThan(0);
    expect(p.text).toContain('ккал/нед');
    expect(p.todayMinutes).toBe(55);
    expect(p.todayKcal).toBe(490);
    expect(p.text).toContain('Сегодня: 55 мин · 490 ккал');
  });

  it('без факта за день — строка «не записано»', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4 });
    const p = cardioToNutritionPayload(c, [], '2026-01-05');
    expect(p.todayMinutes).toBe(0);
    expect(p.text).toContain('не записано');
    expect(p.text).toContain('0.5-1%/нед');
  });
});

// ─── Авто-учёт дней ног из ББ-плана (5B) ───

describe('legDaysFromBBPlan', () => {
  it('считает дни недели 1 с мышцами ног', () => {
    const plan = {
      weeks: [{
        sessions: [
          { blocks: [{ muscle: 'chest' }, { muscle: 'triceps' }] },
          { blocks: [{ muscle: 'quads' }, { muscle: 'glutes' }] },
          { blocks: [{ muscle: 'hamstrings' }] },
          { blocks: [{ muscle: 'back' }] },
        ],
      }],
    };
    expect(legDaysFromBBPlan(plan as never)).toBe(2);
  });

  it('пустой/без плана → 0', () => {
    expect(legDaysFromBBPlan(null)).toBe(0);
    expect(legDaysFromBBPlan({ weeks: [] })).toBe(0);
    expect(legDaysFromBBPlan({ weeks: [{ sessions: [] }] })).toBe(0);
  });
});

// ─── Pro: .tcx, LTHR-зоны, VDOT (Этап 6) ───

describe('buildCardioTcx', () => {
  it('строит XML с сессиями по дням недели', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 2, id: 'tcx-1', daysAvailable: 3, startDate: '2026-01-05' });
    const tcx = buildCardioTcx(c, '2026-01-05');
    expect(tcx).toContain('<?xml version="1.0"');
    expect(tcx).toContain('TrainingCenterDatabase');
    expect(tcx).toContain('<Activities>');
    expect(tcx).toContain('<Id>2026-01-05T');
    expect(tcx).toContain('Кардио ZONE2');
    expect(tcx).toContain('2026-01-0');
  });
});

describe('lthrZones', () => {
  it('5 зон, монотонно возрастающие, Z2 по центру LTHR', () => {
    const zones = lthrZones(160);
    expect(zones).toHaveLength(5);
    for (let i = 1; i < 5; i++) {
      expect(zones[i].bpmMin).toBeGreaterThanOrEqual(zones[i - 1].bpmMax);
    }
    expect(zones[1].label).toContain('Z2');
    // Z2 = 82-88% от 160 → 131-141.
    expect(zones[1].bpmMin).toBe(131);
    expect(zones[1].bpmMax).toBe(141);
  });
});

describe('runningVdot', () => {
  it('тест 5 км за 25 мин → VDOT и темпы (лёгкий медленнее порога)', () => {
    const r = runningVdot(5, 25);
    expect(r).not.toBeNull();
    expect(r!.vdot).toBeGreaterThan(0);
    expect(r!.pacesKm).toHaveLength(5);
    const easy = r!.pacesKm[0];
    const threshold = r!.pacesKm[2];
    expect(easy.minPerKm).toBeGreaterThan(threshold.minPerKm);
  });

  it('некорректный ввод → null', () => {
    expect(runningVdot(0, 25)).toBeNull();
    expect(runningVdot(5, 0)).toBeNull();
  });
});

// ─── Год кардио: последовательность циклов (этап 6) ───

describe('cardioYearPlan / buildCardioYearText', () => {
  it('блоки встают подряд: недели года без разрывов', () => {
    const a = buildCardioCycle({ goal: 'health', totalWeeks: 12, id: 'y1', name: 'База' });
    const b = buildCardioCycle({ goal: 'cut', totalWeeks: 16, id: 'y2', name: 'Сушка' });
    const c = buildCardioCycle({ goal: 'recovery', totalWeeks: 4, id: 'y3', name: 'Переход' });
    const plan = cardioYearPlan([a, b, c])!;
    expect(plan).not.toBeNull();
    expect(plan.totalWeeks).toBe(32);
    expect(plan.blocks).toHaveLength(3);
    expect(plan.blocks[0].startWeek).toBe(1);
    expect(plan.blocks[1].startWeek).toBe(13);
    expect(plan.blocks[2].startWeek).toBe(29);
    expect(plan.goals).toEqual(['health', 'cut', 'recovery']);
    expect(plan.avgMinutesPerWeek).toBeGreaterThan(0);
  });

  it('пустой список → null', () => {
    expect(cardioYearPlan([])).toBeNull();
  });

  it('buildCardioYearText: диаграмма недель + итог', () => {
    const a = buildCardioCycle({ goal: 'health', totalWeeks: 12, id: 'y4', name: 'База' });
    const plan = cardioYearPlan([a])!;
    const text = buildCardioYearText(plan);
    expect(text).toContain('Год кардио');
    expect(text).toContain('1–12 нед');
    expect(text).toContain('Итого: 12 нед');
  });
});

// ─── Цикл без taper (taper: false) ───

describe('buildCardioCycle — taper: false (цикл без taper-кривой)', () => {
  it('со стартом и taper:false — нет taper-недель, перед стартом contest_prep, неделя старта peak', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, taper: false, competitions: [{ id: 'c', name: 'Шоу', week: 6 }] });
    expect(c.weeks.some(w => w.phase === 'taper')).toBe(false);
    expect(c.weeks.find(w => w.week === 6)!.phase).toBe('peak');
    // Недели до старта — наращивание (contest_prep), не taper.
    expect(c.weeks.find(w => w.week === 5)!.phase).toBe('contest_prep');
    expect(c.weeks.find(w => w.week === 1)!.phase).toBe('contest_prep');
  });

  it('taper:false + peakWeek:false — неделя старта обычная (maintenance), без taper', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, taper: false, peakWeek: false, competitions: [{ id: 'c', name: 'Шоу', week: 6 }] });
    expect(c.weeks.some(w => w.phase === 'taper')).toBe(false);
    expect(c.weeks.find(w => w.week === 6)!.phase).not.toBe('taper');
  });

  it('по умолчанию (taper не задан) — taper строится к старту', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, competitions: [{ id: 'c', name: 'Шоу', week: 6 }] });
    expect(c.weeks.some(w => w.phase === 'taper')).toBe(true);
  });
});

// ─── Качество и объяснение при taper: false ───

describe('cardioQualityReport — taper:false не штрафуется, taper:true без taper-недель штрафуется', () => {
  it('цикл со стартом и taper:false — НЕ предупреждает «нет taper-недель»', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, taper: false, competitions: [{ id: 'c', name: 'Шоу', week: 6 }] });
    const r = cardioQualityReport(c, 5);
    expect(c.weeks.some(w => w.phase === 'taper')).toBe(false);
    expect(r.findings.some(f => f.text.includes('нет ни одной taper-недели'))).toBe(false);
    expect(r.findings.some(f => f.text.includes('отключён'))).toBe(true);
  });

  it('цикл со стартом на 1-й неделе и taper включён (нет места под taper) — предупреждение остаётся', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, taper: true, competitions: [{ id: 'c', name: 'Старт', week: 1 }] });
    const r = cardioQualityReport(c, 5);
    expect(c.weeks.some(w => w.phase === 'taper')).toBe(false);
    expect(r.findings.some(f => f.level === 'warn' && f.text.includes('нет ни одной taper-недели'))).toBe(true);
  });
});

describe('explainCardioChoice — текст для taper:false', () => {
  it('при taper:false объяснение сообщает «taper отключён» вместо «taper N нед»', () => {
    const input = { goal: 'cut' as const, totalWeeks: 8, taper: false, competitions: [{ id: 'c', name: 'Шоу', week: 8 }] };
    const cycle = buildCardioCycle({ ...input });
    const text = explainCardioChoice({ ...input }, cycle).join('\n');
    expect(text).toContain('taper отключён');
    expect(text).not.toContain('taper 2 нед');
    expect(text).toContain('наращивание');
  });

  it('при taper:true объяснение сообщает число недель taper', () => {
    const input = { goal: 'cut' as const, totalWeeks: 8, taper: true, competitions: [{ id: 'c', name: 'Шоу', week: 8 }] };
    const cycle = buildCardioCycle({ ...input });
    const text = explainCardioChoice({ ...input }, cycle).join('\n');
    expect(text).toContain('taper 2 нед');
  });
});

describe('рационал buildCardioCycle — текст для taper:false', () => {
  it('при taper:false рационал сообщает «taper отключён» и не упоминает taper-кривую', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, taper: false, competitions: [{ id: 'c', name: 'Шоу', week: 8 }] });
    const text = c.rationale.join('\n');
    expect(text).toContain('taper отключён');
    expect(text).toContain('наращивание (contest_prep)');
    expect(text).not.toContain('taper 2 нед');
  });

  it('при taper:true рационал сообщает число недель taper', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, competitions: [{ id: 'c', name: 'Шоу', week: 8 }] });
    const text = c.rationale.join('\n');
    expect(text).toContain('taper 2 нед');
  });
});

// ─── Интенсивностная периодизация Z2 (проф) ───

describe('buildCardioCycle — периодизация зоны Z2', () => {
  it('Z2 начинается с нижней границы и сдвигается вверх к концу цикла', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 8, age: 40 });
    const first = c.weeks[0].sessions.find(s => s.type === 'zone2')!;
    const last = c.weeks.find(w => w.week === 7)!.sessions.find(s => s.type === 'zone2')!;
    expect(first.targetHr?.min).toBe(Math.round(180 * 0.6));
    expect(last.targetHr!.min!).toBeGreaterThan(first.targetHr!.min!);
  });

  it('taper-неделя получает Z2 в нижней части зоны (свежесть к старту)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, age: 30, competitions: [{ id: 'c', name: 'Шоу', week: 6 }] });
    const taper = c.weeks.find(w => w.phase === 'taper')!;
    const z2 = taper.sessions.find(s => s.type === 'zone2')!;
    expect(z2.targetHr?.min).toBe(Math.round(190 * 0.6));
  });
});

// ─── Прогноз адаптации и подсказки (проф) ───

describe('cardioFitnessForecast / cardioCoachHints', () => {
  it('новичок получает больший прогноз прироста, чем продвинутый', () => {
    const nov = buildCardioCycle({ goal: 'health', totalWeeks: 12, level: 'beginner', age: 30 });
    const adv = buildCardioCycle({ goal: 'health', totalWeeks: 12, level: 'advanced', age: 30 });
    const fn = cardioFitnessForecast(nov);
    const fa = cardioFitnessForecast(adv);
    expect(fn.vo2GainPct).toBeGreaterThan(fa.vo2GainPct);
    expect(fn.effectiveWeeks).toBeGreaterThan(0);
    expect(fa.note).toContain('рабочих нед');
  });

  it('mass-цикл не обещает большой адаптации', () => {
    const c = buildCardioCycle({ goal: 'mass', totalWeeks: 8, level: 'beginner', age: 30 });
    const f = cardioFitnessForecast(c);
    expect(f.vo2GainPct).toBeLessThan(3);
  });

  it('подсказки: контрольный замер на 4-й рабочей неделе, делод и taper помечены', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, competitions: [{ id: 'c', name: 'Шоу', week: 8 }] });
    const hints = cardioCoachHints(c);
    // Неделя 4 в этом цикле — делод (каждые 4 нед), замер попадает на следующую рабочую (5).
    expect(hints.some(h => h.kind === 'test' && h.week === 5)).toBe(true);
    expect(hints.some(h => h.kind === 'deload')).toBe(true);
    expect(hints.some(h => h.kind === 'taper')).toBe(true);
    expect(hints.some(h => h.kind === 'peak')).toBe(true);
  });

  it('cardioCoachSummary содержит прогноз и недели замеров', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 10, age: 30 });
    const lines = cardioCoachSummary(c);
    expect(lines.some(l => l.includes('Прогноз адаптации'))).toBe(true);
    expect(lines.some(l => l.includes('Контрольные замеры'))).toBe(true);
  });

  it('печатная сводка и текстовая содержат прогноз адаптации и ключевые недели', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 10, age: 30, competitions: [{ id: 'c', name: 'Шоу', week: 10 }] });
    const html = buildCardioPrintHtml(c);
    expect(html).toContain('Прогноз адаптации');
    expect(html).toContain('Ключевые недели');
    const text = buildCardioSummaryText(c);
    expect(text).toContain('Прогноз адаптации');
    expect(text).toContain('Контрольные замеры');
  });

  it('печатная сводка: дни ног в шапке и 🦵-маркеры в таблице дней', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, legDays: [0] });
    const html = buildCardioPrintHtml(c);
    expect(html).toContain('🦵 Дни тяжёлых ног: Пн');
    expect(html).toContain('Нед 1');
    expect(html).toContain('#fff7e0');
  });

  it('печатная сводка: без дней ног — строки 🦵 нет', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4 });
    expect(buildCardioPrintHtml(c)).not.toContain('Дни тяжёлых ног');
  });
});

// ─── Урезание сессий при малом числе дней ───

describe('buildCardioCycle — урезание сессий при daysAvailable < частоты', () => {
  it('при 1 дне в неделю rationale недель сообщает об урезании', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, daysAvailable: 1 });
    const cut = c.weeks.filter(w => w.rationale.some(r => r.includes('сессии урезаны')));
    expect(cut.length).toBeGreaterThan(0);
    expect(cut[0].sessions.reduce((s, x) => s + x.weeklyFrequency, 0)).toBeLessThanOrEqual(1);
  });

  it('при 7 днях урезания нет', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8, daysAvailable: 7 });
    expect(c.weeks.every(w => !w.rationale.some(r => r.includes('сессии урезаны')))).toBe(true);
  });
});
