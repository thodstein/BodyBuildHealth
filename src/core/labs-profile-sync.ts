/**
 * Синхронизация анализов из labs_log (IndexedDB) в профиль UnifiedSettings.labs.
 *
 * Зачем: `UnifiedSettings.labs.summary` — ЕДИНСТВЕННЫЙ источник, из которого
 * калькулятор поддержки и риски получают анализы пациента (адаптер в
 * support-plan/engine.ts). Но у поля не было ни одного писателя: ручной ввод и
 * OCR-импорт писали только в `labs_log`, и калькулятор не видел анализов
 * пользователя вообще («введите вручную» было жёстким).
 *
 * Здесь — чистая сборка сводки. Победитель по дате: свежая запись заменяет
 * старую. Обратное направление ЗАПРЕЩЕНО осознанно — иначе импорт скана
 * месячной давности затирал бы свежие ручные значения.
 */

/** Запись сводки в контракте `UnifiedSettings.labs.summary`. */
export interface LabSummaryEntry {
  value: number;
  date: string;
  unit?: string;
}

/** Вход: любая запись с кодом, значением и (опционально) датой бланка. */
export interface LabSummaryIncoming {
  code?: string;
  value?: number;
  unit?: string;
  date?: string;
}

export interface LabsSummaryPayload {
  lastEnteredDate?: string;
  enteredCount?: number;
  status: 'none' | 'partial' | 'complete';
  summary: Record<string, LabSummaryEntry>;
}

export const LABS_COMPLETE_FROM = 8;

/** ISO-дата (YYYY-MM-DD) или сегодняшняя локальная дата — для записи в профиль. */
export function isoDateOrToday(date: unknown, todayIso: string): string {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return todayIso;
}

/**
 * Статус заполненности: 'complete' при >= LABS_COMPLETE_FROM разных маркеров.
 * Порог явный и зафиксирован здесь, т.к. канона в проекте не было (поле было
 * read-only-документацией), и каждый потребитель придумывал бы свой.
 */
export function labsStatusForCount(count: number): 'none' | 'partial' | 'complete' {
  if (!Number.isFinite(count) || count <= 0) return 'none';
  return count >= LABS_COMPLETE_FROM ? 'complete' : 'partial';
}

/** Лексикографическое сравнение ISO-дат корректно для YYYY-MM-DD. */
export function isNewerLabDate(next: unknown, prev: unknown): boolean {
  const a = typeof next === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(next) ? next : '';
  const b = typeof prev === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(prev) ? prev : '';
  if (!a) return false;
  if (!b) return true;
  return a > b;
}

/**
 * Слияние сводки: сохраняет чужие коды, заменяет код только более свежим
 * значением. Битые значения пропускаются.
 */
export function mergeLabsSummary(
  existing: unknown,
  incoming: LabSummaryIncoming[],
  formDate: unknown,
  todayIso: string,
): LabsSummaryPayload {
  const prevSummary =
    existing && typeof existing === 'object'
      ? (existing as Record<string, LabSummaryEntry>)
      : {};
  const summary: Record<string, LabSummaryEntry> = {};

  // 1. Существующее — как есть (коды нормализуем к верхнему регистру).
  for (const [rawKey, v] of Object.entries(prevSummary)) {
    const key = String(rawKey || '').trim().toUpperCase();
    if (!key || !v || typeof v !== 'object') continue;
    if (typeof (v as LabSummaryEntry).value !== 'number' || !Number.isFinite((v as LabSummaryEntry).value)) continue;
    summary[key] = { ...(v as LabSummaryEntry), date: isoDateOrToday((v as LabSummaryEntry).date, todayIso) };
  }

  // 2. Новые записи — победитель свежее.
  for (const lab of Array.isArray(incoming) ? incoming : []) {
    const key = String(lab?.code || '').trim().toUpperCase();
    const value = lab?.value;
    if (!key || typeof value !== 'number' || !Number.isFinite(value)) continue;
    const prev = summary[key];
    if (prev && !isNewerLabDate(isoDateOrToday(lab?.date ?? formDate, todayIso), prev.date)) continue;
    summary[key] = { value, date: isoDateOrToday(lab?.date ?? formDate, todayIso), unit: lab?.unit };
  }

  const dates = Object.values(summary).map(e => e.date).filter(Boolean).sort();
  return {
    summary,
    enteredCount: Object.keys(summary).length,
    status: labsStatusForCount(Object.keys(summary).length),
    lastEnteredDate: dates.length ? dates[dates.length - 1] : undefined,
  };
}

/**
 * Применить импортированные анализы к профилю. Возвращает true, если запись
 * прошла. Любая ошибка доступа к профилю — false и ничего не пишем.
 */
export function applyLabsSummaryToProfile(
  labs: LabSummaryIncoming[],
  formDate: unknown,
  todayIso: string,
  read: () => any,
  write: (ctx: { settings: Record<string, unknown> }) => void,
): boolean {
  try {
    const valid = (Array.isArray(labs) ? labs : []).filter(
      l => l && String(l.code || '').trim() && typeof l.value === 'number' && Number.isFinite(l.value),
    );
    if (valid.length === 0) return false;
    const current = read();
    const settings = (current?.settings || {}) as Record<string, any>;
    const merged = mergeLabsSummary(settings.labs, valid, formDate, todayIso);
    write({ settings: { ...settings, labs: merged } });
    return true;
  } catch (e) {
    console.error('applyLabsSummaryToProfile failed:', e);
    return false;
  }
}
