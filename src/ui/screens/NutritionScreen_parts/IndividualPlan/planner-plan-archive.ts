/**
 * planner-plan-archive.ts — «активный план» + архив старых планов питания.
 *
 * Зачем: раньше «Сохранить план» просто складывал план в список (срез 10),
 * ничего не публиковал на страницу питания и не различал, какой из планов
 * сейчас главный. Пользователь просил:
 *   1) сохранённый план сразу подставляет СВОИ КБЖУ в шапку Питания;
 *   2) предыдущий план уходит в отдельный архив, а не теряется в общем списке.
 *
 * Хранилище намеренно отдельное от `he_saved_nutrition_plans`: старый ключ
 * остаётся источником для уже существующего списка «Сохранённые планы»
 * (переименование ключа сломало бы чужие сохранения).
 */

import type { SavedPlan } from './types';
import { publishPlanTargets, type PlanKbjuTargets } from './plan-targets-bridge';

export const PLAN_ARCHIVE_KEY = 'he_saved_nutrition_plans_archive_v1';
export const ACTIVE_PLAN_KEY = 'he_nutrition_active_plan_v1';
export const PLAN_ARCHIVE_EVENT = 'he:nutrition-plan-archive-changed';
/** Больше 12 архивных планов не держим: план с недельным рационом весит
 *  десятки КБ, а localStorage в Android WebView легко переполнить. */
export const PLAN_ARCHIVE_LIMIT = 12;

function notify(): void {
  try {
    window.dispatchEvent(new CustomEvent(PLAN_ARCHIVE_EVENT));
  } catch {
    /* SSR/jsdom без CustomEvent — молча */
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isSavedPlan(value: unknown): value is SavedPlan {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return typeof p.id === 'number' && typeof p.date === 'string';
}

function positive(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

function roundTargets(kcal: number, p: number, f: number, c: number): PlanKbjuTargets | null {
  if (kcal <= 0) return null;
  return { kcal: Math.round(kcal), protein: Math.round(p), fats: Math.round(f), carbs: Math.round(c) };
}

/**
 * Фактические КБЖУ сохранённого плана (на день).
 * Приоритет: дневной план → среднее по 3/7-дневному плану.
 */
export function planTargets(plan: SavedPlan | null | undefined): PlanKbjuTargets | null {
  if (!plan) return null;
  const day = plan.dayPlan?.totals;
  if (day) {
    const res = roundTargets(positive(day.kcal), positive(day.p), positive(day.f), positive(day.c));
    if (res) return res;
  }
  const days: any[] = Array.isArray(plan.weekPlan?.days)
    ? plan.weekPlan.days
    : Array.isArray(plan.threeDayPlan?.days)
      ? plan.threeDayPlan.days
      : [];
  const valid = days.filter(d => d && d.totals && positive(d.totals.kcal) > 0);
  if (valid.length === 0) return null;
  const sum = valid.reduce(
    (acc, d) => ({
      kcal: acc.kcal + positive(d.totals.kcal),
      p: acc.p + positive(d.totals.p),
      f: acc.f + positive(d.totals.f),
      c: acc.c + positive(d.totals.c),
    }),
    { kcal: 0, p: 0, f: 0, c: 0 },
  );
  return roundTargets(sum.kcal / valid.length, sum.p / valid.length, sum.f / valid.length, sum.c / valid.length);
}

/** Текущий активный план (последний сохранённый). */
export function readActivePlan(): SavedPlan | null {
  const raw = readJson<unknown>(ACTIVE_PLAN_KEY, null);
  return isSavedPlan(raw) ? raw : null;
}

export function writeActivePlan(plan: SavedPlan): boolean {
  return writeJson(ACTIVE_PLAN_KEY, plan);
}

export function readPlanArchive(): SavedPlan[] {
  const raw = readJson<unknown>(PLAN_ARCHIVE_KEY, []);
  return Array.isArray(raw) ? raw.filter(isSavedPlan) : [];
}

/** Кладёт план в архив (без дублей по id, свежие сверху, лимит 30). */
export function archivePlan(plan: SavedPlan): SavedPlan[] {
  if (!isSavedPlan(plan)) return readPlanArchive();
  const next = [plan, ...readPlanArchive().filter(p => p.id !== plan.id)].slice(0, PLAN_ARCHIVE_LIMIT);
  writeJson(PLAN_ARCHIVE_KEY, next);
  notify();
  return next;
}

/**
 * Делает план активным: предыдущий активный уходит в архив.
 * Возвращает архив после операции (для UI-карточки).
 */
export function rotateActivePlan(newPlan: SavedPlan, previous?: SavedPlan | null): SavedPlan[] {
  const prev = previous ?? readActivePlan();
  let archive = readPlanArchive();
  if (prev && prev.id !== newPlan.id) {
    archive = [prev, ...archive.filter(p => p.id !== prev.id)].slice(0, PLAN_ARCHIVE_LIMIT);
    writeJson(PLAN_ARCHIVE_KEY, archive);
  }
  writeActivePlan(newPlan);
  notify();
  return archive;
}

/** Вернуть план из архива в работу: он становится активным и покидает архив. */
export function restorePlanFromArchive(id: number): SavedPlan | null {
  const archive = readPlanArchive();
  const plan = archive.find(p => p.id === id) || null;
  if (!plan) return null;
  const previous = readActivePlan();
  let next = archive.filter(p => p.id !== id);
  if (previous && previous.id !== plan.id) {
    next = [previous, ...next].slice(0, PLAN_ARCHIVE_LIMIT);
  }
  writeJson(PLAN_ARCHIVE_KEY, next);
  writeActivePlan(plan);
  notify();
  return plan;
}

/** Удалить план из архива. */
export function removeArchivedPlan(id: number): SavedPlan[] {
  const next = readPlanArchive().filter(p => p.id !== id);
  writeJson(PLAN_ARCHIVE_KEY, next);
  notify();
  return next;
}

/**
 * Публикует КБЖУ сохранённого плана на страницу Питания (hero + дневник).
 * Возвращает true, если цели удалось вычислить и опубликовать.
 */
export function publishPlanTargetsFor(plan: SavedPlan | null | undefined): boolean {
  const targets = planTargets(plan);
  if (!targets) return false;
  publishPlanTargets(targets);
  return true;
}
