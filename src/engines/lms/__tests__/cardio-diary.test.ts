import { describe, it, expect, beforeEach } from 'vitest';
import { buildCardioCycle } from '../cardio.engine';
import {
  loadCardioLog, saveCardioLogEntry, removeCardioLogEntry, clearCardioLog,
  cardioLogStats, dateDaysAgo, weekStartIso,
  cardioWeekAdherence, cardioAdherenceSummary, computeCardioAdvice,
  cardioWeekFact, cardioCycleCompliance,
  cardioDayFact, cardioDayLoad, cardioHrCompliance,
  estimateCardioEntryKcal, cardioPaceMinPerKm, cardioAvgPaceMinPerKm,
  type CardioLogEntry,
} from '../cardio-diary.engine';

const LOG_KEY = 'he_cardio_sessions';
const REF = '2026-01-05T00:00:00.000Z';

function entry(patch: Partial<CardioLogEntry>): CardioLogEntry {
  return { id: 'e' + Math.random(), date: '2026-01-05', type: 'zone2', durationMin: 30, completed: true, ...patch };
}

beforeEach(() => {
  try { localStorage.removeItem(LOG_KEY); } catch { /* ignore */ }
});

describe('CRUD журнала', () => {
  it('save → load (сортировка DESC по дате)', () => {
    saveCardioLogEntry(entry({ date: '2026-01-05' }));
    saveCardioLogEntry(entry({ date: '2026-01-07' }));
    const log = loadCardioLog();
    expect(log).toHaveLength(2);
    expect(log[0].date).toBe('2026-01-07');
  });

  it('remove удаляет по id; повреждённые данные → []', () => {
    const e = entry({});
    saveCardioLogEntry(e);
    removeCardioLogEntry(e.id);
    expect(loadCardioLog()).toHaveLength(0);
    try { localStorage.setItem(LOG_KEY, '{bad'); } catch { /* ignore */ }
    expect(loadCardioLog()).toEqual([]);
  });

  it('cap: 500 записей', () => {
    for (let i = 0; i < 505; i++) saveCardioLogEntry(entry({ id: 'e' + i, date: '2026-01-01' }));
    expect(loadCardioLog()).toHaveLength(500);
  });

  it('clear удаляет всё', () => {
    saveCardioLogEntry(entry({}));
    clearCardioLog();
    expect(loadCardioLog()).toHaveLength(0);
  });
});

describe('статистика', () => {
  it('cardioLogStats 7 дней: только выполненные и в окне', () => {
    saveCardioLogEntry(entry({ date: '2026-01-05', durationMin: 30, rpe: 6, avgHr: 130, calories: 200, distanceKm: 5, completed: true }));
    saveCardioLogEntry(entry({ date: '2026-01-06', durationMin: 15, type: 'hiit', rpe: 9, avgHr: 160, calories: 220, distanceKm: 2.5, completed: true }));
    saveCardioLogEntry(entry({ date: '2025-12-01', durationMin: 999, completed: true }));
    saveCardioLogEntry(entry({ date: '2026-01-07', durationMin: 10, completed: false }));
    const s = cardioLogStats(loadCardioLog(), 7, REF);
    expect(s.sessions).toBe(2);
    expect(s.minutes).toBe(45);
    expect(s.avgRpe).toBe(7.5);
    expect(s.avgHr).toBe(145);
    expect(s.kcal).toBe(420);
    expect(s.km).toBe(7.5);
  });

  it('dateDaysAgo/weekStartIso работают локально (независимо от TZ)', () => {
    expect(dateDaysAgo(0, REF)).toBe('2026-01-05');
    expect(dateDaysAgo(7, REF)).toBe('2025-12-29');
    expect(weekStartIso(1, REF)).toBe('2026-01-05');
    expect(weekStartIso(2, REF)).toBe('2026-01-12');
  });
});

