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
  cardioWeightAdvice,
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

  it('сушка: zone2 появляется в базе, HIIT в build/maintenance, делод каждые 4 нед', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 12 });
    const w1 = c.weeks[0];
    expect(w1.sessions.some(s => s.type === 'zone2')).toBe(true);
    expect(w1.sessions.some(s => s.type === 'hiit')).toBe(false);
    const w5 = c.weeks[4];
    expect(w5.sessions.some(s => s.type === 'hiit')).toBe(true);
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
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6 });
    const r = autoTuneCardioCycle(c, [], { acwr: 1.6, referenceIso: REF });
    expect(r.changes.length).toBeGreaterThan(0);
    const tunedWeeks = r.cycle.weeks.filter(w => !w.deload && !w.taper);
    for (const w of tunedWeeks) expect(w.sessions.some(s => s.type === 'hiit')).toBe(false);
  });

  it('выполнено <60% сессий → частота zone2 −1', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4 });
    const planned = c.weeks[0].sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
    const log = [{ date: '2026-01-05', durationMin: 30, completed: true }];
    const r = autoTuneCardioCycle(c, log, { referenceIso: REF });
    const freqAfter = r.cycle.weeks[0].sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
    expect(freqAfter).toBeLessThan(planned);
  });

  it('RPE ≥8 → минуты −10%', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6 });
    const before = c.weeks[0].totalMinutes;
    const log = [{ date: '2026-01-05', durationMin: 45, rpe: 9, completed: true }, { date: '2026-01-06', durationMin: 45, rpe: 8, completed: true }];
    const r = autoTuneCardioCycle(c, log, { referenceIso: REF });
    expect(r.cycle.weeks[0].totalMinutes).toBeLessThan(before);
  });

  it('соответствие плану → изменений нет', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4 });
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
  it('5 пресетов с валидными параметрами', () => {
    expect(CARDIO_PRESETS).toHaveLength(5);
    for (const p of CARDIO_PRESETS) {
      expect(p.totalWeeks).toBeGreaterThan(0);
      expect(p.daysAvailable).toBeGreaterThanOrEqual(0);
      expect(['health', 'mass', 'cut', 'recomp', 'maintenance', 'recovery']).toContain(p.goal);
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
