/**
 * profile-store.ts — синхронизация профиля с дочерними модулями.
 * ПОСЛЕ миграции на UnifiedSettings: все sync-функции пишут ТОЛЬКО в общее хранилище.
 * Diary-данные (вес, замеры, давление) остаются в отдельных localStorage.
 */

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
  shoulderCm?: number;    // плечи, см
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
  forearmCm?: number;     // предплечье, см (среднее/общее)
  forearmLeftCm?: number; // предплечье левое, см
  forearmRightCm?: number;// предплечье правое, см
  muscleMass?: number;    // мышечная масса, кг
  waterMass?: number;     // вода, %
  notes?: string;         // заметка
  photos?: string[];      // base64/dataURL фото
  timeOfDay?: 'morning' | 'evening'; // время суток замера (макс 5, до 2Мб каждое)
}

const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Нормализация одной записи: числа, фильтр NaN-веса, строка даты. */
export function normalizeWeightEntry(e: any): WeightEntry | null {
  if (!e || typeof e.date !== 'string' || !e.date) return null;
  const weight = num(e.weight);
  if (weight === undefined || weight <= 0) return null;
  return {
    date: e.date,
    weight,
    bodyFat: num(e.bodyFat),
    waistCm: num(e.waistCm),
    chestCm: num(e.chestCm),
    hipCm: num(e.hipCm),
    shoulderCm: num(e.shoulderCm),
    bicepCm: num(e.bicepCm),
    bicepLeftCm: num(e.bicepLeftCm),
    bicepRightCm: num(e.bicepRightCm),
    thighCm: num(e.thighCm),
    thighLeftCm: num(e.thighLeftCm),
    thighRightCm: num(e.thighRightCm),
    calfCm: num(e.calfCm),
    calfLeftCm: num(e.calfLeftCm),
    calfRightCm: num(e.calfRightCm),
    neckCm: num(e.neckCm),
    forearmCm: num(e.forearmCm),
    forearmLeftCm: num(e.forearmLeftCm),
    forearmRightCm: num(e.forearmRightCm),
    muscleMass: num(e.muscleMass),
    waterMass: num(e.waterMass),
    notes: typeof e.notes === 'string' && e.notes ? e.notes : undefined,
    photos: Array.isArray(e.photos) ? e.photos.filter((p: any) => typeof p === 'string') : undefined,
    timeOfDay: e.timeOfDay === 'morning' || e.timeOfDay === 'evening' ? e.timeOfDay : undefined,
  };
}

export function getWeightLog(): WeightEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.weight) || '[]');
    return Array.isArray(raw) ? raw.map(normalizeWeightEntry).filter((e): e is WeightEntry => e !== null) : [];
  } catch { return []; }
}

/**
 * Сохранение лога: дедупликация по дате, сортировка по дате (asc),
 * обрезка до 365 самых СВЕЖИХ записей; старшие уходят в архив.
 * Устойчив к любому порядку входящего массива.
 */
export function saveWeightLog(log: WeightEntry[]) {
  const byDate = new Map<string, WeightEntry>();
  for (const e of log) {
    const n = normalizeWeightEntry(e);
    if (n) byDate.set(n.date, n);
  }
  const deduped = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = deduped.slice(-365);
  if (trimmed.length < deduped.length) {
    const overflow = deduped.slice(0, deduped.length - 365);
    try {
      const archive = getWeightLogArchived();
      const arcByDate = new Map<string, WeightEntry>();
      for (const e of [...archive, ...overflow]) if (e && e.date) arcByDate.set(e.date, e);
      localStorage.setItem(KEYS.weightArchive, JSON.stringify([...arcByDate.values()]));
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
    return Array.isArray(raw) ? raw.map(normalizeWeightEntry).filter((e): e is WeightEntry => e !== null) : [];
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
      // Каноническая запись имеет приоритет: legacy-поля применяются только
      // для незаполненных ключей; undefined-поля не затирают данные.
      const clean: Partial<WeightEntry> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue;
        if ((existing as Record<string, unknown>)[k] !== undefined) continue;
        (clean as Record<string, unknown>)[k] = v;
      }
      byDate.set(date, { ...existing, ...clean, date });
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
            shoulderCm: Number(m.shoulderCm) > 0 ? Number(m.shoulderCm) : undefined,
            bicepLeftCm: Number(m.armLeftCm) > 0 ? Number(m.armLeftCm) : undefined,
            bicepRightCm: Number(m.armRightCm) > 0 ? Number(m.armRightCm) : undefined,
            forearmLeftCm: Number(m.forearmLeftCm) > 0 ? Number(m.forearmLeftCm) : undefined,
            forearmRightCm: Number(m.forearmRightCm) > 0 ? Number(m.forearmRightCm) : undefined,
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
    // Сохраняем не только при появлении новых записей, но и при изменении полей
    // существующих (legacy-замеры на даты канонических записей).
    if (merged.length !== log.length || JSON.stringify(merged) !== JSON.stringify(log)) {
      saveWeightLog(merged);
    }
    localStorage.setItem(KEYS.weightMigrated, '1');
  } catch { /* quota/parse — silent, повторится при следующем открытии */ }
}

/* ── DEPRECATED: measurements log merged into weight log ── */
export interface MeasurementEntry {
  date: string; waistCm: number; chestCm: number; hipCm: number; shoulderCm: number;
  bicepCm: number; thighCm: number; neckCm: number; forearmCm: number; bodyFat: number;
}
/** @deprecated Use getWeightLog() instead. Returns measurements extracted from weight log. */
export function getMeasurementsLog(): MeasurementEntry[] {
  const weightLog = getWeightLog();
  return weightLog
    .filter(e => e.waistCm !== undefined || e.chestCm !== undefined || e.hipCm !== undefined ||
                 e.bicepCm !== undefined || e.thighCm !== undefined || e.neckCm !== undefined ||
                 e.forearmCm !== undefined || e.shoulderCm !== undefined || e.bodyFat !== undefined)
    .map(e => ({
      date: e.date,
      waistCm: e.waistCm || 0,
      chestCm: e.chestCm || 0,
      hipCm: e.hipCm || 0,
      shoulderCm: e.shoulderCm || 0,
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

