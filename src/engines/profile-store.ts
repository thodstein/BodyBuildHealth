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
  // measurements: 'he_measurements_log', // DEPRECATED: merged into weight log
  bp: 'he_bp_diary',
  nutrition: 'he_nutrition_profile',
} as const;

/* ── Weight / Measurement helpers (diary, not profile) ── */
export interface WeightEntry {
  date: string;
  weight: number;
  bodyFat?: number;       // % жира
  waistCm?: number;       // талия, см
  chestCm?: number;       // грудь, см
  hipCm?: number;         // бедра, см
  bicepCm?: number;       // бицепс, см
  thighCm?: number;       // бедро, см
  neckCm?: number;        // шея, см
  forearmCm?: number;     // предплечье, см
  muscleMass?: number;    // мышечная масса, кг
  waterMass?: number;     // вода, %
  notes?: string;         // заметка
}
export function getWeightLog(): WeightEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.weight) || '[]');
    return Array.isArray(raw) ? raw.map((e: any) => ({
      date: e.date,
      weight: Number(e.weight),
      bodyFat: e.bodyFat !== undefined ? Number(e.bodyFat) : undefined,
      waistCm: e.waistCm !== undefined ? Number(e.waistCm) : undefined,
      chestCm: e.chestCm !== undefined ? Number(e.chestCm) : undefined,
      hipCm: e.hipCm !== undefined ? Number(e.hipCm) : undefined,
      bicepCm: e.bicepCm !== undefined ? Number(e.bicepCm) : undefined,
      thighCm: e.thighCm !== undefined ? Number(e.thighCm) : undefined,
      neckCm: e.neckCm !== undefined ? Number(e.neckCm) : undefined,
      forearmCm: e.forearmCm !== undefined ? Number(e.forearmCm) : undefined,
      muscleMass: e.muscleMass !== undefined ? Number(e.muscleMass) : undefined,
      waterMass: e.waterMass !== undefined ? Number(e.waterMass) : undefined,
      notes: e.notes ? String(e.notes) : undefined,
    })) : [];
  } catch { return []; }
}
export function saveWeightLog(log: WeightEntry[]) {
  localStorage.setItem(KEYS.weight, JSON.stringify(log.slice(-365)));
}

/* ── DEPRECATED: measurements log merged into weight log ── */
export interface MeasurementEntry {
  date: string; waistCm: number; chestCm: number; hipCm: number;
  bicepCm: number; thighCm: number; neckCm: number; forearmCm: number; bodyFat: number;
}
/** @deprecated Use getWeightLog() instead. Returns measurements extracted from weight log. */
export function getMeasurementsLog(): MeasurementEntry[] {
  const weightLog = getWeightLog();
  return weightLog
    .filter(e => e.waistCm !== undefined || e.chestCm !== undefined || e.hipCm !== undefined ||
                 e.bicepCm !== undefined || e.thighCm !== undefined || e.neckCm !== undefined ||
                 e.forearmCm !== undefined || e.bodyFat !== undefined)
    .map(e => ({
      date: e.date,
      waistCm: e.waistCm || 0,
      chestCm: e.chestCm || 0,
      hipCm: e.hipCm || 0,
      bicepCm: e.bicepCm || 0,
      thighCm: e.thighCm || 0,
      neckCm: e.neckCm || 0,
      forearmCm: e.forearmCm || 0,
      bodyFat: e.bodyFat || 0,
    }));
}
/** @deprecated Use saveWeightLog() instead. Merges measurements into weight log. */
export function saveMeasurementsLog(log: MeasurementEntry[]) {
  const weightLog = getWeightLog();
  const merged = [...weightLog];
  for (const m of log) {
    const idx = merged.findIndex(e => e.date === m.date);
    const measurementData = {
      waistCm: m.waistCm || undefined,
      chestCm: m.chestCm || undefined,
      hipCm: m.hipCm || undefined,
      bicepCm: m.bicepCm || undefined,
      thighCm: m.thighCm || undefined,
      neckCm: m.neckCm || undefined,
      forearmCm: m.forearmCm || undefined,
      bodyFat: m.bodyFat || undefined,
    };
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...measurementData };
    } else {
      merged.push({ date: m.date, weight: 0, ...measurementData });
    }
  }
  saveWeightLog(merged);
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
