/**
 * report-date-canon.test.ts — окна «за N дней» и «сегодня» в отчётных движках.
 *
 * Раунд «хвостов» по датам: пять движков брали календарь по UTC
 * (`toISOString().slice(0,10)`), из-за чего в вечернее время UTC+3…+12:
 *  - «сегодня» в отчёте/дневнике симптомов уезжало на вчера;
 *  - окно «за 30 дней» по анализам обрезало сегодняшние записи;
 *  - окно приверженности за 7 дней не включало приём, сделанный вечером.
 *
 * Момент времени закреплён через setSystemTime так, чтобы локальная и UTC-даты
 * РАЗЛИЧАЛИСЬ (иначе на UTC+10 днём проверка была бы вакуумной — так и вышло
 * в первой версии лока, проверено мутацией).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { getLabFrequency, getLabDiarySummary, getRecentAbnormalMarkers, type LabDiaryEntry } from '../lab-diary.engine';
import { localIsoDate, localIsoDateOffset } from '../../core/local-date';

const смещениеВпередПоUTC = -new Date().getTimezoneOffset();

/** Момент, где локальный календарь уже на сутки впереди UTC. */
const МОМЕНТ_РАСХОЖДЕНИЯ = '2026-09-26T20:30:00Z';

afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

const запись = (date: string, abnormal = 0): LabDiaryEntry => ({
  date, markers: [], totalMarkers: 3, abnormalCount: abnormal,
});

describe('окна отчётных движков считаются по локальному календарю', () => {
  it('«сегодня» совпадает с каноном, а не с UTC-вчера', () => {
    if (смещениеВпередПоUTC <= 0) { console.log('[report-dates] TZ = 0 — проверка пропущена'); return; }
    vi.useFakeTimers();
    vi.setSystemTime(new Date(МОМЕНТ_РАСХОЖДЕНИЯ));
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-09-26');  // UTC говорит «26-е»
    const сегодня = localIsoDate();
    expect(сегодня).toBe('2026-09-27');                                // календарь — «27-е»
    expect(localIsoDateOffset(-1)).toBe('2026-09-26');
  });

  it('окно по анализам стоит на календарной границе (−30 внутри, −31 снаружи)', () => {
    if (смещениеВпередПоUTC <= 0) { console.log('[report-dates] TZ = 0 — проверка пропущена'); return; }
    vi.useFakeTimers();
    vi.setSystemTime(new Date(МОМЕНТ_РАСХОЖДЕНИЯ));
    const сегодня = localIsoDate();
    // Граничные записи: при локальном каноче окно 30 дней начинается с localIsoDateOffset(-30),
    // при UTC-версии — на сутки раньше (и -31-й день ПРОПАДАЕТ в неё). Без такой пары
    // лок был бы вакуумным: что бы ни считал движок, «минус 40 дней» отсекался обоими.
    const наГранице = localIsoDateOffset(-30);
    const заГраницей = localIsoDateOffset(-31);
    const diary = [запись(сегодня, 1), запись(наГранице), запись(заГраницей)];

    const ключи = getLabFrequency(diary, 30).map(f => f.date);
    expect(ключи).toContain(сегодня);
    expect(ключи).toContain(наГранице);   // ровно 30 дней назад — ещё в окне
    expect(ключи).not.toContain(заГраницей); // 31 день назад — уже вне окна

    const summary = getLabDiarySummary(diary, 30);
    expect(summary.find(s => s.date === сегодня)?.abnormal).toBe(1);
    expect(summary.some(s => s.date === заГраницей)).toBe(false);
  });
});
