/**
 * bb-trial-peak.engine.ts — PRO trial peak (репетиция пика за 21-28 дней)
 * Хранит фото-front/back, вес, талию, spillScore, digestion. Даёт рекомендацию carb стратегии.
 * Чистый движок, без UI.
 */

export interface TrialPeakEntry {
  id: string;
  planId: string;
  date: string; // ISO yyyy-mm-dd of trial show
  createdAt: string;
  photos?: { front?: string; back?: string; side?: string }; // dataURL or path
  weightKg: number;
  waistCm?: number;
  carbStrategyUsed: string;
  responses: {
    carbTolerance: number; // 1-5
    digestion: number;
    fullness: number;
    waterRetention: number; // 1=заливает 5=сухо
    pump: number;
    sleep: number;
  };
  weightDeltaKg: number;
  spillScore?: number; // 1-5
  notes?: string;
  verdict: 'tested_ok' | 'conservative' | 'adjust';
  recommendation: string;
}

const KEY = 'he_bb_trial_peaks_v2';
const CAP = 3;

function loadAll(): TrialPeakEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveAll(list: TrialPeakEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, CAP))); } catch {}
}

export function getTrialPeaks(planId?: string): TrialPeakEntry[] {
  const all = loadAll();
  if (planId) return all.filter(e => e.planId === planId);
  return all;
}

export function saveTrialPeak(entry: Omit<TrialPeakEntry,'id'|'createdAt'|'verdict'|'recommendation'> & { weightDeltaKg:number }): TrialPeakEntry {
  const avg = (entry.responses.carbTolerance + entry.responses.digestion + entry.responses.fullness + entry.responses.pump)/4;
  let verdict: TrialPeakEntry['verdict'] = 'conservative';
  let recommendation = '';
  if (entry.responses.waterRetention >=4 && avg>=3.5 && Math.abs(entry.weightDeltaKg)<=1.5) {
    verdict='tested_ok'; recommendation='Протокол подходит — используйте ту же стратегию на основном пике (tested).';
  } else if (entry.responses.waterRetention<=2 || avg<=2 || entry.weightDeltaKg>2) {
    verdict='adjust'; recommendation='Коррекция нужна: spill/плоско — смените стратегию (back/front/undulating).';
  } else {
    verdict='conservative'; recommendation='Консервативный режим — moderate/linear, stable вода/натрий.';
  }
  const rec: TrialPeakEntry = {
    id: `trial_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`,
    createdAt: new Date().toISOString(),
    verdict, recommendation,
    spillScore: entry.responses.waterRetention <=2 ? 5 : entry.responses.waterRetention >=4 ? 1 : 3,
    ...entry,
  };
  const list = [rec, ...loadAll().filter(e => e.planId !== entry.planId || e.date !== entry.date)];
  saveAll(list);
  // also set hasTrialPeak flag in config storage helper
  try { localStorage.setItem('he_has_trial_peak', '1'); } catch {}
  return rec;
}

export function recommendFromTrial(entry: TrialPeakEntry | null): string {
  if (!entry) return 'moderate';
  if (entry.verdict==='adjust' && entry.responses.waterRetention<=2) return 'back';
  if (entry.responses.waterRetention>=4 && entry.responses.fullness<=2) return 'front';
  if (entry.responses.carbTolerance<=2) return 'undulating';
  return 'moderate';
}

/** FODMAP / low-residue листы для пика */
export const PEAK_FOODS_ALLOW = ['рис белый','рисовые хлебцы','картофель','мёд','джем','банан 0.5','овсянка малая','курица','белая рыба','яйцо'];
export const PEAK_FOODS_DENY = ['бобовые','лук','чеснок','капуста','брокколи','газировка','жвачка','алкоголь','острое'];
export const PEAK_FIBER_CAP = { deplete:22, load:16, peak:12, show:10 };
