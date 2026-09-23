/**
 * hub-diary.engine.ts — единый источник дневника для хабов диагностики (арм/армлифтинг/ТА/стронг/ББ).
 *
 * Проблема (ROUND-10): хабы читали ЛЕГАСИ-ключи `he_workout_log_v1` / `he_training_log` /
 * `he_workout_history`, которые в проде уже никто не пишет (живой дневник — `he_workout_log_v2`,
 * `workout-logger.engine`), а цепочка `getItem(v1) || getItem(v2)` ловила `'[]'` (truthy)
 * и не доходила до v2. Плюс движки хабов ждут РАЗНЫЕ формы:
 *  - v2-форма (`{date, exercises:[{exerciseName, muscleGroup, sets:[{weightKg,reps,rpe}]}]}`):
 *    `detectArmWeakByE1rm`, `detectWeakMusclesByE1rm`/`detectTAWeakFromDiary`,
 *    `candidateTAWeakPointsFromDiary`, ББ `factVolume`;
 *  - плоская легаси-форма (`{date, exerciseName, sets:[{weight,reps,isWarmup,velocity}]}`):
 *    `buildDiaryTrendSS`, `smWeeklySetsByLift`, `buildLastE1RMIndexSS`.
 *
 * Здесь обе формы выводятся из ОДНОГО живого источника; легаси остаётся только фолбэком
 * (и наоборот — легаси-плоские записи оборачиваются в v2-форму).
 */

export const HUB_DIARY_SESSION_KEYS = ['he_workout_log_v2'];
export const HUB_DIARY_LEGACY_KEYS = ['he_workout_log_v1', 'he_training_log', 'he_workout_history', 'he_workout_log', 'he_workout_log_v3'];

export interface HubDiarySet {
  weight: number; reps: number;
  /** алиас `weight` — часть потребителей читает `weightKg` (v2-форма дневника) */
  weightKg?: number;
  isWarmup?: boolean; velocity?: number; rpe?: number;
}
export interface HubDiaryExercise {
  exerciseName: string;
  name?: string;
  exerciseId?: string;
  muscleGroup?: string;
  muscle?: string;
  /** сторона унилатеральной работы (`side`/`arm`/`hand` в легаси-дневнике) — нужна L/R-вердикту ББ */
  side?: string;
  sets: HubDiarySet[];
}
export interface HubDiarySession { date: string; exercises: HubDiaryExercise[] }

function readArray(key: string): any[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

/** Первая НЕПУСТАЯ запись из списка ключей (пустой `[]` больше не блокирует фолбэк). */
function readFirstNonEmpty(keys: string[]): { key: string; arr: any[] } | null {
  for (const k of keys) {
    const arr = readArray(k);
    if (arr.length) return { key: k, arr };
  }
  return null;
}

function toHubSet(s: any): HubDiarySet | null {
  const weight = Number(s?.weightKg ?? s?.weight ?? 0);
  const reps = Number(s?.reps ?? 0);
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return null;
  const velocity = typeof s?.velocityMs === 'number' ? s.velocityMs : typeof s?.velocity === 'number' ? s.velocity : undefined;
  // Аддитивно: сохраняем исходные поля сета (velocityMs/техника/…) и дублируем вес в обе формы.
  const out: HubDiarySet & Record<string, unknown> = { ...(s || {}), weight, weightKg: weight, reps };
  if (s?.isWarmup === true) out.isWarmup = true;
  if (velocity != null) out.velocity = velocity;
  if (Number.isFinite(Number(s?.rpe))) out.rpe = Number(s.rpe);
  return out;
}

function toHubExercise(ex: any): HubDiaryExercise | null {
  const name = String(ex?.exerciseName ?? ex?.name ?? ex?.exerciseId ?? '').trim();
  const muscleRaw = ex?.muscleGroup ?? ex?.muscle ?? ex?.group;
  const muscleGroup = muscleRaw ? String(muscleRaw).trim().toLowerCase() : undefined;
  // Легаси-дневник допускает записи БЕЗ имени — упражнение опознаётся мышцей
  // (арм-хаб: `muscle: 'pronators'`, ББ-хаб: `muscleGroup: 'chest'`).
  if (!name && !muscleGroup) return null;
  let sets = (Array.isArray(ex?.sets) ? ex.sets : []).map(toHubSet).filter((s: HubDiarySet | null): s is HubDiarySet => !!s);
  // Числовой `sets: N` (счётчик, а не массив) — синтезируем N пустых сетов: L/R-вердикт считает сеты по количеству.
  if (!sets.length && Number.isFinite(Number(ex?.sets)) && Number(ex.sets) > 0) {
    sets = Array.from({ length: Math.min(50, Math.round(Number(ex.sets))) }, () => ({ weight: 0, reps: 0 }));
  }
  if (!sets.length) return null;
  const sideRaw = ex?.side ?? ex?.arm ?? ex?.hand;
  // Аддитивно: исходные поля упражнения (technique/order/…) + нормализованные имя/мышца/сторона.
  return {
    ...(ex || {}),
    exerciseName: name || muscleGroup || '',
    name: name || undefined,
    exerciseId: ex?.exerciseId ? String(ex.exerciseId) : undefined,
    muscleGroup,
    muscle: muscleGroup,
    side: sideRaw ? String(sideRaw) : undefined,
    sets,
  } as HubDiaryExercise;
}

/** Нормализация одного ряда дневника: либо сессия (`exercises[]`), либо плоская запись упражнения. */
function rowToSession(row: any): HubDiarySession | null {
  if (!row || typeof row !== 'object') return null;
  const date = String(row.date ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (Array.isArray(row.exercises)) {
    const exercises = (row.exercises as any[]).map(toHubExercise).filter((e: HubDiaryExercise | null): e is HubDiaryExercise => !!e);
    return exercises.length ? { date, exercises } : null;
  }
  const ex = toHubExercise(row);
  return ex ? { date, exercises: [ex] } : null;
}

/** v2-форма: сессии живого дневника (или легаси-ряды, обёрнутые в сессию). */
export function loadHubDiarySessions(): HubDiarySession[] {
  // Порядок: живой v2 → легаси-ключи; первый НЕПУСТОЙ массив побеждает (пустой `'[]'` не блокирует).
  for (const key of [...HUB_DIARY_SESSION_KEYS, ...HUB_DIARY_LEGACY_KEYS]) {
    const arr = readArray(key);
    if (!arr.length) continue;
    const sessions = arr.map(rowToSession).filter((s: HubDiarySession | null): s is HubDiarySession => !!s);
    if (sessions.length) return sessions;
  }
  return [];
}

/** Плоская легаси-форма (для `buildDiaryTrendSS`/`smWeeklySetsByLift`/`buildLastE1RMIndexSS`). */
export function loadHubDiaryFlatEntries(): Array<{ date: string; exerciseName: string; sets: HubDiarySet[] }> {
  const out: Array<{ date: string; exerciseName: string; sets: HubDiarySet[] }> = [];
  for (const s of loadHubDiarySessions()) {
    for (const ex of s.exercises) {
      out.push({ date: s.date, exerciseName: ex.exerciseName, sets: ex.sets });
    }
  }
  return out;
}
