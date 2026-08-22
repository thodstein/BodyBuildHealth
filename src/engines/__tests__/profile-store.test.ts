/**
 * profile-store.test.ts — тесты канонического хранилища веса/замеров.
 * getWeightLog/saveWeightLog/архив/миграция/нормализация.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWeightLog,
  saveWeightLog,
  getWeightLogArchived,
  migrateWeightLogLegacy,
  getMeasurementsLog,
  saveMeasurementsLog,
  WEIGHT_LOG_KEY,
  type WeightEntry,
} from '../profile-store';
import { memoryStore } from '../weight-photo-store';

const KEY = WEIGHT_LOG_KEY;
const ARCHIVE = 'he_weight_log_archive';
const MIGRATED = 'he_weight_log_migrated_v1';

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

beforeEach(() => {
  localStorage.clear();
  memoryStore.clear();
});

describe('getWeightLog — нормализация и фильтр', () => {
  it('читает записи и приводит числа', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { date: '2026-01-01', weight: '82.5', bodyFat: '14', waistCm: '80' },
        { date: '2026-01-02', weight: 83 },
      ]),
    );
    const log = getWeightLog();
    expect(log).toHaveLength(2);
    expect(log[0].weight).toBe(82.5);
    expect(log[0].bodyFat).toBe(14);
    expect(log[0].waistCm).toBe(80);
  });

  it('отбрасывает записи с невалидным/NaN весом', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { date: '2026-01-01', weight: 'abc' },
        { date: '2026-01-02', weight: 0 },
        { date: '2026-01-03', weight: -5 },
        { date: '2026-01-04', weight: 82 },
      ]),
    );
    const log = getWeightLog();
    expect(log).toHaveLength(1);
    expect(log[0].date).toBe('2026-01-04');
  });

  it('отбрасывает записи без даты и битые JSON', () => {
    localStorage.setItem(KEY, JSON.stringify([{ weight: 82 }, null, 'x']));
    expect(getWeightLog()).toHaveLength(0);
    localStorage.setItem(KEY, '{broken');
    expect(getWeightLog()).toEqual([]);
  });

  it('сохраняет только валидные timeOfDay', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { date: '2026-01-01', weight: 82, timeOfDay: 'morning' },
        { date: '2026-01-02', weight: 83, timeOfDay: 'midday' },
      ]),
    );
    const log = getWeightLog();
    expect(log.find((e) => e.date === '2026-01-01')?.timeOfDay).toBe('morning');
    expect(log.find((e) => e.date === '2026-01-02')?.timeOfDay).toBeUndefined();
  });
});

describe('saveWeightLog — дедуп, сортировка, архив', () => {
  it('дедуплицирует по дате (побеждает последняя запись)', async () => {
    await saveWeightLog([
      { date: '2026-01-01', weight: 82 },
      { date: '2026-01-01', weight: 82.4 },
      { date: '2026-01-02', weight: 83 },
    ]);
    const log = getWeightLog();
    expect(log).toHaveLength(2);
    expect(log.find((e) => e.date === '2026-01-01')?.weight).toBe(82.4);
  });

  it('отбрасывает записи без даты и с NaN-весом при сохранении', async () => {
    await saveWeightLog([
      { date: '2026-01-01', weight: 82 },
      { date: '', weight: 90 },
      { date: '2026-01-02', weight: NaN },
      (null as unknown) as WeightEntry,
    ]);
    const log = getWeightLog();
    expect(log).toHaveLength(1);
    expect(log[0].date).toBe('2026-01-01');
  });

  it('при >365 записях в архив уходят СТАРЫЕ, в логе остаются свежие (входной порядок не важен)', async () => {
    const entries: WeightEntry[] = [];
    for (let i = 0; i < 370; i++) entries.push({ date: daysAgo(i), weight: 80 + i * 0.01 });
    const desc = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    await saveWeightLog(desc);
    const log = getWeightLog();
    const archive = getWeightLogArchived();
    expect(log).toHaveLength(365);
    expect(archive).toHaveLength(5);
    expect(log.every((e) => e.date >= daysAgo(364))).toBe(true);
    expect(archive.every((e) => e.date < daysAgo(364))).toBe(true);
    expect(new Set([...log, ...archive].map((e) => e.date)).size).toBe(370);
  });

  it('не создаёт архив при <=365 записях', async () => {
    const entries: WeightEntry[] = [];
    for (let i = 0; i < 365; i++) entries.push({ date: daysAgo(i), weight: 80 });
    await saveWeightLog(entries);
    expect(getWeightLogArchived()).toEqual([]);
    expect(getWeightLog()).toHaveLength(365);
  });

  it('мержит новые вытесненные записи в существующий архив без дублей', async () => {
    localStorage.setItem(
      ARCHIVE,
      JSON.stringify([
        { date: daysAgo(400), weight: 75, bodyFat: 15 },
        { date: daysAgo(401), weight: 74.9 },
      ]),
    );
    const entries: WeightEntry[] = [];
    for (let i = 0; i < 366; i++) entries.push({ date: daysAgo(i), weight: 80 });
    await saveWeightLog(entries);
    const archive = getWeightLogArchived();
    const dates = new Set(archive.map((e) => e.date));
    expect(dates.has(daysAgo(400))).toBe(true);
    expect(dates.has(daysAgo(401))).toBe(true);
    expect(dates.size).toBe(archive.length);
  });
});

describe('getWeightLogArchived — нормализация', () => {
  it('приводит числа и отбрасывает мусор', () => {
    localStorage.setItem(
      ARCHIVE,
      JSON.stringify([
        { date: '2025-01-01', weight: '75', waistCm: '80' },
        { date: '2025-01-02', weight: 'broken' },
        { weight: 90 },
      ]),
    );
    const archive = getWeightLogArchived();
    expect(archive).toHaveLength(1);
    expect(archive[0].weight).toBe(75);
    expect(archive[0].waistCm).toBe(80);
  });
});

describe('migrateWeightLogLegacy — слияние без потерь', () => {
  it('legacy-запись без веса не затирает канонический вес/замеры, но дополняет пустые поля', async () => {
    localStorage.setItem(KEY, JSON.stringify([{ date: '2026-01-01', weight: 82, waistCm: 79 }]));
    localStorage.setItem('he_measurements', JSON.stringify([{ date: '2026-01-01', weightKg: 0, waistCm: 85, chestCm: 102 }]));
    await migrateWeightLogLegacy();
    const log = getWeightLog();
    expect(log).toHaveLength(1);
    expect(log[0].weight).toBe(82);
    expect(log[0].waistCm).toBe(79);
    expect(log[0].chestCm).toBe(102);
  });

  it('маппит плечи и предплечья L/R из he_measurements', async () => {
    localStorage.setItem(
      'he_measurements',
      JSON.stringify([
        {
          date: '2026-01-10',
          weightKg: 85,
          shoulderCm: 122,
          armLeftCm: 38,
          armRightCm: 38.5,
          forearmLeftCm: 30,
          forearmRightCm: 30.5,
        },
      ]),
    );
    await migrateWeightLogLegacy();
    const log = getWeightLog();
    expect(log[0].shoulderCm).toBe(122);
    expect(log[0].forearmLeftCm).toBe(30);
    expect(log[0].forearmRightCm).toBe(30.5);
  });

  it('сливает все 4 legacy-хранилища по датам и удаляет мигрированные ключи', async () => {
    localStorage.setItem('he_measurements', JSON.stringify([{ date: '2026-01-01', weightKg: 81, waistCm: 80 }]));
    localStorage.setItem(
      'he_body_comp',
      JSON.stringify([{ date: '2026-01-02', weightKg: 82, bodyFatPercent: 15, measurements: { chestCm: 100, armCm: 37 } }]),
    );
    localStorage.setItem('he_weight_log_entries', JSON.stringify([{ date: '2026-01-03', weight: 83 }]));
    localStorage.setItem(
      'he_nutrition_v2',
      JSON.stringify({ weightHistory: [{ date: '2026-01-04', kg: 84 }] }),
    );
    await migrateWeightLogLegacy();
    const log = getWeightLog();
    expect(log).toHaveLength(4);
    expect(log.find((e) => e.date === '2026-01-02')?.bodyFat).toBe(15);
    expect(log.find((e) => e.date === '2026-01-02')?.chestCm).toBe(100);
    expect(localStorage.getItem('he_measurements')).toBeNull();
    expect(localStorage.getItem('he_body_comp')).toBeNull();
    expect(localStorage.getItem(MIGRATED)).toBe('1');
  });

  it('идемпотентен — второй запуск ничего не меняет', async () => {
    localStorage.setItem(KEY, JSON.stringify([{ date: '2026-01-01', weight: 82 }]));
    await migrateWeightLogLegacy();
    const first = JSON.stringify(getWeightLog());
    localStorage.setItem('he_measurements', JSON.stringify([{ date: '2026-01-02', weightKg: 83 }]));
    await migrateWeightLogLegacy(); // флаг уже стоит
    expect(JSON.stringify(getWeightLog())).toBe(first);
  });

  it('каноническая запись имеет приоритет над legacy на той же дате', async () => {
    localStorage.setItem(KEY, JSON.stringify([{ date: '2026-01-01', weight: 90 }]));
    localStorage.setItem('he_measurements', JSON.stringify([{ date: '2026-01-01', weightKg: 81 }]));
    await migrateWeightLogLegacy();
    expect(getWeightLog()[0].weight).toBe(90);
  });
});

describe('deprecated-обёртки measurements', () => {
  it('getMeasurementsLog извлекает замеры из лога (включая плечи)', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { date: '2026-01-01', weight: 82, waistCm: 80, shoulderCm: 120 },
        { date: '2026-01-02', weight: 83 },
      ]),
    );
    const ms = getMeasurementsLog();
    expect(ms).toHaveLength(1);
    expect(ms[0].waistCm).toBe(80);
    expect(ms[0].shoulderCm).toBe(120);
  });

  it('saveMeasurementsLog мержит в существующие записи', async () => {
    localStorage.setItem(KEY, JSON.stringify([{ date: '2026-01-01', weight: 82, waistCm: 80 }]));
    await saveMeasurementsLog([
      { date: '2026-01-01', waistCm: 79, chestCm: 100, hipCm: 0, bicepCm: 0, thighCm: 0, neckCm: 0, forearmCm: 0, bodyFat: 0 },
    ]);
    const log = getWeightLog();
    expect(log[0].weight).toBe(82);
    expect(log[0].waistCm).toBe(79);
    expect(log[0].chestCm).toBe(100);
  });
});
