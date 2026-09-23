/**
 * plan-targets-bridge.ts — ЕДИНЫЙ мост «цели плана → внешние поверхности питания».
 *
 * Проблема: hero Питания и дневник считали цели дня сами (`calcNutrition` из профиля:
 * вес/рост/пол/PAL/primaryGoal) и не совпадали с целями, которые пользователь задал
 * в Плане (ручное КБЖУ, цель/фаза, профицит, ББ-заметка, диет-стиль). Один и тот же
 * экран показывал две разные «цели».
 *
 * Решение: контекст плана (`IndividualPlanContext`) публикует ФАКТИЧЕСКИЕ цели дня
 * (`effectiveKcal/P/F/C`) сюда, а внешние поверхности (hero, дневник, графики, отчёты)
 * читают их как источник правды с фолбэком на прежний профильный расчёт.
 *
 * Ключ/событие вынесены в один модуль — никаких дублей строк в потребителях.
 */

export const PLAN_TARGETS_KEY = 'he_plan_kbju_targets';
export const PLAN_TARGETS_EVENT = 'nutrition-plan-targets-updated';

export interface PlanKbjuTargets {
  kcal: number;
  protein: number;
  fats: number;
  carbs: number;
}

function validNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/** Санитизация прочитанных целей: мусор/частичный объект → null. */
export function parsePlanTargets(raw: unknown): PlanKbjuTargets | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!validNum(o.kcal) || o.kcal <= 0) return null;
  if (!validNum(o.protein) || !validNum(o.fats) || !validNum(o.carbs)) return null;
  return { kcal: o.kcal, protein: o.protein, fats: o.fats, carbs: o.carbs };
}

/** Публикует цели плана (localStorage + событие). Никогда не бросает. */
export function publishPlanTargets(t: PlanKbjuTargets): void {
  const safe = parsePlanTargets(t);
  if (!safe) return;
  const payload = { ...safe, ts: Date.now() };
  try {
    localStorage.setItem(PLAN_TARGETS_KEY, JSON.stringify(payload));
  } catch {
    /* quota / приватный режим — молча */
  }
  try {
    window.dispatchEvent(new CustomEvent(PLAN_TARGETS_EVENT, { detail: payload }));
  } catch {
    /* SSR/jsdom без CustomEvent — молча */
  }
}

/** Читает опубликованные цели плана. Мусор/пусто → null. */
export function readPlanTargets(): PlanKbjuTargets | null {
  try {
    const raw = localStorage.getItem(PLAN_TARGETS_KEY);
    if (!raw) return null;
    return parsePlanTargets(JSON.parse(raw));
  } catch {
    return null;
  }
}


