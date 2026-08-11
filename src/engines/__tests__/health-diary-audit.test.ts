/**
 * health-diary-audit.test.ts — регрессионные тесты аудита дневника здоровья (Aug 11 2026).
 * Покрывают: P0-1 slice(-90), P0-2 тренды зон, P1-4 локальная дата, P1-5 label-маппинг, P1-7 миграция симптомов.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { analyzePainEntries, getTodayPainStatus } from '../pain-insights.engine';
import {
  computeZoneBreakdown,
  computeExtremes,
  detectAnomalies,
  type DiaryEntryLike,
} from '../../ui/screens/ProfileScreen_v2/diary-helpers';
import {
  addUnifiedHealthEntry,
  getUnifiedHealthEntries,
  getUnifiedPainStats,
  resetUnifiedHealthDiary,
  todayIso,
  type UnifiedHealthEntry,
} from '../health-diary.engine';

const isoDaysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** PainEntry-форма (плоская, как в pain-insights): zones/totalScore на корне */
const painRow = (date: string, zones: Record<string, number>, extra: Record<string, unknown> = {}) => ({
  date,
  zones,
  totalScore: Object.values(zones).reduce((a, b) => a + b, 0),
  ...extra,
});

/** UnifiedHealthEntry-форма (вложенный pain) для движка */
const uEntry = (
  date: string,
  pain?: { zones: Record<string, number>; totalScore: number },
  over: Partial<UnifiedHealthEntry> = {},
): UnifiedHealthEntry => ({
  id: `${date}_id`,
  date,
  pain: pain ? { ...pain } : null,
  symptoms: [],
  neuro: null,
  acne: null,
  hemato: null,
  createdAt: '',
  updatedAt: '',
  ...over,
});

describe('P0-1: analyzePainEntries берёт последние 90 записей', () => {
  it('при desc-входе анализирует НОВЕЙШИЕ 90, не старейшие', () => {
    const entries = Array.from({ length: 95 }, (_, i) => {
      const d = isoDaysAgo(94 - i);
      return painRow(d, { shoulders: 2 });
    });
    const result = analyzePainEntries(entries);
    expect(result.totalEntries).toBe(90);
    expect(result.lastEntryDate).toBe(isoDaysAgo(0));
  });

  it('lastEntryDate = самая свежая запись (не старейшая)', () => {
    const entries = [
      painRow(isoDaysAgo(10), { shoulders: 8 }),
      painRow(isoDaysAgo(1), { shoulders: 2 }),
    ];
    const result = analyzePainEntries(entries);
    expect(result.lastEntryDate).toBe(isoDaysAgo(1));
  });

  it('инсайт severity строится по свежим данным: зона ≥7 → alert', () => {
    const entries = [
      painRow(isoDaysAgo(5), { shoulders: 3 }),
      painRow(isoDaysAgo(0), { shoulders: 9 }),
    ];
    const insights = analyzePainEntries(entries).insights;
    expect(insights.some((i) => i.id === 'high-pain-severity' && i.severity === 'alert')).toBe(true);
  });
});

describe('P0-2: computeZoneBreakdown — last/trend на данных любого порядка', () => {
  it('last = свежайшее значение, trend up при росте', () => {
    const entries = [
      painRow(isoDaysAgo(5), { knees: 3 }),
      painRow(isoDaysAgo(2), { knees: 5 }),
      painRow(isoDaysAgo(0), { knees: 7 }),
    ];
    const stats = computeZoneBreakdown(entries);
    const knee = stats.find((z) => z.zoneId === 'knees')!;
    expect(knee.last).toBe(7);
    expect(knee.trend).toBe('up');
  });

  it('trend down при снижении', () => {
    const entries = [
      painRow(isoDaysAgo(3), { knees: 8 }),
      painRow(isoDaysAgo(0), { knees: 4 }),
    ];
    const stats = computeZoneBreakdown(entries);
    expect(stats.find((z) => z.zoneId === 'knees')!.last).toBe(4);
    expect(stats.find((z) => z.zoneId === 'knees')!.trend).toBe('down');
  });
});

