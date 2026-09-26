import { describe, expect, it, beforeEach } from 'vitest';
import {
  cmjScreen, cmjIsEmpty, jumpHeightCmFromFlight, CMJ_ZONE_THRESHOLDS, CMJ_SCREENING_NOTE, CMJ_NON_BLOCKING_NOTE, CMJ_PHONE_TREND_NOTE,
  loadCmj, saveCmj, clearCmj, type CmjEntry,
} from '../intelligence-cmj.engine';
import {
  wellnessReport, itemScore, wellnessIllnessInWindow, loadWellness, saveWellness, clearWellness,
  WELLNESS_ITEMS, WELLNESS_META, WELLNESS_ITEM_ALARM, TEMP_ALARM_C, WELLNESS_PROTOCOL_NOTE,
  WELLNESS_NO_DIAGNOSIS_NOTE, WELLNESS_ILLNESS_NOTE, type WellnessEntry,
} from '../intelligence-wellness.engine';

function iso(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function back(n: number, from = new Date(2026, 8, 28)): string { const d = new Date(from.getTime()); d.setDate(d.getDate()-n); return iso(d); }

beforeEach(() => { try { clearCmj(); clearWellness(); } catch { /* noop */ } });

describe('E7 CMJ: высота из времени полёта', () => {
  it('h = g·t²/8 (320 мс → ~12.6 см)', () => {
    const h = jumpHeightCmFromFlight(320)!;
    expect(h).toBeGreaterThan(12);
    expect(h).toBeLessThan(13);
  });
  it('мусорное время → null, а не «прыжок 0 см»', () => {
    expect(jumpHeightCmFromFlight(0)).toBeNull();
    expect(jumpHeightCmFromFlight(-100)).toBeNull();
    expect(jumpHeightCmFromFlight(9999)).toBeNull();
    expect(jumpHeightCmFromFlight(Number.NaN)).toBeNull();
  });
});

describe('E7 CMJ: нормировка на лучший результат серии', () => {
  const series: CmjEntry[] = [
    { date: back(3), heightCm: 40 }, { date: back(2), heightCm: 42 }, { date: back(1), heightCm: 41 }, { date: back(0), heightCm: 33 },
  ];
  it('текущий = % от лучшего, просадка и зона считаются по серии, а не по календарю', () => {
    const r = cmjScreen(series, back(0));
    expect(r.current!.vsSeriesBestPct).toBeCloseTo(78.6, 0);
    expect(r.current!.dropFromBestPct).toBeGreaterThanOrEqual(CMJ_ZONE_THRESHOLDS.redDropPct);
    expect(r.zone).toBe('red');
  });
  it('зелёная зона: просадка в пределах разброса', () => {
    const r = cmjScreen([{ date: back(1), heightCm: 40 }, { date: back(0), heightCm: 39 }], back(0));
    expect(r.zone).toBe('green');
  });
  it('жёлтая зона: 5–10% (46 от 50 = 8% — в жёлтой полосе, красный порог 10%)', () => {
    const r = cmjScreen([{ date: back(1), heightCm: 50 }, { date: back(0), heightCm: 46 }], back(0));
    expect(r.zone).toBe('yellow');
    const red = cmjScreen([{ date: back(1), heightCm: 50 }, { date: back(0), heightCm: 45 }], back(0));
    expect(red.zone).toBe('red'); // ровно 10% — порог красного
  });
  it('мощность нормируется на вес тела (иначе день с бо́льшим весом «хуже»)', () => {
    const heavy = cmjScreen([{ date: back(1), powerW: 2000, bodyweightKg: 100 }, { date: back(0), powerW: 1900, bodyweightKg: 95 }], back(0));
    expect(heavy.current!.powerPerKg).toBe(20); // 1900/95
    expect(heavy.current!.vsSeriesBestPct).toBeCloseTo(100, 0);
  });
  it('метод замера попадает в точку (flight_time ≠ height) и даёт сигнал о погрешности', () => {
    const r = cmjScreen([{ date: back(1), flightTimeMs: 400 }, { date: back(0), flightTimeMs: 390 }], back(0));
    expect(r.current!.measured).toBe('flight_time');
    expect(r.signals.join(' ')).toContain('погрешность выше');
  });
  it('метрика НИКОГДА не блокирует и честно называет себя скринингом', () => {
    const r = cmjScreen(series, back(0));
    expect(r.blocking).toBe(false);
    // 26.09.2026 (П1-Д): к двум оговоркам добавилась третья — телефонный CMJ это тренд,
    // а не лабораторный эталон (force-plate несопоставим, PMID 42666427).
    expect(r.note).toBe(`${CMJ_SCREENING_NOTE} ${CMJ_NON_BLOCKING_NOTE} ${CMJ_PHONE_TREND_NOTE}`);
    expect(r.note).toContain('НЕ тест готовности');
    expect(r.note).toContain('не автоблокировка');
    expect(r.note).toContain('ТРЕНД');
    expect(r.note).toContain('42666427');
    expect(r.note).toMatch(/решени[ея] о нагрузке по одному замеру не строим/);
  });
  it('мало замеров и отсутствие данных — разные честные состояния', () => {
    const one = cmjScreen([{ date: back(0), heightCm: 40 }], back(0));
    expect(one.zone).toBe('no_data'); // один замер не показывает динамику
    expect(one.signals.join(' ')).toContain('Один замер не показывает динамику');
    const two = cmjScreen([{ date: back(1), heightCm: 40 }, { date: back(0), heightCm: 33 }], back(0));
    expect(two.zone).toBe('red');
    expect(two.signals.join(' ')).toContain('Мало замеров');
    expect(cmjIsEmpty([])).toBe(true);
    expect(cmjIsEmpty([{ date: 'мусор', heightCm: 40 }])).toBe(true);
    expect(cmjIsEmpty([{ date: back(0), heightCm: 40 }])).toBe(false);
  });
  it('запись без измеримых значений не сохраняется (не «нулевой прыжок»)', () => {
    saveCmj({ date: back(0), heightCm: 0, flightTimeMs: 0 });
    expect(loadCmj()).toHaveLength(0);
  });
});

describe('E7 CMJ: журнал', () => {
  it('roundtrip: одна запись на дату, дедуп и cap', () => {
    saveCmj({ date: back(1), heightCm: 40, bodyweightKg: 80 });
    saveCmj({ date: back(0), heightCm: 42, bodyweightKg: 80 });
    const after = saveCmj({ date: back(0), heightCm: 45, bodyweightKg: 80 });
    expect(after).toHaveLength(2);
    expect(after.find(e => e.date === back(0))!.heightCm).toBe(45);
    expect(loadCmj()).toHaveLength(2);
  });
  it('битый стор → пустой журнал, а не throw', () => {
    localStorage.setItem('he_intelligence_cmj_v1', '{oops');
    expect(loadCmj()).toEqual([]);
  });
});

describe('E7 wellness: шкалы', () => {
  it('инвертированные пункты разворачиваются (стресс 1 = 100, стресс 5 = 0)', () => {
    expect(itemScore('stressLevel', 1)).toBe(100);
    expect(itemScore('stressLevel', 5)).toBe(0);
    expect(itemScore('soreness', 1)).toBe(100);
    expect(itemScore('sleepQuality', 5)).toBe(100);
    expect(itemScore('mood', 3)).toBe(50);
  });
  it('мусорные значения → null (не «средний балл»)', () => {
    expect(itemScore('mood', 0)).toBeNull();
    expect(itemScore('mood', 6)).toBeNull();
    expect(itemScore('mood', Number.NaN)).toBeNull();
  });
  it('все 5 пунктов объявлены с подписями-вопросами', () => {
    expect(WELLNESS_ITEMS).toHaveLength(5);
    for (const k of WELLNESS_ITEMS) {
      expect(WELLNESS_META[k].label).toBeTruthy();
      expect(WELLNESS_META[k].question).toBeTruthy();
    }
  });
});

describe('E7 wellness: отчёт', () => {
  const good: WellnessEntry[] = [{ date: back(0), sleepQuality: 5, soreness: 1, mood: 5, energy: 4, stressLevel: 1 }];
  it('хороший день → зелёный, тревожных сигналов 0', () => {
    const r = wellnessReport(good, back(0));
    expect(r.zone).toBe('green');
    expect(r.alarmSignals).toBe(0);
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.blocking).toBe(false);
  });
  it('плохой день → красный и «N сигналов из M», а НЕ диагноз', () => {
    const bad: WellnessEntry[] = [{ date: back(0), sleepQuality: 1, soreness: 5, mood: 1, energy: 1, stressLevel: 5 }];
    const r = wellnessReport(bad, back(0));
    expect(r.zone).toBe('red');
    expect(r.alarmSignals).toBe(5);
    expect(r.signals.join(' ')).toMatch(/5 тревожных сигналов из 5/);
    expect(r.signals.join(' ')).not.toMatch(/перетренирован/i);
    expect(r.note).toContain('НЕ валидированный тест');
    expect(r.note).toMatch(/[Дд]иагнозов перетренированности/);
    expect(WELLNESS_NO_DIAGNOSIS_NOTE).toContain('Meeusen 2013');
  });
  it('тревожный порог по пункту: 2 = тревожно, 3 = нет (для «хороших» пунктов)', () => {
    expect(WELLNESS_ITEM_ALARM).toBe(2);
    const two = wellnessReport([{ date: back(0), sleepQuality: 2, mood: 5, energy: 5, soreness: 1, stressLevel: 1 }], back(0));
    expect(two.alarmSignals).toBe(1);
  });
  it('болезнь/температура → зона illness и нагрузка не оценивается', () => {
    const ill: WellnessEntry[] = [{ date: back(0), sleepQuality: 5, mood: 5, energy: 5, soreness: 1, stressLevel: 1, illness: true }];
    const r = wellnessReport(ill, back(0));
    expect(r.zone).toBe('illness');
    expect(r.signals).toContain(WELLNESS_ILLNESS_NOTE);
    expect(WELLNESS_ILLNESS_NOTE).toContain('врач');
  });
  it('температура ≥ порога тоже считается болезнью (в окне недели)', () => {
    const t: WellnessEntry[] = [{ date: back(1), tempC: TEMP_ALARM_C + 0.1 }];
    expect(wellnessIllnessInWindow(t, back(6), back(0))).toBe(true);
    expect(wellnessIllnessInWindow([{ date: back(20), tempC: 38 }], back(6), back(0))).toBe(false);
  });
  it('без отметок — честный no_data, а не «зелёный»', () => {
    const r = wellnessReport([], back(0));
    expect(r.zone).toBe('no_data');
    expect(r.score).toBeNull();
    expect(r.signals.join(' ')).toContain('Нет ни одной отметки');
  });
  it('неделя сравнивается с прошлой; без прошлой недели — честная оговорка', () => {
    const withPrev: WellnessEntry[] = [
      ...[1, 2, 3, 4, 5, 6, 7].map(d => ({ date: back(d), sleepQuality: 5, soreness: 1, mood: 5, energy: 5, stressLevel: 1 })),
      ...[0].map(d => ({ date: back(d), sleepQuality: 2, soreness: 4, mood: 2, energy: 2, stressLevel: 4 })),
    ];
    const r = wellnessReport(withPrev, back(0));
    expect(r.daysLogged).toBe(7);
    expect(r.signals.join(' ')).toMatch(/К прошлой неделе: −\d+/);
    const noPrev = wellnessReport([good[0]], back(0));
    expect(noPrev.signals.join(' ')).toContain('сравнение не выполняется');
  });
  it('мало дней помечается как ориентировочный вердикт', () => {
    const r = wellnessReport(good, back(0));
    expect(r.signals.join(' ')).toContain('вердикт ориентировочный');
  });
});

