/**
 * planner-peri-budget.ts — ЕДИНЫЙ источник пери-воркаутного бюджета.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ МОДУЛЬ. До него существовало два независимых ответа на один
 * вопрос «сколько углеводов/белка до и после тренировки»:
 *   • `PeriWorkoutCard` — `computePeriWorkoutNutrition()` от последней ЗАВЕРШЁННОЙ
 *     сессии (1.5 г/кг углеводов «до», 0.35 г/кг белка «после»);
 *   • `meal-plan-engine` — фиксированные доли распределения (`CARB_W` prew 1.0 /
 *     postw 1.2, капы 60/75 г) и `periProteinBudget` (0.25/0.40 г/кг LBM).
 * Пользователь видел в карточке 120 г углеводов «до», а в рационе — 40 г, и считал
 * это багом. Здесь бюджет считается ОДИН раз, а карточка и движок читают его же.
 *
 * Второй контракт: синхронизация с планом тренировок — ТОЛЬКО ПО КНОПКЕ
 * (`writePeriSync` вызывает настройка/карточка, никакой авто-магии). Состояние
 * живёт в `he_peri_sync` (athlete-level ключ, не DEVICE_LEVEL).
 */
import { computePeriWorkoutNutrition, type PeriWorkoutPlan } from '../../../../engines/nutrition-periworkout.engine';
import { safeWriteJSON } from './planner-storage';

export const PERI_SYNC_KEY = 'he_peri_sync';
export const PERI_SYNC_EVENT = 'he:peri-sync';
/** «Синк поставлен — пересобери рацион» (карточка → контекст планировщика). */
export const PERI_APPLY_EVENT = 'he:peri-apply';
/** «Рацион перезаписан» — карточка перечитывает he_day_plan (факт в приёмах). */
export const RATION_UPDATED_EVENT = 'he:ration-updated';

/** Физиологические капы пери-окон движка (mealCarbCapacityG): больше — уже не «окно». */
export const PERI_CAP_PRE_CARB_G = 60;
export const PERI_CAP_POST_CARB_G = 75;
export const PERI_CAP_POST_PROTEIN_G = 60;
export const PERI_MIN_POST_PROTEIN_G = 12;

export type PeriIntensity = 'low' | 'medium' | 'high';
export type PeriSource = 'plan' | 'lastSession' | 'manual';

export interface PeriSyncState {
  v: 1;
  source: PeriSource;
  tonnageKg: number;
  durationMin: number;
  intensity: PeriIntensity;
  sets?: number;
  dayLabel?: string;
  /** подпись плана тренировок на момент синка — «план перегенерили» */
  signature?: string;
  syncedAt: number;
}

