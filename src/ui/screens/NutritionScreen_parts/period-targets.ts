/**
 * period-targets.ts — «сколько должно быть за период» для отчётов питания.
 *
 * Проблема: в «Обзоре питания» за неделю/месяц показывались только НАБРАННЫЕ
 * КБЖУ (сумма позиций за окно), без дневной цели, без нормы за период и без
 * покрытия дней — понять «сколько должно быть» было нельзя.
 *
 * Конвенции (согласованы, не менять):
 * - основная метрика периода — СРЕДНЕЕ В ДЕНЬ за дни с записями против ДНЕВНОЙ
 *   цели (та же конвенция, что в APK-виджете NutritionPanelWidgetProvider);
 * - рядом — буквальная норма за период: дневная цель × число дней с записями;
 * - дни без записей НЕ разбавляют среднее нулями, но и не считаются выполненными;
 * - мало данных, если дней с записями меньше 3.
 *
 * Модуль чистый (без React), чтобы его можно было тестировать отдельно.
 */

export interface PeriodTargetsInput {
  kcal: number;
  protein: number;
  fats: number;
  carbs: number;
}

export interface PeriodGoal {
  /** Дни окна, в которых есть хотя бы одна позиция. */
  daysWithRecords: number;
  /** Длина окна: 7 для недели, число дней месяца, 1 для дня. */
  periodDays: number;
  /** Сумма за период (то, что реально набрано). */
  total: PeriodTargetsInput;
  /** round(total / max(1, daysWithRecords)) — среднее только по дням с записями. */
  avgPerDay: PeriodTargetsInput;
  /** ceil(daily * daysWithRecords) — норма за N дней, где N = дни с записями. */
  goalPerLoggedDays: PeriodTargetsInput;
  /** ceil(daily * periodDays) — норма за весь период (7 дн. недели / дней месяца). */
  goalPerPeriod: PeriodTargetsInput;
  /** round(avgPerDay / daily * 100); 0 при нулевой цели. */
  pctOfDaily: PeriodTargetsInput;
  /** round(total / goalPerLoggedDays * 100); 0 при нулевой цели. */
  pctOfPeriod: PeriodTargetsInput;
  /** daysWithRecords >= 3. */
  enoughData: boolean;
}

/** Минимум дней с записями, ниже которого средние считаем неинформативными. */
export const PERIOD_MIN_DAYS = 3;

export function emptyTargets(): PeriodTargetsInput {
  return { kcal: 0, protein: 0, fats: 0, carbs: 0 };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function sanitize(input: Partial<PeriodTargetsInput> | null | undefined): PeriodTargetsInput {
  const o = (input || {}) as Partial<PeriodTargetsInput>;
  return { kcal: num(o.kcal), protein: num(o.protein), fats: num(o.fats), carbs: num(o.carbs) };
}

/** round(a / b * 100) без деления на ноль: при b <= 0 — 0, NaN/Infinity не выходят наружу. */
function pctOf(value: number, base: number): number {
  if (!(base > 0) || !Number.isFinite(value)) return 0;
  const r = Math.round((value / base) * 100);
  return Number.isFinite(r) ? r : 0;
}

export function buildPeriodGoal(
  total: PeriodTargetsInput,
  daily: PeriodTargetsInput,
  daysWithRecords: number,
  periodDays: number,
): PeriodGoal {
  const t = sanitize(total);
  const d = sanitize(daily);
  const days = Math.max(0, Math.floor(num(daysWithRecords)));
  const period = Math.max(0, Math.floor(num(periodDays)));
  const denom = Math.max(1, days);

  const avgPerDay: PeriodTargetsInput = {
    kcal: Math.round(t.kcal / denom),
    protein: Math.round(t.protein / denom),
    fats: Math.round(t.fats / denom),
    carbs: Math.round(t.carbs / denom),
  };
  const goalPerLoggedDays: PeriodTargetsInput = {
    kcal: Math.ceil(d.kcal * days),
    protein: Math.ceil(d.protein * days),
    fats: Math.ceil(d.fats * days),
    carbs: Math.ceil(d.carbs * days),
  };
  const goalPerPeriod: PeriodTargetsInput = {
    kcal: Math.ceil(d.kcal * period),
    protein: Math.ceil(d.protein * period),
    fats: Math.ceil(d.fats * period),
    carbs: Math.ceil(d.carbs * period),
  };
  const pctOfDaily: PeriodTargetsInput = {
    kcal: pctOf(avgPerDay.kcal, d.kcal),
    protein: pctOf(avgPerDay.protein, d.protein),
    fats: pctOf(avgPerDay.fats, d.fats),
    carbs: pctOf(avgPerDay.carbs, d.carbs),
  };
  const pctOfPeriod: PeriodTargetsInput = {
    kcal: pctOf(t.kcal, goalPerLoggedDays.kcal),
    protein: pctOf(t.protein, goalPerLoggedDays.protein),
    fats: pctOf(t.fats, goalPerLoggedDays.fats),
    carbs: pctOf(t.carbs, goalPerLoggedDays.carbs),
  };

  return {
    daysWithRecords: days,
    periodDays: period,
    total: t,
    avgPerDay,
    goalPerLoggedDays,
    goalPerPeriod,
    pctOfDaily,
    pctOfPeriod,
    enoughData: days >= PERIOD_MIN_DAYS,
  };
}

/**
 * Сколько РАЗНЫХ дней с записями среди позиций.
 *
 * Позиция — это запись, поэтому учитывается и продукт с 0 ккал (вода, специи):
 * день с позицией не пустой. Если у позиций есть `date` — считаем уникальные
 * даты; если нет (плоский список одного дня) — 1 при непустом списке.
 */
export function countDaysWithRecords(entries: ReadonlyArray<{ kcal: number; date?: string }>): number {
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  const dates = new Set<string>();
  let undated = false;
  for (const e of entries) {
    if (!e) continue;
    if (typeof e.date === 'string' && e.date) dates.add(e.date);
    else undated = true;
  }
  return dates.size + (undated ? 1 : 0);
}
