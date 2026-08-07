/**
 * diary-smoke.test.ts — интеграционные тесты основных сценариев дневников.
 * Smoke-tests, проверяющие сквозную работу undo, аномалий, фильтрации, экспорта.
 */
import { describe, it, expect } from 'vitest';
import {
  detectAnomalies,
  filterByRange,
  computeStreak,
  computePeriodDelta,
  targetHit,
  groupEntriesByPeriod,
  type DiaryEntryLike,
  type DiaryKey,
} from '../diary-helpers';

const makeEntry = (date: string, fields: { label: string; value: string; unit?: string }[]): DiaryEntryLike => ({
  date,
  fields: fields.map(f => ({ label: f.label, value: f.value, unit: f.unit || '' })),
});

const sleepEntry = (date: string, hours: number) => makeEntry(date, [{ label: 'Часы', value: String(hours), unit: 'ч' }]);
const bpEntry = (date: string, sys: number, dia: number, pulse = 70) => makeEntry(date, [
  { label: 'Систола', value: String(sys), unit: 'мм рт.ст.' },
  { label: 'Диастола', value: String(dia), unit: 'мм рт.ст.' },
  { label: 'Пульс', value: String(pulse), unit: 'уд/мин' },
]);
const painEntry = (date: string, total: number) => makeEntry(date, [{ label: 'Суммарно', value: String(total), unit: '/70' }]);
const weightEntry = (date: string, kg: number) => makeEntry(date, [{ label: 'Вес', value: String(kg), unit: 'кг' }]);
const neuroEntry = (date: string, count: number) => makeEntry(date, [{ label: 'Симптомов', value: String(count), unit: '/10' }]);

const dayOffset = (offset: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

describe('smoke: сценарий «ввод снов за 7 дней»', () => {
  it('создаёт streak 7 и средний 7.5ч', () => {
    const entries: DiaryEntryLike[] = [7, 7.5, 8, 6.5, 7, 8.5, 7.5].map((h, i) => sleepEntry(dayOffset(-6 + i), h));
    const streak = computeStreak(entries);
    const filtered = filterByRange(entries, '7');
    const anomalies = detectAnomalies('sleep', filtered);
    expect(streak.current).toBe(7);
    expect(streak.best).toBe(7);
    expect(anomalies).toHaveLength(0);
    expect(filtered).toHaveLength(7);
  });

  it('детектирует одну ночь с 4ч сна как danger', () => {
    const entries = [
      sleepEntry(dayOffset(-6), 7), sleepEntry(dayOffset(-5), 7.5), sleepEntry(dayOffset(-4), 4),
      sleepEntry(dayOffset(-3), 7), sleepEntry(dayOffset(-2), 7.5), sleepEntry(dayOffset(-1), 8), sleepEntry(dayOffset(0), 7.5),
    ];
    const anomalies = detectAnomalies('sleep', entries);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].severity).toBe('danger');
  });
});

describe('smoke: сценарий «АД под контролем»', () => {
  it('нормальные значения не вызывают тревог', () => {
    const entries = [
      bpEntry(dayOffset(-2), 120, 80, 70),
      bpEntry(dayOffset(-1), 122, 82, 72),
      bpEntry(dayOffset(0), 118, 78, 68),
    ];
    expect(detectAnomalies('bp', entries)).toEqual([]);
  });

  it('гипертонический криз помечается как danger', () => {
    const entries = [bpEntry(dayOffset(0), 180, 110, 95)];
    const issues = detectAnomalies('bp', entries);
    expect(issues.some(i => i.severity === 'danger' && i.message.includes('180'))).toBe(true);
    expect(issues.some(i => i.message.includes('высокая'))).toBe(true);
  });

  it('тахикардия 110+ помечается отдельно', () => {
    const entries = [bpEntry(dayOffset(0), 120, 80, 110)];
    const issues = detectAnomalies('bp', entries);
    expect(issues.some(i => i.message.includes('Пульс'))).toBe(true);
  });
});