describe('adherence', () => {
  it('cardioWeekAdherence: план vs факт', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, daysAvailable: 3 });
    saveCardioLogEntry(entry({ date: '2026-01-05', durationMin: 30, completed: true }));
    saveCardioLogEntry(entry({ date: '2026-01-06', durationMin: 25, completed: true }));
    const a = cardioWeekAdherence(c, 1, loadCardioLog(), REF);
    expect(a.plannedSessions).toBeGreaterThanOrEqual(2);
    expect(a.doneSessions).toBe(2);
    expect(a.plannedMinutes).toBeGreaterThan(0);
    expect(a.doneMinutes).toBe(55);
  });

  it('cardioAdherenceSummary считает средние по неделям', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4 });
    const log = [entry({ date: '2026-01-05', durationMin: 30, completed: true })];
    const s = cardioAdherenceSummary(c, log, 2, REF);
    expect(s.weeks).toHaveLength(2);
    expect(s.avgPctSessions).toBeGreaterThanOrEqual(0);
    expect(s.totalDone).toBe(1);
  });
});

describe('estimateCardioEntryKcal', () => {
  it('zone2 45 мин при 80 кг = 315 (MET-модель движка)', () => {
    expect(estimateCardioEntryKcal('zone2', 45)).toBe(315);
  });

  it('hiit 15 мин при 80 кг = 210', () => {
    expect(estimateCardioEntryKcal('hiit', 15)).toBe(210);
  });

  it('вес влияет линейно (кг × поправка)', () => {
    expect(estimateCardioEntryKcal('zone2', 45, 100)).toBe(Math.round(315 * 100 / 80));
  });

  it('вес 0/отрицательный → дефолт 80', () => {
    expect(estimateCardioEntryKcal('zone2', 45, 0)).toBe(315);
    expect(estimateCardioEntryKcal('zone2', 45, -5)).toBe(315);
  });
});

describe('cardioPaceMinPerKm / cardioAvgPaceMinPerKm (темп мин/км)', () => {
  it('5 км за 30 мин → 6:00/км', () => {
    expect(cardioPaceMinPerKm(5, 30)).toBe('6:00/км');
  });

  it('округление секунд: 5 км за 27 мин → 5:24/км', () => {
    expect(cardioPaceMinPerKm(5, 27)).toBe('5:24/км');
  });

  it('null без дистанции/времени/с нулями и отрицательными', () => {
    expect(cardioPaceMinPerKm(undefined, 30)).toBeNull();
    expect(cardioPaceMinPerKm(0, 30)).toBeNull();
    expect(cardioPaceMinPerKm(5, 0)).toBeNull();
    expect(cardioPaceMinPerKm(5, undefined)).toBeNull();
    expect(cardioPaceMinPerKm(-3, 30)).toBeNull();
  });

  it('средний темп взвешен по дистанции (сумма км / сумма минут)', () => {
    const rows = [
      { distanceKm: 5, durationMin: 30 },
      { distanceKm: 5, durationMin: 40 },
    ];
    expect(cardioAvgPaceMinPerKm(rows)).toBe('7:00/км');
  });

  it('средний темп: null при нулевой дистанции/пустом наборе', () => {
    expect(cardioAvgPaceMinPerKm([{ distanceKm: 0, durationMin: 30 }])).toBeNull();
    expect(cardioAvgPaceMinPerKm([{ distanceKm: undefined, durationMin: 30 }])).toBeNull();
    expect(cardioAvgPaceMinPerKm([])).toBeNull();
  });

  it('cardioLogStats.avgPace считается по завершённым записям окна', () => {
    saveCardioLogEntry(entry({ date: '2026-01-05', durationMin: 30, distanceKm: 5 }));
    saveCardioLogEntry(entry({ date: '2026-01-06', durationMin: 30, distanceKm: 5 }));
    saveCardioLogEntry(entry({ date: '2026-01-20', durationMin: 30, distanceKm: 5, completed: false }));
    const stats = cardioLogStats(loadCardioLog(), 30, REF);
    expect(stats.avgPace).toBe('6:00/км');
  });

  it('cardioLogStats.avgPace: null без км в окне', () => {
    saveCardioLogEntry(entry({ date: '2026-01-05', durationMin: 30 }));
    const stats = cardioLogStats(loadCardioLog(), 30, REF);
    expect(stats.avgPace).toBeNull();
  });
});