export interface PeriBudget {
  /** сколько углеводов РЕАЛЬНО несёт окно в рационе (после капов) */
  preCarbG: number;
  postCarbG: number;
  /** г/ч интра-углеводов и СУММА за окно (после капа ёмкости по длительности) */
  intraCarbGPerH: number;
  intraCarbG: number;
  /** ёмкость интра-окна по длительности сессии (та же формула, что у движка) */
  intraCapG: number;
  postProteinG: number;
  fluidMl: number;
  /** рекомендация движка ДО капов — показывается рядом, чтобы не «врать» */
  recommended: {
    preCarbG: number;
    postCarbG: number;
    intraCarbGPerH: number;
    intraCarbG: number;
    postProteinG: number;
  };
  /** true, если кап сработал (рекомендация > ёмкости окна) */
  capped: boolean;
  meta: {
    source: PeriSource;
    tonnageKg: number;
    durationMin: number;
    intensity: PeriIntensity;
    dayLabel?: string;
    syncedAt: number;
    /** подпись плана на момент синка; '' если источник — сессия/ручной ввод */
    signature: string;
  };
  /** сырой расчёт — карточка показывает его как «рекомендацию протокола» */
  plan: PeriWorkoutPlan;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Ёмкость интра-окна: 40 г/ч, коридор 30–90 г — ТА ЖЕ формула, что
 * `mealCarbCapacityG('intra')` в `meal-plan-engine`. Дублируется осознанно:
 * карточка не тянет движок в бандл, но числа обязаны совпадать.
 */
export function intraWindowCapacityG(durationMin: number): number {
  return Math.round(Math.max(30, Math.min(90, (40 * (durationMin || 75)) / 60)));
}

function normalizeState(raw: any): PeriSyncState | null {
  if (!raw || typeof raw !== 'object') return null;
  const tonnage = Number(raw.tonnageKg);
  const duration = Number(raw.durationMin);
  if (!(tonnage > 0) && !(duration > 0)) return null;
  const source: PeriSource = raw.source === 'plan' || raw.source === 'manual' ? raw.source : 'lastSession';
  const intensity: PeriIntensity = raw.intensity === 'low' || raw.intensity === 'high' ? raw.intensity : 'medium';
  return {
    v: 1,
    source,
    tonnageKg: Math.max(0, Math.round(tonnage) || 0),
    durationMin: Math.max(0, Math.round(duration) || 0),
    intensity,
    sets: Number.isFinite(raw.sets) ? Math.max(0, Math.round(raw.sets)) : undefined,
    dayLabel: typeof raw.dayLabel === 'string' ? raw.dayLabel : undefined,
    signature: typeof raw.signature === 'string' ? raw.signature : '',
    syncedAt: Number.isFinite(raw.syncedAt) ? Number(raw.syncedAt) : Date.now(),
  };
}

/** Чтение he_peri_sync (битый JSON → null, никогда не бросает). */
export function readPeriSync(): PeriSyncState | null {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(PERI_SYNC_KEY) || 'null'));
  } catch {
    return null;
  }
}

/** Запись синка + событие для всех подписчиков (карточка/настройки не расходятся). */
export function writePeriSync(
  next: Omit<PeriSyncState, 'v' | 'syncedAt'> & { syncedAt?: number },
): PeriSyncState | null {
  const state = normalizeState({ ...next, v: 1, syncedAt: next.syncedAt ?? Date.now() });
  if (!state) return null;
  // P2-fix: провал записи (квота) раньше возвращал «успех» — кнопка рапортовала
  // синк, а бюджет не сохранялся. safeWriteJSON возвращает boolean.
  if (!safeWriteJSON(PERI_SYNC_KEY, state)) return null;
  try {
    window.dispatchEvent(new CustomEvent(PERI_SYNC_EVENT));
  } catch {}
  return state;
}

/** Просьба пересобрать рацион по уже сохранённому синку (кнопка в карточке). */
export function requestPeriApply(): void {
  try {
    window.dispatchEvent(new CustomEvent(PERI_APPLY_EVENT));
  } catch {}
}

export function subscribePeriApply(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onApply = () => cb();
  window.addEventListener(PERI_APPLY_EVENT, onApply);
  return () => window.removeEventListener(PERI_APPLY_EVENT, onApply);
}

/** Сообщить, что рацион перезаписан (карточка обновляет «В рационе сейчас»). */
export function notifyRationUpdated(): void {
  try {
    window.dispatchEvent(new CustomEvent(RATION_UPDATED_EVENT));
  } catch {}
}

export function subscribeRationUpdated(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(RATION_UPDATED_EVENT, cb);
  return () => window.removeEventListener(RATION_UPDATED_EVENT, cb);
}

export function clearPeriSync(): void {
  try {
    localStorage.removeItem(PERI_SYNC_KEY);
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(PERI_SYNC_EVENT));
  } catch {}
}