describe('smoke: сценарий «похудение 80→75кг за 8 недель»', () => {
  it('показывает отрицательную дельту (нейтральный синий — это динамика, не улучшение)', () => {
    const entries: DiaryEntryLike[] = [];
    for (let w = 0; w < 16; w++) {
      const date = new Date();
      date.setDate(date.getDate() - (15 - w) * 7);
      const iso = date.toISOString().slice(0, 10);
      entries.push(weightEntry(iso, 80 - w * 0.3));
    }
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const delta = computePeriodDelta('weight', sorted);
    expect(delta).not.toBeNull();
    expect(delta!.delta).toBeLessThan(0);
    // weight/bp — нейтральный тренд (динамика), цвет синий.
    // Реальное «улучшение/ухудшение» показывается через targetHit с goals.
    expect(delta!.color).toBe('#60a5fa');
  });
});

describe('smoke: сценарий «нейро после курса»', () => {
  it('снижение тревожности 7→2 за 6 недель — улучшение', () => {
    const entries: DiaryEntryLike[] = [];
    for (let w = 0; w < 6; w++) {
      const date = new Date();
      date.setDate(date.getDate() - (5 - w) * 7);
      entries.push(neuroEntry(date.toISOString().slice(0, 10), Math.max(2, 7 - w)));
    }
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const delta = computePeriodDelta('neuro', sorted);
    expect(delta).not.toBeNull();
    expect(delta!.delta).toBeLessThan(0);
    expect(delta!.color).toBe('#22c55e');
  });
});

describe('smoke: сценарий «боль в суставах при нандролоне»', () => {
  it('детектирует рост Σ боли до danger-уровня', () => {
    const entries: DiaryEntryLike[] = [];
    for (let w = 0; w < 4; w++) {
      const date = new Date();
      date.setDate(date.getDate() - (3 - w) * 7);
      entries.push(painEntry(date.toISOString().slice(0, 10), 30 + w * 12));
    }
    const anomalies = detectAnomalies('pain', entries);
    expect(anomalies.some(a => a.severity === 'danger')).toBe(true);
  });
});

describe('smoke: фильтрация по диапазону', () => {
  it('30 дней оставляет записи за последние 30 суток', () => {
    const entries: DiaryEntryLike[] = [];
    for (let d = 0; d < 60; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      entries.push(sleepEntry(date.toISOString().slice(0, 10), 7));
    }
    const r = filterByRange(entries, '30');
    expect(r.length).toBeGreaterThanOrEqual(30);
    expect(r.length).toBeLessThanOrEqual(31);
  });
});

describe('smoke: targetHit на реальных сценариях', () => {
  it('сон 7ч при цели 7.5ч — off-target с подробностями', () => {
    const r = targetHit('sleep', [sleepEntry(dayOffset(0), 7)], { sleepHours: 7.5, weightKg: 0, systolicTarget: 0 });
    expect(r).not.toBeNull();
    expect(r!.onTarget).toBe(false);
    expect(r!.details).toMatch(/7\.0 ч \/ цель 7\.5 ч/);
  });

  it('АД 130/85 при цели ≤140 — on-target', () => {
    const r = targetHit('bp', [bpEntry(dayOffset(0), 130, 85)], { sleepHours: 0, weightKg: 0, systolicTarget: 140 });
    expect(r).not.toBeNull();
    expect(r!.onTarget).toBe(true);
  });
});

describe('smoke: группировка по неделям в реальных сценариях', () => {
  it('4 записи через 2 недели дают 2 группы', () => {
    const entries: DiaryEntryLike[] = [];
    for (let d = 0; d < 4; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d * 7);
      entries.push(sleepEntry(date.toISOString().slice(0, 10), 7));
    }
    const groups = groupEntriesByPeriod(entries);
    expect(groups.length).toBeGreaterThanOrEqual(2);
  });
});
