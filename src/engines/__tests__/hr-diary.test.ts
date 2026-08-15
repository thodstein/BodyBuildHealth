/**
 * hr-diary.test.ts — дневник ЧСС (he_hr_diary).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getHREntries,
  saveHREntry,
  updateHREntry,
  deleteHREntry,
  clearHRDiary,
  replaceHRDiary,
  findByDateAndTimeOfDay,
  getHRAverages,
  detectHRAnomalies,
  getHRTrend,
  HR_DIARY_KEY,
  todayLocalStr,
  type HREntry,
} from '../hr-diary.engine';

const today = todayLocalStr();

beforeEach(() => {
  localStorage.clear();
});

const mkEntry = (date: string, timeOfDay: 'morning' | 'evening', bpm: number, id = `hr_${date}_${timeOfDay}`): HREntry => ({
  id,
  date,
  timeOfDay,
  bpm,
});

describe('hr-diary.engine — CRUD', () => {
  it('пустой дневник → []', () => {
    expect(getHREntries()).toEqual([]);
  });

  it('добавление: максимум 2 записи в день (утро+вечер), дедуп по (date+timeOfDay)', () => {
    saveHREntry({ date: today, timeOfDay: 'morning', bpm: 58 });
    saveHREntry({ date: today, timeOfDay: 'evening', bpm: 72 });
    saveHREntry({ date: today, timeOfDay: 'morning', bpm: 60 }); // замена утренней
    const all = getHREntries();
    expect(all.length).toBe(2);
    const morning = findByDateAndTimeOfDay(all, today, 'morning');
    expect(morning?.bpm).toBe(60);
  });

  it('порядок: DESC по дате, утро перед вечером в один день', () => {
    saveHREntry({ date: '2026-08-10', timeOfDay: 'evening', bpm: 70 });
    saveHREntry({ date: '2026-08-12', timeOfDay: 'morning', bpm: 55 });
    saveHREntry({ date: '2026-08-12', timeOfDay: 'evening', bpm: 68 });
    const all = getHREntries();
    expect(all.map((e) => `${e.date}:${e.timeOfDay}`)).toEqual([
      '2026-08-12:morning',
      '2026-08-12:evening',
      '2026-08-10:evening',
    ]);
  });

  it('update сменой времени суток не создаёт дублей', () => {
    saveHREntry({ date: today, timeOfDay: 'morning', bpm: 58 });
    const all = getHREntries();
    const id = all[0].id;
    updateHREntry(id, { timeOfDay: 'evening', bpm: 71 });
    const after = getHREntries();
    expect(after.length).toBe(1);
    expect(after[0].timeOfDay).toBe('evening');
    expect(after[0].bpm).toBe(71);
  });

  it('delete/clear/replace', () => {
    saveHREntry({ date: today, timeOfDay: 'morning', bpm: 58 });
    const all = getHREntries();
    deleteHREntry(all[0].id);
    expect(getHREntries()).toEqual([]);
    saveHREntry({ date: today, timeOfDay: 'morning', bpm: 58 });
    clearHRDiary();
    expect(getHREntries()).toEqual([]);
    replaceHRDiary([mkEntry('2026-08-01', 'morning', 60)]);
    expect(getHREntries().length).toBe(1);
  });

  it('нормализация: невалидные записи отбрасываются (bpm вне диапазона)', () => {
    localStorage.setItem(HR_DIARY_KEY, JSON.stringify([
      { id: 'a', date: today, timeOfDay: 'morning', bpm: 300 },
      { id: 'b', date: today, timeOfDay: 'morning', bpm: 0 },
      { id: 'c', date: today, timeOfDay: 'morning', bpm: 60 },
      { bad: true },
    ]));
    expect(getHREntries().length).toBe(1);
  });
});

describe('hr-diary.engine — аналитика', () => {
  beforeEach(() => {
    localStorage.clear();
    // 3 старые записи (10-8 дней назад, ЧСС выше — «недавно было выше»)
    const base = new Date();
    for (let i = 10; i >= 8; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      saveHREntry({ date: iso, timeOfDay: 'morning', bpm: 70 + (10 - i) });
    }
    // 5 свежих (0-4 дня назад): утро 58-62, вечер 70-74
    for (let i = 0; i < 5; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      saveHREntry({ date: iso, timeOfDay: 'morning', bpm: 58 + i });
      saveHREntry({ date: iso, timeOfDay: 'evening', bpm: 70 + i });
    }
  });

  it('getHRAverages: средние утро/вечер за 7 дней (только свежие)', () => {
    const avg = getHRAverages(getHREntries(), 7);
    expect(avg.morning.count).toBe(5);
    expect(avg.morning.avg).toBe(60);
    expect(avg.evening.avg).toBe(72);
  });

  it('getHRAverages: за 1 день — только сегодняшние записи', () => {
    const avg = getHRAverages(getHREntries(), 1);
    expect(avg.morning.count).toBe(1);
    expect(avg.morning.avg).toBe(58);
  });

  it('detectHRAnomalies: тахикардия ≥100, брадикардия ≤40', () => {
    saveHREntry({ date: today, timeOfDay: 'morning', bpm: 125 });
    const issues = detectHRAnomalies(getHREntries());
    expect(issues.some((i) => i.severity === 'danger' && i.message.includes('125'))).toBe(true);
  });

  it('getHRTrend: свежие (58-62) ниже старых (70-72) → direction down', () => {
    const trend = getHRTrend(getHREntries());
    expect(trend).not.toBeNull();
    expect(trend!.direction).toBe('down');
    expect(typeof trend!.delta).toBe('number');
    expect(trend!.delta).toBeLessThan(0);
  });
});
