/**
 * annual-training-storage.ts — хранение годового плана (localStorage) + миграция
 * из существующих макро-хранилищ (he_pl_macro / he_bb_macro).
 *
 * Единый ключ: he_annual_training_plan_v1. План хранит состояния блоков
 * (конфиг конструктора + результат сборки). Макро-разметка остаётся в старых
 * ключах — план ссылается на неё через macroRef (сериализованный снимок).
 */
import type { AnnualTrainingPlan } from './annual-training.types';
import { annualPlanFromMacro } from './block-builders.engine';
import { deserializeMacro, deserializeBbMacro } from '../lms/macrocycle.engine';

export const ANNUAL_PLAN_KEY = 'he_annual_training_plan_v1';
export const ANNUAL_PLAN_VERSION = 1;

/** Валидация формы загруженного плана (защита от битых данных). */
export function isAnnualTrainingPlanShape(value: unknown): value is AnnualTrainingPlan {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.totalWeeks !== 'number') return false;
  if (!Array.isArray(o.blocks)) return false;
  return o.blocks.every(b => {
    if (!b || typeof b !== 'object') return false;
    const r = (b as any).ref;
    if (!r || typeof r.blockKey !== 'string' || typeof r.startWeek !== 'number' || typeof r.weeks !== 'number') return false;
    return ['unbuilt', 'built', 'stale', 'error'].includes((b as any).status);
  });
}

/** Сохранить годовой план. Возвращает сохранённый объект. */
export function saveAnnualTrainingPlan(plan: AnnualTrainingPlan): AnnualTrainingPlan {
  const stored = { ...plan, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(ANNUAL_PLAN_KEY, JSON.stringify(stored));
  } catch {
    /* quota — план остаётся в памяти */
  }
  window.dispatchEvent(new CustomEvent('he-annual-training-plan-updated', {
    detail: { planId: stored.id, status: stored.status, totalWeeks: stored.totalWeeks },
  }));
  return stored;
}

/** Загрузить годовой план (null — нет/повреждён). */
export function loadAnnualTrainingPlan(): AnnualTrainingPlan | null {
  try {
    const raw = localStorage.getItem(ANNUAL_PLAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isAnnualTrainingPlanShape(parsed)) return null;
    return parsed as AnnualTrainingPlan;
  } catch {
    return null;
  }
}

/** Удалить годовой план. */
export function removeAnnualTrainingPlan(): void {
  try { localStorage.removeItem(ANNUAL_PLAN_KEY); } catch { /* ignore */ }
}

/**
 * Миграция: если годовой план отсутствует, а макро-хранилище есть —
 * создать план со всеми блоками 'unbuilt' (тип конструктора из kind блоков).
 * Приоритет: he_bb_macro для ББ-направления, иначе he_pl_macro.
 */
export function migrateAnnualPlanFromMacroStorage(
  plKey: string = 'he_pl_macro',
  bbKey: string = 'he_bb_macro',
): AnnualTrainingPlan | null {
  const existing = loadAnnualTrainingPlan();
  if (existing) return existing;
  try {
    const rawBB = localStorage.getItem(bbKey);
    if (rawBB) {
      const bbMacro = deserializeBbMacro(rawBB);
      if (bbMacro) return saveAnnualTrainingPlan(annualPlanFromMacro(bbMacro));
    }
    const rawPL = localStorage.getItem(plKey);
    if (rawPL) {
      const macro = deserializeMacro(rawPL);
      if (macro) return saveAnnualTrainingPlan(annualPlanFromMacro(macro));
    }
  } catch { /* ignore — нет валидного макро */ }
  return null;
}