describe('P0-2: getUnifiedPainStats — тренд зон от последних записей', () => {
  beforeEach(() => resetUnifiedHealthDiary());

  it('last = свежайшее значение, trend up', () => {
    addUnifiedHealthEntry(uEntry(isoDaysAgo(4), { zones: { shoulders: 2 }, totalScore: 2 }));
    addUnifiedHealthEntry(uEntry(isoDaysAgo(1), { zones: { shoulders: 6 }, totalScore: 6 }));
    const stats = getUnifiedPainStats(getUnifiedHealthEntries());
    expect(stats).not.toBeNull();
    const sh = stats!.zoneStats.find((z) => z.zoneId === 'shoulders')!;
    expect(sh.last).toBe(6);
    expect(sh.trend).toBe('up');
  });

  it('avg по всем записям с болью', () => {
    addUnifiedHealthEntry(uEntry(isoDaysAgo(3), { zones: { shoulders: 4 }, totalScore: 4 }));
    addUnifiedHealthEntry(uEntry(isoDaysAgo(1), { zones: { shoulders: 8 }, totalScore: 8 }));
    const stats = getUnifiedPainStats(getUnifiedHealthEntries());
    expect(stats!.avg).toBe(6);
    expect(stats!.max).toBe(8);
  });
});

describe('P1-4: getTodayPainStatus использует локальную дату', () => {
  it('находит запись за сегодня (локальная дата)', () => {
    const status = getTodayPainStatus([painRow(todayIso(), { shoulders: 8 })]);
    expect(status?.status).toBe('alert');
  });

  it('вчерашняя запись → null', () => {
    expect(getTodayPainStatus([painRow(isoDaysAgo(1), { shoulders: 8 })])).toBeNull();
  });
});

describe('P1-5: аномалии и экстремумы работают с label «Боль»/«Нейро»', () => {
  const fields: DiaryEntryLike['fields'] = [
    { label: 'Боль', value: '65', unit: '/70' },
    { label: 'Нейро', value: '7', unit: '/10' },
  ];

  it('обнаруживает критичную боль 65/70', () => {
    const issues = detectAnomalies('pain', [{ date: isoDaysAgo(0), fields }]);
    expect(issues.some((x) => x.severity === 'danger' && x.message.includes('65'))).toBe(true);
  });

  it('computeExtremes находит максимум по «Боль»', () => {
    const ex = computeExtremes('pain', [
      { date: isoDaysAgo(2), fields: [{ label: 'Боль', value: '10', unit: '/70' }] },
      { date: isoDaysAgo(0), fields },
    ]);
    expect(ex.max?.value).toBe(65);
  });

  it('нейро-аномалии через label «Нейро»', () => {
    const issues = detectAnomalies('neuro', [{ date: isoDaysAgo(0), fields }]);
    expect(issues.some((x) => x.severity === 'danger')).toBe(true);
  });

  it('legacy label «Суммарно» продолжает работать', () => {
    const issues = detectAnomalies('pain', [
      { date: isoDaysAgo(0), fields: [{ label: 'Суммарно', value: '62', unit: '/70' }] },
    ]);
    expect(issues.some((x) => x.severity === 'danger')).toBe(true);
  });
});

describe('P1-7: миграция he_symptom_diary → unified', () => {
  beforeEach(() => {
    resetUnifiedHealthDiary();
    localStorage.removeItem('he_symptom_diary');
  });

  it('симптомы переносятся со шкалой 0-10 → 1-5, resolved (0) пропускаются', () => {
    localStorage.setItem(
      'he_symptom_diary',
      JSON.stringify([
        { date: isoDaysAgo(3), entries: [{ symptomId: 'hypertension', severity: 8, trend: 'stable' }], overallScore: 8, symptomCount: 1 },
        { date: isoDaysAgo(1), entries: [{ symptomId: 'hypertension', severity: 0, trend: 'resolved' }], overallScore: 0, symptomCount: 0 },
      ]),
    );
    const entries = getUnifiedHealthEntries();
    expect(entries).toHaveLength(2);
    const older = entries.find((e) => e.date === isoDaysAgo(3))!;
    expect(older.symptoms).toHaveLength(1);
    expect(older.symptoms[0].severity).toBe(4);
    expect(older.symptoms[0].name.length).toBeGreaterThan(0);
    expect(entries.find((e) => e.date === isoDaysAgo(1))!.symptoms).toHaveLength(0);
  });

  it('мердж в существующий unified: без дублей и только один раз', () => {
    addUnifiedHealthEntry(uEntry(isoDaysAgo(1), null));
    localStorage.setItem(
      'he_symptom_diary',
      JSON.stringify([
        { date: isoDaysAgo(1), entries: [{ symptomId: 'hypertension', severity: 6, trend: 'stable' }], overallScore: 6, symptomCount: 1 },
      ]),
    );
    const first = getUnifiedHealthEntries();
    expect(first.find((e) => e.date === isoDaysAgo(1))!.symptoms).toHaveLength(1);
    const second = getUnifiedHealthEntries();
    expect(second.find((e) => e.date === isoDaysAgo(1))!.symptoms).toHaveLength(1);
    expect(second).toHaveLength(1);
  });
});