describe('E7 wellness: журнал', () => {
  it('roundtrip: одна запись на дату + дедуп', () => {
    saveWellness({ date: back(0), sleepQuality: 4, mood: 4 });
    const after = saveWellness({ date: back(0), sleepQuality: 2, mood: 3 });
    expect(after).toHaveLength(1);
    expect(after[0].sleepQuality).toBe(2);
  });
  it('мусорные значения вырезаются, а не сохраняются как «0 = плохо»', () => {
    saveWellness({ date: back(0), sleepQuality: 99, mood: Number.NaN, soreness: 3 });
    const list = loadWellness();
    expect(list[0].sleepQuality).toBeUndefined();
    expect(list[0].mood).toBeUndefined();
    expect(list[0].soreness).toBe(3);
  });
  it('битый стор → пустой журнал; очистка чистит ключ', () => {
    localStorage.setItem('he_intelligence_wellness_v1', '[[[');
    expect(loadWellness()).toEqual([]);
    saveWellness({ date: back(0), mood: 4 });
    expect(loadWellness()).toHaveLength(1);
    clearWellness();
    expect(loadWellness()).toEqual([]);
  });
  it('оговорка протокола говорит, что валидированного теста нет', () => {
    expect(WELLNESS_PROTOCOL_NOTE).toContain('НЕ валидированный тест');
    expect(WELLNESS_PROTOCOL_NOTE).toContain('Saw 2016');
  });
});
