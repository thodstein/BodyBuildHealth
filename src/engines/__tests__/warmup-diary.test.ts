/**
 * Тесты дневника разминки (warmup.engine.ts): хранилище, приверженность,
 * тренд качества, инсайты, CSV, санитайзер.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  WARMUP_DIARY_KEY, WARMUP_DIARY_CAP, WARMUP_SKIP_REASONS, WARMUP_LABELS, warmupLabel,
  sanitizeWarmupLog, loadWarmupLog, upsertWarmupLog, latestWarmupLog,
  warmupAdherence, warmupQualityTrend, warmupLogForDate, buildWarmupInsights, exportWarmupCheckinsCSV,
  warmupStreak, correlateWarmupWithPerformance,
} from '../warmup.engine';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

describe('Хранилище дневника разминки', () => {
  beforeEach(() => localStorage.clear());

  it('upsertWarmupLog добавляет и заменяет запись по дате', () => {
    upsertWarmupLog({ date: daysAgo(1), done: true, quality: 4, totalItems: 5, doneItems: 5 });
    expect(loadWarmupLog().length).toBe(1);
    upsertWarmupLog({ date: daysAgo(1), done: false, quality: null, skippedReason: 'устал' });
    const list = loadWarmupLog();
    expect(list.length).toBe(1);
    expect(list[0].done).toBe(false);
    expect(list[0].skippedReason).toBe('устал');
    expect(latestWarmupLog()?.date).toBe(daysAgo(1));
  });

  it('разные даты — отдельные записи, лог ASC', () => {
    upsertWarmupLog({ date: daysAgo(2), done: true, quality: 3 });
    upsertWarmupLog({ date: daysAgo(1), done: true, quality: 5 });
    const list = loadWarmupLog();
    expect(list.map(e => e.date)).toEqual([daysAgo(2), daysAgo(1)]);
  });

  it('кап 365: новейшие остаются', () => {
    for (let i = 0; i < 370; i++) {
      upsertWarmupLog({ date: iso(new Date(2020, 0, 1 + i)), done: true, quality: 4 });
    }
    expect(loadWarmupLog().length).toBe(WARMUP_DIARY_CAP);
    expect(loadWarmupLog()[0].date).toBe(iso(new Date(2020, 0, 6)));
  });

  it('устойчив к битому JSON и мусору', () => {
    localStorage.setItem(WARMUP_DIARY_KEY, '{"broken":');
    expect(loadWarmupLog()).toEqual([]);
    localStorage.setItem(WARMUP_DIARY_KEY, JSON.stringify([
      { date: 'не дата', done: true },
      { date: '2026-01-01T10:00:00', done: true, quality: 9 },
      { date: '2026-01-02', done: true, quality: 3 },
    ]));
    const list = loadWarmupLog();
    expect(list.length).toBe(2);
    expect(list[0].quality).toBeNull();
  });

  it('sanitizeWarmupLog: невалидные даты/качества', () => {
    expect(sanitizeWarmupLog(null)).toBeNull();
    expect(sanitizeWarmupLog({ date: 'вчера', done: true })).toBeNull();
    expect(sanitizeWarmupLog({ date: '2026-01-01', done: true, quality: 7 })?.quality).toBeNull();
    expect(sanitizeWarmupLog({ date: '2026-01-01', done: true, quality: 4.6 })?.quality).toBe(5);
  });

  it('warmupLogForDate находит запись дня', () => {
    upsertWarmupLog({ date: daysAgo(1), done: true, quality: 4 });
    expect(warmupLogForDate(daysAgo(1))?.done).toBe(true);
    expect(warmupLogForDate(daysAgo(5))).toBeNull();
  });
});

describe('Аналитика', () => {
  beforeEach(() => localStorage.clear());

  it('warmupAdherence: доля выполненных за N дней', () => {
    upsertWarmupLog({ date: daysAgo(1), done: true, quality: 4 });
    upsertWarmupLog({ date: daysAgo(2), done: true, quality: 3 });
    upsertWarmupLog({ date: daysAgo(3), done: false, quality: null });
    const adh = warmupAdherence(30);
    expect(adh.done).toBe(2);
    expect(adh.total).toBe(3);
    expect(adh.pct).toBe(67);
  });

  it('warmupQualityTrend: среднее и серия только с оценками', () => {
    upsertWarmupLog({ date: daysAgo(1), done: true, quality: 5 });
    upsertWarmupLog({ date: daysAgo(2), done: true, quality: 3 });
    upsertWarmupLog({ date: daysAgo(3), done: false, quality: null });
    const q = warmupQualityTrend(30);
    expect(q.count).toBe(2);
    expect(q.avg).toBe(4);
    expect(q.series[0].date).toBe(daysAgo(2));
    expect(warmupQualityTrend(30).series.length).toBe(2);
  });

  it('buildWarmupInsights: приверженность и частая причина пропуска', () => {
    expect(buildWarmupInsights().some(s => s.includes('мало данных'))).toBe(true);
    upsertWarmupLog({ date: daysAgo(1), done: true, quality: 5 });
    upsertWarmupLog({ date: daysAgo(2), done: true, quality: 4 });
    upsertWarmupLog({ date: daysAgo(3), done: true, quality: 4 });
    const high = buildWarmupInsights();
    expect(high.some(s => s.includes('отличная'))).toBe(true);
    upsertWarmupLog({ date: daysAgo(4), done: false, quality: null, skippedReason: 'не было времени' });
    upsertWarmupLog({ date: daysAgo(5), done: false, quality: null, skippedReason: 'не было времени' });
    upsertWarmupLog({ date: daysAgo(6), done: false, quality: null, skippedReason: 'не было времени' });
    const skip = buildWarmupInsights();
    expect(skip.some(s => s.includes('не было времени'))).toBe(true);
  });
});

describe('Серия и связь с e1RM', () => {
  beforeEach(() => localStorage.clear());

  it('warmupStreak: пусто → 0', () => {
    expect(warmupStreak()).toBe(0);
  });

  it('warmupStreak: 3 дня подряд до сегодня → 3', () => {
    upsertWarmupLog({ date: daysAgo(0), done: true, quality: 4 });
    upsertWarmupLog({ date: daysAgo(1), done: true, quality: 4 });
    upsertWarmupLog({ date: daysAgo(2), done: true, quality: 4 });
    expect(warmupStreak()).toBe(3);
  });

  it('warmupStreak: сегодня не отмечено → серия со вчера', () => {
    upsertWarmupLog({ date: daysAgo(1), done: true, quality: 4 });
    upsertWarmupLog({ date: daysAgo(2), done: true, quality: 4 });
    expect(warmupStreak()).toBe(2);
  });

  it('warmupStreak: пропуск разрывает серию', () => {
    upsertWarmupLog({ date: daysAgo(0), done: true, quality: 4 });
    upsertWarmupLog({ date: daysAgo(1), done: false, quality: null });
    upsertWarmupLog({ date: daysAgo(2), done: true, quality: 4 });
    expect(warmupStreak()).toBe(1);
  });

  it('correlateWarmupWithPerformance: без сессий → n 0 и null', () => {
    upsertWarmupLog({ date: daysAgo(1), done: true, quality: 5 });
    const link = correlateWarmupWithPerformance([]);
    expect(link.n).toBe(0);
    expect(link.pearson).toBeNull();
  });

  it('correlateWarmupWithPerformance: качество растёт с e1RM → положительный r и корзины', () => {
    upsertWarmupLog({ date: '2026-01-01', done: true, quality: 2 });
    upsertWarmupLog({ date: '2026-01-02', done: true, quality: 3 });
    upsertWarmupLog({ date: '2026-01-03', done: true, quality: 5 });
    const sessions = [
      { date: '2026-01-01', e1rm: 100 },
      { date: '2026-01-02', e1rm: 110 },
      { date: '2026-01-03', e1rm: 130 },
    ];
    const link = correlateWarmupWithPerformance(sessions);
    expect(link.n).toBe(3);
    expect(link.pearson).not.toBeNull();
    expect(link.pearson as number).toBeGreaterThan(0);
    const high = link.buckets.find(b => b.level === 'high')!;
    expect(high.avgE1RM).toBe(130);
    const low = link.buckets.find(b => b.level === 'low')!;
    expect(low.avgE1RM).toBe(100);
  });

  it('buildWarmupInsights с сессиями: инсайт про связь при |r| ≥ 0.3', () => {
    upsertWarmupLog({ date: '2026-01-01', done: true, quality: 2 });
    upsertWarmupLog({ date: '2026-01-02', done: true, quality: 3 });
    upsertWarmupLog({ date: '2026-01-03', done: true, quality: 5 });
    const sessions = [
      { date: '2026-01-01', e1rm: 100 },
      { date: '2026-01-02', e1rm: 110 },
      { date: '2026-01-03', e1rm: 130 },
    ];
    const out = buildWarmupInsights(sessions);
    expect(out.some(s => s.includes('Связь качества разминки с e1RM'))).toBe(true);
  });
});

describe('Экспорт и словарь', () => {
  beforeEach(() => localStorage.clear());

  it('exportWarmupCheckinsCSV: шапка и строки', () => {
    upsertWarmupLog({ date: daysAgo(1), done: true, quality: 4, totalItems: 3, doneItems: 3 });
    const csv = exportWarmupCheckinsCSV();
    const lines = csv.split('\n');
    expect(lines[0]).toContain('date');
    expect(lines[0]).toContain('quality');
    expect(lines[1]).toContain(daysAgo(1));
    expect(lines[1]).toContain('1,4,3,3');
  });

  it('WARMUP_SKIP_REASONS и WARMUP_LABELS заполнены', () => {
    expect(WARMUP_SKIP_REASONS.length).toBeGreaterThanOrEqual(4);
    expect(WARMUP_LABELS['jumping_jack']).toBeTruthy();
    expect(warmupLabel('jumping_jack')).toContain('Джампинг');
    expect(warmupLabel('неизвестный_id')).toBe('неизвестный_id');
  });
});
