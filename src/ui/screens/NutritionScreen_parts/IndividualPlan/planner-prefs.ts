/**
 * planner-prefs.ts — единая точка чтения/записи локальных предпочтений планировщика
 * (localStorage `he_planner_prefs`).
 *
 * P1-fix: массовый эффект записи 27 настроек (cookTimeMin/cravingMode/…) писал объект
 * БЕЗ merge — на каждом маунте он стирал ключи, которые ведут другие писатели
 * (график работы: workScheduleEnabled/Start/End/Days/Type). Пользователь включал
 * рабочий график, а после перезагрузок он молча сбрасывался. Теперь ВСЕ писатели
 * идут через patch-merge, а чтение — через один валидированный хелпер.
 */
import { safeWriteJSON } from './planner-storage';

export const PLANNER_PREFS_KEY = 'he_planner_prefs';

/** Чтение he_planner_prefs: битый JSON/не-объект → {}. Никогда не бросает. */
export function readPlannerPrefs(): Record<string, any> {
  try {
    const v = JSON.parse(localStorage.getItem(PLANNER_PREFS_KEY) || 'null');
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, any>;
  } catch {}
  return {};
}

/**
 * Merge-запись: сохраняет ключи, записанные другими эффектами (не стирает чужие).
 * Возвращает результат safeWriteJSON (квота-безопасность).
 */
export function writePlannerPrefsPatch(patch: Record<string, any>): boolean {
  try {
    return safeWriteJSON(PLANNER_PREFS_KEY, { ...readPlannerPrefs(), ...patch });
  } catch {
    return false;
  }
}
