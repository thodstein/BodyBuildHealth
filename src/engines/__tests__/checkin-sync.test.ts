/**
 * checkin-sync.test.ts — тесты синхронизации чек-ина с дневниками Профиля:
 * pullFromProfileDiaries (подтягивание веса/сна/пульса) и
 * pushToProfileDiaries (запись в he_weight_log / he_sleep_diary / he_bp_diary).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  pullFromProfileDiaries, pushToProfileDiaries, type DailyMetrics,
} from '../profile-settings.engine';

const SLEEP_KEY = 'he_sleep_diary';
const BP_KEY = 'he_bp_diary';
const WEIGHT_KEY = 'he_weight_log';

const baseMetric = (): DailyMetrics => ({
  date: '2026-08-13', sleepHours: 7, sleepQuality: 4, restingHR: 60, hrvMs: 45,
  weightKg: 80, waterLiters: 2, steps: 5000,
  subjectiveEnergy: 4, subjectiveSoreness: 2, subjectiveStress: 3, notes: '',
});

beforeEach(() => {
  localStorage.clear();
});

describe('pullFromProfileDiaries', () => {
  it('без записей в дневниках — возвращает метрику как есть', () => {
    const m = baseMetric();
    expect(pullFromProfileDiaries(m)).toEqual(m);
  });

  it('подтягивает вес из he_weight_log на ту же дату', () => {
    localStorage.setItem(WEIGHT_KEY, JSON.stringify([{ date: '2026-08-13', weight: 82.5 }]));
    const m = pullFromProfileDiaries(baseMetric());
    expect(m.weightKg).toBe(82.5);
  });

  it('подтягивает часы и качество сна из he_sleep_diary', () => {
    localStorage.setItem(SLEEP_KEY, JSON.stringify([{ date: '2026-08-13', hours: 6.5, quality: 2 }]));
    const m = pullFromProfileDiaries(baseMetric());
    expect(m.sleepHours).toBe(6.5);
    expect(m.sleepQuality).toBe(2);
  });

  it('подтягивает пульс покоя из he_bp_diary', () => {
    localStorage.setItem(BP_KEY, JSON.stringify([{ date: '2026-08-13', systolic: 120, diastolic: 80, pulse: 68 }]));
    const m = pullFromProfileDiaries(baseMetric());
    expect(m.restingHR).toBe(68);
  });

  it('запись на ДРУГУЮ дату не влияет на сегодня', () => {
    localStorage.setItem(WEIGHT_KEY, JSON.stringify([{ date: '2026-08-12', weight: 90 }]));
    localStorage.setItem(SLEEP_KEY, JSON.stringify([{ date: '2026-08-12', hours: 9 }]));
    const m = pullFromProfileDiaries(baseMetric());
    expect(m.weightKg).toBe(80);
    expect(m.sleepHours).toBe(7);
  });
});

describe('pushToProfileDiaries', () => {
  it('вес → he_weight_log (upsert по дате, без дублей)', async () => {
    localStorage.setItem(WEIGHT_KEY, JSON.stringify([{ date: '2026-08-12', weight: 81 }]));
    const out = await pushToProfileDiaries({ ...baseMetric(), weightKg: 82 });
    expect(out.weight).toBe(true);
    const log = JSON.parse(localStorage.getItem(WEIGHT_KEY) || '[]');
    expect(log).toHaveLength(2);
    const today = log.find((e: any) => e.date === '2026-08-13');
    expect(today.weight).toBe(82);
  });

  it('вес обновляет существующую запись за ту же дату', async () => {
    localStorage.setItem(WEIGHT_KEY, JSON.stringify([{ date: '2026-08-13', weight: 80, waistCm: 85 }]));
    await pushToProfileDiaries({ ...baseMetric(), weightKg: 79.4 });
    const log = JSON.parse(localStorage.getItem(WEIGHT_KEY) || '[]');
    expect(log).toHaveLength(1);
    expect(log[0].weight).toBe(79.4);
    expect(log[0].waistCm).toBe(85);
  });

  it('сон → he_sleep_diary, сохраняя существующие поля (пробуждения)', async () => {
    localStorage.setItem(SLEEP_KEY, JSON.stringify([{ date: '2026-08-13', hours: 6, quality: 3, awakenings: 2 }]));
    const out = await pushToProfileDiaries({ ...baseMetric(), sleepHours: 7.5, sleepQuality: 4 });
    expect(out.sleep).toBe(true);
    const diary = JSON.parse(localStorage.getItem(SLEEP_KEY) || '[]');
    expect(diary).toHaveLength(1);
    expect(diary[0].hours).toBe(7.5);
    expect(diary[0].quality).toBe(4);
    expect(diary[0].awakenings).toBe(2);
  });

  it('пульс → he_bp_diary без выдумывания АД', async () => {
    const out = await pushToProfileDiaries({ ...baseMetric(), restingHR: 55 });
    expect(out.bp).toBe(true);
    const bp = JSON.parse(localStorage.getItem(BP_KEY) || '[]');
    expect(bp).toHaveLength(1);
    expect(bp[0].pulse).toBe(55);
    expect(bp[0].systolic).toBeUndefined();
  });

  it('нулевые значения не пишутся (вес 0 / сон 0 / пульс 0)', async () => {
    const out = await pushToProfileDiaries({ ...baseMetric(), weightKg: 0, sleepHours: 0, restingHR: 0 });
    expect(out.weight).toBe(false);
    expect(out.sleep).toBe(false);
    expect(out.bp).toBe(false);
    expect(localStorage.getItem(WEIGHT_KEY)).toBeNull();
    expect(localStorage.getItem(SLEEP_KEY)).toBeNull();
    expect(localStorage.getItem(BP_KEY)).toBeNull();
  });

  it('пульс обновляет существующую запись АД за дату, не затирая АД', async () => {
    localStorage.setItem(BP_KEY, JSON.stringify([{ date: '2026-08-13', systolic: 130, diastolic: 85, pulse: 70 }]));
    await pushToProfileDiaries({ ...baseMetric(), restingHR: 62 });
    const bp = JSON.parse(localStorage.getItem(BP_KEY) || '[]');
    expect(bp).toHaveLength(1);
    expect(bp[0].pulse).toBe(62);
    expect(bp[0].systolic).toBe(130);
  });
});
