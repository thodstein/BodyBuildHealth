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
  weightArchive: 'he_weight_log_archive',
  weightMigrated: 'he_weight_log_migrated_v1',
  // measurements: 'he_measurements_log', // DEPRECATED: merged into weight log
  bp: 'he_bp_diary',
  nutrition: 'he_nutrition_profile',
} as const;

export const WEIGHT_LOG_KEY = KEYS.weight;

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
  photos?: string[];      // base64/dataURL фото
  timeOfDay?: 'morning' | 'evening'; // время суток замера (макс 5, до 2Мб каждое)
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
      timeOfDay: e.timeOfDay === 'morning' || e.timeOfDay === 'evening' ? e.timeOfDay : undefined,
    })) : [];
  } catch { return []; }
}
export function saveWeightLog(log: WeightEntry[]) {
  const trimmed = log.slice(-365);
  if (trimmed.length < log.length) {
    const overflow = log.slice(0, log.length - 365);
    try {
      const archive = getWeightLogArchived();
      const byDate = new Map<string, WeightEntry>();
      for (const e of [...archive, ...overflow]) if (e && e.date) byDate.set(e.date, e);
      localStorage.setItem(KEYS.weightArchive, JSON.stringify([...byDate.values()]));
    } catch { /* quota — silent */ }
  }
  const totalPhotos = trimmed.reduce((sum, e) => sum + (e.photos?.length || 0), 0);
  const estimatedSize = new Blob([JSON.stringify(trimmed)]).size;
  if (estimatedSize > 4 * 1024 * 1024) {
    console.warn(`[profile-store] weight log size ${(estimatedSize / 1024 / 1024).toFixed(1)}MB — consider removing old photos`);
  }
  localStorage.setItem(KEYS.weight, JSON.stringify(trimmed));
}

/** Записи старше 365 дней, вынесенные из основного лога (без фото-раздувания). */
export function getWeightLogArchived(): WeightEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.weightArchive) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

/* ── Однократная миграция legacy-дублей веса/замеров в канонический лог ── */

/**
 * Сливает legacy-хранилища (he_measurements, he_body_comp, he_weight_log_entries,
 * he_measurements_log, he_nutrition_v2.weightHistory) в канонический he_weight_log.
 * Выполняется один раз (флаг he_weight_log_migrated_v1), приоритет — уже
 * существующие канонические записи. Чистые функции без React.
 */
