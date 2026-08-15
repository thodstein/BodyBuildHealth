import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildCardioCycle, buildCardioPlan, kcalForCardio, capSessionsToDays,
  cardioPhaseForWeek, cardioPlanToCycle, cardioCycleSummary,
  adaptCardioToStrength, applyPLCardioTaper, applyBBCardioTaper, applyCardioTaperBySport,
  loadCardioCycles, saveCardioCycle, removeCardioCycle,
  loadActiveCardioCycle, setActiveCardioCycle,
  compareCardioCycles, formatCardioComparison,
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