export function subscribePeriSync(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onCustom = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key === PERI_SYNC_KEY) cb();
  };
  window.addEventListener(PERI_SYNC_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(PERI_SYNC_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

export interface ResolvePeriBudgetArgs {
  bodyWeight: number;
  goal?: string;
  ped?: { hasInsulin?: boolean; hasGH?: boolean; hasIGF?: boolean; insulinIU?: number; ghIU?: number };
  stored?: PeriSyncState | null;
  /** если синка нет — можно посчитать от последней сессии (карточка передаёт) */
  fallback?: {
    tonnageKg: number;
    durationMin: number;
    intensity: PeriIntensity;
    source?: PeriSource;
    dayLabel?: string;
  };
}

/**
 * Бюджет пери-окна. null — нет источника нагрузки вообще (окна не строятся).
 *
 * Кап применяется ПО МЕСТУ ОКНА, а не к желанию пользователя: 120 г углеводов
 * «до» физически не влезают в один приём, поэтому окно несёт `min(рекомендация, кап)`,
 * а разница остаётся в основных приёмах (дневная сумма углеводов не меняется —
 * сходимость КБЖУ ≤3% не задевается).
 */
export function resolvePeriBudget(args: ResolvePeriBudgetArgs): PeriBudget | null {
  const stored = args.stored !== undefined ? args.stored : readPeriSync();
  const src =
    stored && (stored.tonnageKg > 0 || stored.durationMin > 0)
      ? stored
      : args.fallback && (args.fallback.tonnageKg > 0 || args.fallback.durationMin > 0)
        ? {
            v: 1 as const,
            source: args.fallback.source || 'lastSession',
            tonnageKg: args.fallback.tonnageKg,
            durationMin: args.fallback.durationMin,
            intensity: args.fallback.intensity,
            dayLabel: args.fallback.dayLabel,
            signature: '',
            syncedAt: Date.now(),
          }
        : null;
  if (!src) return null;

  const plan = computePeriWorkoutNutrition({
    sessionVolume: src.tonnageKg,
    durationMin: src.durationMin,
    bodyWeight: args.bodyWeight,
    goal: args.goal,
    intensity: src.intensity,
    ped: args.ped,
  });

  const preCarbG = Math.min(plan.pre.carbsG, PERI_CAP_PRE_CARB_G);
  const postCarbG = Math.min(plan.post.carbsG, PERI_CAP_POST_CARB_G);
  const postProteinG = clamp(Math.round(plan.post.proteinG), PERI_MIN_POST_PROTEIN_G, PERI_CAP_POST_PROTEIN_G);
  const _durMin = src.durationMin || 60;
  const intraCapG = intraWindowCapacityG(_durMin);
  const intraWantG = Math.round((plan.intra.carbsGPerH * _durMin) / 60);
  const intraCarbG = Math.min(intraWantG, intraCapG);
  const capped =
    plan.pre.carbsG > PERI_CAP_PRE_CARB_G ||
    plan.post.carbsG > PERI_CAP_POST_CARB_G ||
    plan.post.proteinG > PERI_CAP_POST_PROTEIN_G ||
    intraWantG > intraCapG;

  return {
    preCarbG: Math.round(preCarbG),
    postCarbG: Math.round(postCarbG),
    intraCarbGPerH: plan.intra.carbsGPerH,
    intraCarbG,
    intraCapG,
    postProteinG,
    fluidMl: plan.fluidTotalMl,
    recommended: {
      preCarbG: plan.pre.carbsG,
      postCarbG: plan.post.carbsG,
      intraCarbGPerH: plan.intra.carbsGPerH,
      intraCarbG: intraWantG,
      postProteinG: plan.post.proteinG,
    },
    capped,
    meta: {
      source: src.source,
      tonnageKg: src.tonnageKg,
      durationMin: src.durationMin,
      intensity: src.intensity,
      dayLabel: src.dayLabel,
      syncedAt: src.syncedAt,
      signature: src.signature || '',
    },
    plan,
  };
}

/** Компактный вид для `MealPlanInput.periBudget` (движок не тянет PeriWorkoutPlan). */
export interface EnginePeriBudget {
  preCarbG: number;
  postCarbG: number;
  intraCarbGPerH: number;
  /** сумма углеводов интра-окна за сессию (после капа ёмкости); приоритетнее г/ч */
  intraCarbG?: number;
  postProteinG: number;
}

export function periBudgetForEngine(b: PeriBudget | null): EnginePeriBudget | undefined {
  if (!b) return undefined;
  return {
    preCarbG: b.preCarbG,
    postCarbG: b.postCarbG,
    intraCarbGPerH: b.intraCarbGPerH,
    intraCarbG: b.intraCarbG,
    postProteinG: b.postProteinG,
  };
}