describe('computeCardioAdvice', () => {
  const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8 });

  it('null-цикл → keep с подсказкой «не выбран»', () => {
    const a = computeCardioAdvice(null, [], {});
    expect(a.action).toBe('keep');
    expect(a.reason).toContain('не выбран');
  });

  it('цикл без недель → keep с подсказкой «не выбран»', () => {
    const empty = { ...c, weeks: [] };
    const a = computeCardioAdvice(empty, [], {});
    expect(a.action).toBe('keep');
    expect(a.reason).toContain('не выбран');
  });

  it('опасный ACWR → reduce', () => {
    const a = computeCardioAdvice(c, [], { acwr: 1.6 });
    expect(a.action).toBe('reduce');
    expect(a.reason).toContain('ACWR');
  });

  it('низкое восстановление → reduce', () => {
    const a = computeCardioAdvice(c, [], { recoveryLow: true });
    expect(a.action).toBe('reduce');
  });

  it('нет данных → keep с подсказкой', () => {
    const a = computeCardioAdvice(c, [], {});
    expect(a.action).toBe('keep');
    expect(a.reason).toContain('не записано');
  });

  it('пропуски за 7 дней → keep с упоминанием пропусков', () => {
    const log = [
      entry({ date: '2026-01-05', completed: false }),
      entry({ date: '2026-01-06', completed: false }),
    ];
    const a = computeCardioAdvice(c, log, { referenceIso: REF });
    expect(a.action).toBe('keep');
    expect(a.reason).toContain('пропущено 2');
  });

  it('выполнено <60% плана → increase', () => {
    const log = [entry({ date: '2026-01-05', durationMin: 15, completed: true })];
    const a = computeCardioAdvice(c, log, { referenceIso: REF });
    expect(a.action).toBe('increase');
  });

  it('RPE ≥ 8 → reduce', () => {
    // Объём цикла с прогрессией ~130 мин/нед: 90 мин ≥ 60% плана, чтобы RPE-перегруз сработал.
    const log = [entry({ date: '2026-01-05', durationMin: 90, rpe: 9, completed: true })];
    const a = computeCardioAdvice(c, log, { referenceIso: REF });
    expect(a.action).toBe('reduce');
    expect(a.reason).toContain('RPE');
  });

  it('нагрузка в норме → keep', () => {
    const log = [
      entry({ date: '2026-01-05', durationMin: 40, rpe: 6, completed: true }),
      entry({ date: '2026-01-06', durationMin: 40, rpe: 6, completed: true }),
      entry({ date: '2026-01-07', durationMin: 40, rpe: 6, completed: true }),
    ];
    const a = computeCardioAdvice(c, log, { referenceIso: REF });
    expect(a.action).toBe('keep');
  });
});

describe('план vs факт (cardioWeekFact / cardioCycleCompliance)', () => {
  it('cardioWeekFact: минуты/сессии/ккал/км факта в окне недели', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4 });
    const log = [
      entry({ date: '2026-01-05', durationMin: 30, calories: 210, distanceKm: 5, completed: true }),
      entry({ date: '2026-01-08', durationMin: 25, calories: 175, distanceKm: 3, completed: true }),
      entry({ date: '2026-01-12', durationMin: 60, calories: 500, completed: true }), // неделя 2
      entry({ date: '2026-01-09', durationMin: 20, completed: false }),
    ];
    const f = cardioWeekFact(c, 1, log, REF);
    expect(f.doneSessions).toBe(2);
    expect(f.doneMinutes).toBe(55);
    expect(f.factKcal).toBe(385);
    expect(f.factKm).toBe(8);
    expect(f.plannedSessions).toBeGreaterThan(0);
  });

  it('cardioCycleCompliance: overall % по фильтру недель', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, daysAvailable: 3 });
    const log = [entry({ date: '2026-01-05', durationMin: 30, completed: true })];
    const all = cardioCycleCompliance(c, log, undefined, REF);
    expect(all.weeks).toHaveLength(4);
    expect(all.totalDoneSessions).toBe(1);
    // Только неделя 1: 30 мин из 75 (health base 3×25) → 40%.
    const w1 = cardioCycleCompliance(c, log, w => w === 1, REF);
    expect(w1.overallPctMinutes).toBe(40);
  });

  it('пустой журнал → 0% без ошибок', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4 });
    const r = cardioCycleCompliance(c, [], w => w === 1, REF);
    expect(r.overallPctMinutes).toBe(0);
    expect(r.totalDoneSessions).toBe(0);
  });
});

