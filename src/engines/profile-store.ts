/**
 * profile-store.ts — синхронизация профиля с дочерними модулями.
 * ПОСЛЕ миграции на UnifiedSettings: все sync-функции пишут ТОЛЬКО в общее хранилище.
 * Diary-данные (вес, замеры, давление) остаются в отдельных localStorage.
 */
import { getProfile, updateProfile } from '../core/profile-manager';
import type { UserProfile, UnifiedSettings, InjuryRecord } from '../core/types';

/* ── localStorage keys (diary only) ── */
const KEYS = {
  weight: 'he_weight_log',
  measurements: 'he_measurements_log',
  bp: 'he_bp_diary',
  nutrition: 'he_nutrition_profile',
} as const;

/* ── Weight / Measurement helpers (diary, not profile) ── */
export interface WeightEntry { date: string; weight: number; }
export function getWeightLog(): WeightEntry[] {
  try { return JSON.parse(localStorage.getItem(KEYS.weight) || '[]'); } catch { return []; }
}
export function saveWeightLog(log: WeightEntry[]) {
  localStorage.setItem(KEYS.weight, JSON.stringify(log.slice(-90)));
}

export interface MeasurementEntry {
  date: string; waistCm: number; chestCm: number; hipCm: number;
  bicepCm: number; thighCm: number; neckCm: number; forearmCm: number; bodyFat: number;
}
export function getMeasurementsLog(): MeasurementEntry[] {
  try { return JSON.parse(localStorage.getItem(KEYS.measurements) || '[]'); } catch { return []; }
}
export function saveMeasurementsLog(log: MeasurementEntry[]) {
  localStorage.setItem(KEYS.measurements, JSON.stringify(log.slice(-30)));
}

/* ── Единая синхронизация: все модули читают из одного Profile.settings ── */
export function syncAllProfiles(settings: UserProfile['settings'] | UnifiedSettings): void {
  // После миграции все модули читают напрямую из profile.settings — ничего не дублируем.
  // Старые вызовы persistSettings / saveLocal отключены.
  // Актуально только для обратной совместимости с ProfileScreen.save().
  try {
    const s = settings as UnifiedSettings;
    // Сохраняем weight-лог если изменился вес
    if (s.personal?.weight) {
      const log = getWeightLog();
      const today = new Date().toISOString().split('T')[0];
      if (!log.some(e => e.date === today)) {
        saveWeightLog([...log, { date: today, weight: s.personal.weight }].slice(-90));
      }
    }
  } catch { /* silent */ }
}

/* ── READYNESS CALC (из UnifiedSettings) ── */
export function calcReadinessFromSettings(settings: UnifiedSettings) {
  const { calcReadiness } = require('../engines/readiness.engine');
  const ls = settings.lifestyle;
  const tr = settings.training;
  return calcReadiness({
    sleepHours: ls?.sleepHours ?? 7,
    sleepQuality: ls?.sleepQuality === 'good' ? 8 : ls?.sleepQuality === 'fair' ? 5 : 3,
    nightAwakenings: ls?.nightAwakenings ?? 1,
    hrvRatio: ls?.baselineHrvRatio ?? 1.0,
    doms: tr?.doms ?? 2,
    stress: ls?.stressLevel ?? 3,
    calRatio: settings.system?.nutritionFactor ?? 0.8, proteinRatio: 0.8,
    waterRatio: 0.7, fiberRatio: 0.6, omega3Flag: false,
    trainingLoadRatio: settings.system?.trainingFactor ?? 0.6,
    subjFatigue: ls?.fatigueLevel ?? 3, hrIncrease: 0.1,
    chronotype: ls?.chronotype, bedtime: ls?.bedtime, wakeTime: ls?.wakeTime,
  });
}