export function migrateWeightLogLegacy(): void {
  try {
    if (localStorage.getItem(KEYS.weightMigrated)) return;
    const log = getWeightLog();
    const byDate = new Map<string, Partial<WeightEntry>>();
    for (const e of log) if (e && e.date) byDate.set(e.date, { ...e });

    const merge = (date: string, patch: Partial<WeightEntry>) => {
      if (!date) return;
      const existing = byDate.get(date) || {};
      byDate.set(date, { ...existing, ...patch, date });
    };

    // 1) he_measurements (BodyMeasurement: weightKg, bodyFatPercent, neckCm...)
    try {
      const raw = JSON.parse(localStorage.getItem('he_measurements') || '[]');
      if (Array.isArray(raw)) {
        for (const m of raw) {
          if (!m || !m.date) continue;
          const hasData = m.weightKg > 0 || m.bodyFatPercent > 0 || m.waistCm > 0 || m.chestCm > 0;
          if (!hasData) continue;
          merge(m.date, {
            weight: Number(m.weightKg) > 0 ? Number(m.weightKg) : undefined,
            bodyFat: Number(m.bodyFatPercent) > 0 ? Number(m.bodyFatPercent) : undefined,
            neckCm: Number(m.neckCm) > 0 ? Number(m.neckCm) : undefined,
            chestCm: Number(m.chestCm) > 0 ? Number(m.chestCm) : undefined,
            hipCm: Number(m.hipCm) > 0 ? Number(m.hipCm) : undefined,
            bicepLeftCm: Number(m.armLeftCm) > 0 ? Number(m.armLeftCm) : undefined,
            bicepRightCm: Number(m.armRightCm) > 0 ? Number(m.armRightCm) : undefined,
            forearmCm: Number(m.forearmLeftCm) > 0 ? Number(m.forearmLeftCm) : undefined,
            waistCm: Number(m.waistCm) > 0 ? Number(m.waistCm) : undefined,
            thighLeftCm: Number(m.thighLeftCm) > 0 ? Number(m.thighLeftCm) : undefined,
            thighRightCm: Number(m.thighRightCm) > 0 ? Number(m.thighRightCm) : undefined,
            calfLeftCm: Number(m.calfLeftCm) > 0 ? Number(m.calfLeftCm) : undefined,
            calfRightCm: Number(m.calfRightCm) > 0 ? Number(m.calfRightCm) : undefined,
            notes: typeof m.notes === 'string' ? m.notes : undefined,
          });
        }
        localStorage.removeItem('he_measurements');
      }
    } catch { /* ignore */ }

    // 2) he_body_comp (BodyCompEntry: weightKg, bodyFatPercent, measurements{...})
    try {
      const raw = JSON.parse(localStorage.getItem('he_body_comp') || '[]');
      if (Array.isArray(raw)) {
        for (const e of raw) {
          if (!e || !e.date) continue;
          if (Number(e.weightKg) <= 0) continue;
          const ms = e.measurements || {};
          merge(e.date, {
            weight: Number(e.weightKg),
            bodyFat: Number(e.bodyFatPercent) > 0 ? Number(e.bodyFatPercent) : undefined,
            chestCm: Number(ms.chestCm) > 0 ? Number(ms.chestCm) : undefined,
            waistCm: Number(ms.waistCm) > 0 ? Number(ms.waistCm) : undefined,
            hipCm: Number(ms.hipCm) > 0 ? Number(ms.hipCm) : undefined,
            bicepCm: Number(ms.armCm) > 0 ? Number(ms.armCm) : undefined,
            thighCm: Number(ms.thighCm) > 0 ? Number(ms.thighCm) : undefined,
            calfCm: Number(ms.calfCm) > 0 ? Number(ms.calfCm) : undefined,
            neckCm: Number(ms.neckCm) > 0 ? Number(ms.neckCm) : undefined,
            notes: typeof e.notes === 'string' ? e.notes : undefined,
          });
        }
        localStorage.removeItem('he_body_comp');
      }
    } catch { /* ignore */ }

    // 3) he_weight_log_entries ({date, weight}) — зеркало из планировщика питания
    try {
      const raw = JSON.parse(localStorage.getItem('he_weight_log_entries') || '[]');
      if (Array.isArray(raw)) {
        for (const e of raw) {
          if (!e || !e.date || !(Number(e.weight) > 0)) continue;
          merge(e.date, { weight: Number(e.weight) });
        }
      }
    } catch { /* ignore */ }

    // 4) he_nutrition_v2.weightHistory ({date, kg})
    try {
      const raw = JSON.parse(localStorage.getItem('he_nutrition_v2') || '{}');
      const hist = raw?.weightHistory;
      if (Array.isArray(hist)) {
        for (const e of hist) {
          if (!e || !e.date || !(Number(e.kg) > 0)) continue;
          merge(e.date, { weight: Number(e.kg) });
        }
      }
    } catch { /* ignore */ }

    const merged = [...byDate.entries()]
      .map(([date, e]) => ({ date, ...e }) as WeightEntry)
      .filter(e => Number.isFinite(e.weight))
      .sort((a, b) => b.date.localeCompare(a.date));
    if (merged.length > log.length) saveWeightLog(merged);
    localStorage.setItem(KEYS.weightMigrated, '1');
  } catch { /* quota/parse — silent, повторится при следующем открытии */ }
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
  const byDate = new Map(weightLog.map(e => [e.date, e]));
  for (const m of log) {
    const existing = byDate.get(m.date);
    if (!existing) continue;
    byDate.set(m.date, {
      ...existing,
      waistCm: m.waistCm || existing.waistCm,
      chestCm: m.chestCm || existing.chestCm,
      hipCm: m.hipCm || existing.hipCm,
      bicepCm: m.bicepCm || existing.bicepCm,
      thighCm: m.thighCm || existing.thighCm,
      neckCm: m.neckCm || existing.neckCm,
      forearmCm: m.forearmCm || existing.forearmCm,
      bodyFat: m.bodyFat || existing.bodyFat,
    });
  }
  saveWeightLog([...byDate.values()]);
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