describe('день: план, факт, нагрузка (кардио-слой дневника)', () => {
  it('cardioDayFact: выполненные сессии за дату', () => {
    const log = [
      entry({ date: '2026-01-05', durationMin: 30, rpe: 6, calories: 210, distanceKm: 5, completed: true }),
      entry({ date: '2026-01-05', durationMin: 15, type: 'hiit', rpe: 9, calories: 220, distanceKm: 2.5, completed: true }),
      entry({ date: '2026-01-06', durationMin: 60, completed: true }),
      entry({ date: '2026-01-05', durationMin: 20, completed: false }),
    ];
    const f = cardioDayFact(log, '2026-01-05');
    expect(f.done).toHaveLength(2);
    expect(f.minutes).toBe(45);
    expect(f.kcal).toBe(430);
    expect(f.km).toBe(7.5);
    expect(f.avgRpe).toBe(7.5);
  });

  it('cardioDayLoad: план из цикла + факт + силовая нагрузка', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, startDate: '2026-01-05' });
    const log = [entry({ date: '2026-01-05', durationMin: 30, rpe: 6, completed: true })];
    const srpe = [{ date: '2026-01-05', sRPE: 8, durationMin: 60 }];
    const l = cardioDayLoad(c, log, srpe, '2026-01-05', '2026-01-05');
    expect(l.planned.length).toBeGreaterThan(0);
    expect(l.cardioMinutes).toBe(30);
    expect(l.cardioLoad).toBe(18); // 30 × 0.6
    expect(l.strengthSessions).toBe(1);
    expect(l.strengthLoad).toBe(480);
    expect(l.totalLoad).toBe(498);
  });

  it('cardioDayLoad без RPE: дефолт 5 → cardioLoad = 0.5 × минуты', () => {
    const log = [entry({ date: '2026-01-05', durationMin: 20, completed: true })];
    const l = cardioDayLoad(null, log, [], '2026-01-05', REF);
    expect(l.cardioLoad).toBe(10);
    expect(l.strengthSessions).toBe(0);
    expect(l.totalLoad).toBe(10);
  });
});

describe('cardioHrCompliance — факт-ЧСС vs целевые зоны', () => {
  it('сессии в зоне/выше/ниже классифицируются корректно', () => {
    // health, 30 лет: zone2 (зона 2) ≈ 114-133, зона 3 ≈ 133-152 (по % от ЧССмакс 190).
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, startDate: '2026-01-05', age: 30 });
    const log = [
      entry({ date: '2026-01-05', durationMin: 25, avgHr: 120, completed: true }), // в зоне
      entry({ date: '2026-01-06', durationMin: 25, avgHr: 160, completed: true }), // выше
      entry({ date: '2026-01-07', durationMin: 25, avgHr: 100, completed: true }), // ниже
      entry({ date: '2026-01-08', durationMin: 25, completed: true }),             // без ЧСС — пропуск
    ];
    const r = cardioHrCompliance(c, log, { days: 28, referenceIso: '2026-01-05' });
    expect(r.checks).toHaveLength(3);
    expect(r.checks[0].inZone).toBe(true);
    expect(r.checks[1].above).toBe(true);
    expect(r.checks[2].below).toBe(true);
    expect(r.inZonePct).toBe(33);
    expect(r.advice).not.toBeNull();
  });

  it('без данных с ЧСС → null-результат', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, startDate: '2026-01-05' });
    const r = cardioHrCompliance(c, [], { days: 28, referenceIso: '2026-01-05' });
    expect(r.inZonePct).toBeNull();
    expect(r.advice).toBeNull();
  });
});
