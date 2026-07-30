/**
 * planner-storage.ts — безопасная обёртка над localStorage для планировщика.
 *
 * Проблема: 36 ключей без схемы, всё обёрнуто в try/catch{} (тихая потеря данных),
 * архив отчётов и monthPlan могут переполнить квоту 5 МБ. При QuotaExceededError
 * запись молча проваливается — юзер не знает, что состояние не сохранилось.
 *
 * Решение: safeWriteJSON ловит квоту, пытается очистить архив отчётов и повторить,
 * при неудаче возвращает false (caller может показать уведомление).
 */

const REPORT_ARCHIVE_KEY = 'he_nutrition_report_archive';

export function safeWriteJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e: any) {
    const quota = e && (e.name === 'QuotaExceededError' || (e.code === 22) || (e.code === 1014));
    if (!quota) return false;
    // Prune the report archive (most volatile, least critical) and retry once.
    try {
      const arch = JSON.parse(localStorage.getItem(REPORT_ARCHIVE_KEY) || '[]');
      if (Array.isArray(arch) && arch.length > 5) {
        localStorage.setItem(REPORT_ARCHIVE_KEY, JSON.stringify(arch.slice(0, 5)));
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      }
    } catch {}
    // Last resort: drop the archive entirely.
    try { localStorage.removeItem(REPORT_ARCHIVE_KEY); localStorage.setItem(key, JSON.stringify(value)); return true; } catch {}
    return false;
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

/**
 * Read JSON from localStorage with shape validation. Returns the parsed value
 * only if `validate(parsed)` returns true, otherwise the fallback. This prevents
 * "cannot read properties of undefined (reading length)" crashes when a user has
 * stale or corrupted data from a previous app version.
 */
export function readJSONSafe<T>(key: string, fallback: T, validate: (v: any) => boolean): T {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    const parsed = JSON.parse(v);
    return validate(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Run once on app load. Wipes localStorage keys whose JSON shape no longer matches the
 *  expected schema. Prevents old-version corruption from breaking the planner. */
export const PLANNER_SCHEMA_VERSION = 4;
export function migratePlannerStorage(): void {
  try {
    const vRaw = localStorage.getItem('he_planner_schema_version');
    const v = vRaw ? parseInt(vRaw, 10) : 0;
    if (v >= PLANNER_SCHEMA_VERSION) return;
    // Schema changed at v4: defensively drop keys that should be arrays but might be objects.
    const arrayKeys = [
      'he_saved_nutrition_plans', 'he_excluded_foods', 'he_preferred_foods', 'he_diet_preferences',
      'he_excluded_categories', 'he_food_allergens', 'he_health_issues', 'he_plan_month',
      'he_user_recipes', 'he_nutrition_supps', 'he_intolerances', 'he_preferred_by_meal',
      'he_locked_foods', 'he_weight_log_entries', 'he_shopping_checked', 'he_special_meals',
      'he_plan_days', 'he_plan_day_idx', 'he_plan_view', 'he_plan_month_mode',
      'he_bb_category', 'he_peak_week', 'he_peak_show_day', 'he_life_stage',
      'he_surplus_pct', 'he_variety_strictness', 'he_diary_adaptation', 'he_nutrition_notes',
      'he_planner_labs', 'he_planner_pharma', 'he_planner_histamine',
    ];
    let wiped = false;
    arrayKeys.forEach(k => {
      try {
        const raw = localStorage.getItem(k);
        if (raw === null) return;
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object') { localStorage.removeItem(k); wiped = true; }
      } catch {}
    });
    if (wiped) { try { console.info('[Planner] Cleaned stale localStorage entries (schema v' + PLANNER_SCHEMA_VERSION + ')'); } catch {} }
    try { localStorage.setItem('he_planner_schema_version', String(PLANNER_SCHEMA_VERSION)); } catch {}
  } catch {}
}