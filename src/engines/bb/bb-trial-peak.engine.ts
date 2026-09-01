/**
 * bb-trial-peak.engine.ts — PRO trial peak (репетиция пика за 21-28 дней).
 *
 * Фаза 3.29: СЛИТО с канонической системой `TestPeakWeekResult` (bb-contest-prep.engine,
 * ключ `he_bb_test_peak_weeks`). Раньше существовали ДВЕ параллельные системы с разными
 * ключами (he_bb_trial_peaks_v2 здесь и he_bb_test_peak_weeks в prep-движке), но с
 * ИДЕНТИЧНОЙ логикой вердиктов. Теперь этот модуль — тонкий совместимый слой ПОВЕРХ
 * канона: единый сторадж, единые пороги (scoreTestPeakWeek), единый recommend.
 * `he_bb_trial_peaks_v2` остаётся только для чтения legacy-записей (миграция).
 */
import {
  type TestPeakWeekResult,
  TEST_PEAK_WEEK_STORAGE_KEY,
  saveTestPeakWeekResult,
  scoreTestPeakWeek,
  latestTestPeakWeek,
  recommendCarbStrategyFromTrial,
} from './bb-contest-prep.engine';

/** Legacy-ключ (только чтение, для миграции). */
const LEGACY_KEY = 'he_bb_trial_peaks_v2';

export interface TrialPeakEntry extends TestPeakWeekResult {
  carbStrategyUsed?: string;
  weightKg?: number;
  waistCm?: number;
  photos?: { front?: string; back?: string; side?: string };
  spillScore?: number;
}

function readLegacy(): TrialPeakEntry[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr as TrialPeakEntry[] : [];
  } catch { return []; }
}

function readCanonical(): TestPeakWeekResult[] {
  try {
    const raw = localStorage.getItem(TEST_PEAK_WEEK_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr as TestPeakWeekResult[] : [];
  } catch { return []; }
}

/** Все trial-записи (канон + legacy-миграция). */
export function getTrialPeaks(planId?: string): TrialPeakEntry[] {
  const canon = readCanonical() as TrialPeakEntry[];
  const legacy = readLegacy();
  const seen = new Set(canon.map(t => t.id));
  const all = [...canon, ...legacy.filter(l => !seen.has(l.id))];
  if (planId) return all.filter(e => e.planId === planId);
  return all;
}

/** Сохранить trial peak — ДЕЛЕГИРУЕТ в канонический saveTestPeakWeekResult (единый сторадж/пороги). */
export function saveTrialPeak(
  entry: Omit<TrialPeakEntry, 'id' | 'createdAt' | 'verdict' | 'recommendation'> & { weightDeltaKg: number },
): TrialPeakEntry {
  const result = saveTestPeakWeekResult(
    entry.planId,
    entry.showDate,
    entry.responses,
    entry.weightDeltaKg,
    entry.notes,
  );
  // Доп. поля trial (не входящие в канон) сохраняем как расширение канонной записи.
  try {
    const list = readCanonical();
    const idx = list.findIndex(t => t.id === result.id);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        carbStrategyUsed: entry.carbStrategyUsed,
        weightKg: entry.weightKg,
        waistCm: entry.waistCm,
        photos: entry.photos,
        spillScore: entry.spillScore,
      } as TestPeakWeekResult;
      localStorage.setItem(TEST_PEAK_WEEK_STORAGE_KEY, JSON.stringify(list.slice(0, 10)));
    }
  } catch { /* storage недоступен */ }
  return { ...result, carbStrategyUsed: entry.carbStrategyUsed, weightKg: entry.weightKg, waistCm: entry.waistCm, photos: entry.photos, spillScore: entry.spillScore };
}

/** Рекомендация карб-стратегии из trial — делегирует в канон recommendCarbStrategyFromTrial. */
export function recommendFromTrial(entry: TrialPeakEntry | null): string {
  return recommendCarbStrategyFromTrial(entry as TestPeakWeekResult | null);
}

/** FODMAP / low-residue листы для пика. */
export const PEAK_FOODS_ALLOW = ['рис белый','рисовые хлебцы','картофель','мёд','джем','банан 0.5','овсянка малая','курица','белая рыба','яйцо'];
export const PEAK_FOODS_DENY = ['бобовые','лук','чеснок','капуста','брокколи','газировка','жвачка','алкоголь','острое'];
export const PEAK_FIBER_CAP = { deplete:22, load:16, peak:12, show:10 };
