/**
 * bb-wearable.engine.ts — P2 D: слой-слияние данных носимых устройств в recovery.
 *
 * Per плана §2.4: реального источника данных в приложении пока нет (Telegram Mini App),
 * поэтому реализуется ТОЛЬКО слой-слияние: если появится ключ `he_wearable_daily`
 * (HRV baseline/утренний, сон, шаги, resting HR), он перекрывает ручной ввод
 * в computeBBRecoveryScore. Без данных — нейтрально (ручной ввод из профиля остаётся).
 *
 * Капы не меняются — мягкое уточнение восстановления.
 */

export interface WearableDaily {
  morningHRV?: number;
  restingHR?: number;
  sleepHours?: number;
  steps?: number;
  date?: string;
}

/** Прочитать дневные данные носимого (null — нет). */
export function readWearableDaily(): WearableDaily | null {
  try {
    const raw = localStorage.getItem('he_wearable_daily');
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p === null || typeof p !== 'object') return null;
    return p as WearableDaily;
  } catch {
    return null;
  }
}

/** Слить носимые данные с ручным профилем: носимые приоритетнее, если число валидно. */
export function mergeWearableIntoRecovery(
  profile: { hrvMs?: number; sleepHours?: number; stressLevel?: number },
  wearable: WearableDaily | null,
): { hrvMs?: number; sleepHours?: number; stressLevel?: number } {
  const out: { hrvMs?: number; sleepHours?: number; stressLevel?: number } = { ...profile };
  if (!wearable) return out;
  if (Number.isFinite(wearable.morningHRV) && (wearable.morningHRV as number) > 0) {
    out.hrvMs = wearable.morningHRV;
  }
  if (Number.isFinite(wearable.sleepHours) && (wearable.sleepHours as number) > 0) {
    out.sleepHours = wearable.sleepHours;
  }
  // Стресс не измеряется носимым напрямую — оставляем ручной, если он задан.
  return out;
}

/** Множитель recovery от носимых данных (0.85-1.05). Без данных — 1.0. */
export function wearableRecoveryFactor(wearable: WearableDaily | null): number {
  if (!wearable) return 1.0;
  let score = 1.0;
  if (Number.isFinite(wearable.morningHRV) && (wearable.morningHRV as number) > 0) {
    const hrv = wearable.morningHRV as number;
    if (hrv < 45) score *= 0.93;
    else if (hrv < 60) score *= 0.97;
    else if (hrv > 75) score *= 1.05;
  }
  if (Number.isFinite(wearable.sleepHours) && (wearable.sleepHours as number) > 0) {
    const s = wearable.sleepHours as number;
    if (s < 6) score *= 0.95;
    else if (s >= 7.5) score *= 1.03;
  }
  if (Number.isFinite(wearable.restingHR) && (wearable.restingHR as number) > 0) {
    const rhr = wearable.restingHR as number;
    if (rhr > 65) score *= 0.97; // повышенный resting HR — недо-восстановление
  }
  return Math.max(0.85, Math.min(1.05, score));
}
