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
  bicepCm?: number;       // бицепс, см (среднее/общее)
  bicepLeftCm?: number;   // бицепс левый, см
  bicepRightCm?: number;  // бицепс правый, см
  thighCm?: number;       // бедро, см (среднее/общее)
  thighLeftCm?: number;   // бедро левое, см
  thighRightCm?: number;  // бедро правое, см
  calfCm?: number;        // икры, см (среднее/общее)
  calfLeftCm?: number;    // икра левая, см
  calfRightCm?: number;   // икра правая, см
  neckCm?: number;        // шея, см
  forearmCm?: number;     // предплечье, см
  muscleMass?: number;    // мышечная масса, кг
  waterMass?: number;     // вода, %
  notes?: string;         // заметка
  photos?: string[];      // base64/dataURL фото (макс 5, до 2Мб каждое)
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
      bicepLeftCm: e.bicepLeftCm !== undefined ? Number(e.bicepLeftCm) : undefined,
      bicepRightCm: e.bicepRightCm !== undefined ? Number(e.bicepRightCm) : undefined,
      thighCm: e.thighCm !== undefined ? Number(e.thighCm) : undefined,
      thighLeftCm: e.thighLeftCm !== undefined ? Number(e.thighLeftCm) : undefined,
      thighRightCm: e.thighRightCm !== undefined ? Number(e.thighRightCm) : undefined,
      calfCm: e.calfCm !== undefined ? Number(e.calfCm) : undefined,
      calfLeftCm: e.calfLeftCm !== undefined ? Number(e.calfLeftCm) : undefined,
      calfRightCm: e.calfRightCm !== undefined ? Number(e.calfRightCm) : undefined,
      neckCm: e.neckCm !== undefined ? Number(e.neckCm) : undefined,
      forearmCm: e.forearmCm !== undefined ? Number(e.forearmCm) : undefined,
      muscleMass: e.muscleMass !== undefined ? Number(e.muscleMass) : undefined,
      waterMass: e.waterMass !== undefined ? Number(e.waterMass) : undefined,
      notes: e.notes ? String(e.notes) : undefined,
      photos: Array.isArray(e.photos) ? e.photos.filter((p: any) => typeof p === 'string') : undefined,
    })) : [];
  } catch { return []; }
}
export function saveWeightLog(log: WeightEntry[]) {
  const trimmed = log.slice(-365);
  const totalPhotos = trimmed.reduce((sum, e) => sum + (e.photos?.length || 0), 0);
  const estimatedSize = new Blob([JSON.stringify(trimmed)]).size;
  if (estimatedSize > 4 * 1024 * 1024) {
    console.warn(`[profile-store] weight log size ${(estimatedSize / 1024 / 1024).toFixed(1)}MB — consider removing old photos`);
  }
  localStorage.setItem(KEYS.weight, JSON.stringify(trimmed));
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

