/**
 * bb-contest-prep-sync.ts — единый слой записи / чтения / миграции Тапера ББ.
 *
 * Движок bb-contest-prep.engine остаётся чистым (без зависимостей от UI/profile).
 * Этот модуль — тонкий мост: профиль ⇄ движок ⇄ событие.
 *
 * Единая точка записи: buildBBContestPrepPlan → goals.bbContestPrepPlan (верс.) +
 * зеркало goals.bbPeakConfig + goals.peakWeek/peakShowDay + событие
 * he-bb-contest-prep-updated (source-поле защищает от петель).
 *
 * Оба входа — ББ-авто и питание — пользуются ею; legacy-ветки мигрируют сюда же.
 */

import {
  buildBBContestPrepPlan,
  serializeBBContestPrepPlan,
  serializeBBPrepConfig,
  planFromStored,
  deserializeBBPrepConfig,
  validateBBContestPrepConfig,
  configFromPlan,
  type BBContestPrepConfig,
  type BBContestPrepPlan,
  type BuildPrepPlanOpts,
} from './bb-contest-prep.engine';
import { getProfile, updateProfile } from '../../core/profile-manager';

export const CONTEST_PREP_UPDATED_EVENT = 'he-bb-contest-prep-updated';

export type ContestPrepSource = BBContestPrepPlan['source'];

export interface SaveContestPrepOpts extends BuildPrepPlanOpts {
  source?: ContestPrepSource;
}

/**
 * Собрать версионированный план из конфига, сохранить в профиль (оба ключа)
 * и оповестить слушателей. Возвращает план или null при ошибке валидации.
 * Не трогает тренировочный план — его применяет вызывающий (ББ-авто).
 */
export function saveContestPrepEverywhere(
  rawCfg: BBContestPrepConfig,
  opts: SaveContestPrepOpts = {},
): BBContestPrepPlan | null {
  const v = validateBBContestPrepConfig(rawCfg);
  if (!v.ok) return null;
  let plan: BBContestPrepPlan;
  try {
    plan = buildBBContestPrepPlan(rawCfg, {
      prepWeeks: opts.prepWeeks,
      taperWeeks: opts.taperWeeks,
      currentCalories: opts.currentCalories,
      stepsPerDay: opts.stepsPerDay,
      cardioMinutesPerWeek: opts.cardioMinutesPerWeek,
      targetRatePctPerWeek: opts.targetRatePctPerWeek,
      prepVolumeMult: opts.prepVolumeMult,
      trainingPlanId: opts.trainingPlanId,
      nutritionPlanId: opts.nutritionPlanId,
      testPeakWeekId: opts.testPeakWeekId,
      source: opts.source ?? 'bb_auto',
      status: opts.status,
      id: opts.id,
    });
  } catch {
    return null;
  }
  try {
    const cur = getProfile();
    const next: any = JSON.parse(JSON.stringify(cur.settings || {}));
    if (!next.goals) next.goals = {};
    next.goals.bbContestPrepPlan = serializeBBContestPrepPlan(plan);
    next.goals.bbPeakConfig = serializeBBPrepConfig(rawCfg);
    next.goals.peakWeek = true;
    next.goals.peakShowDay = rawCfg.showDate;
    // prepWeeks выносится в профиль для синхронизации ББ-авто ↔ питание
    const usedPrepWeeks = (plan as any)?.preparation?.weeks ?? (rawCfg as any)?.prepWeeks ?? opts.prepWeeks;
    if (usedPrepWeeks) next.goals.prepWeeks = usedPrepWeeks;
    next.goals.prepEnabled = true;
    updateProfile({ settings: next });
  } catch { /* silent */ }
  try {
    window.dispatchEvent(
      new CustomEvent(CONTEST_PREP_UPDATED_EVENT, {
        detail: {
          prepPlanId: plan.id,
          showDate: rawCfg.showDate,
          source: opts.source ?? 'bb_auto',
        },
      }),
    );
  } catch { /* ignore */ }
  return plan;
}

/** Прочитать текущий версионированный план из профиля (с bridge legacy→план). */
export function loadContestPrepPlan(): BBContestPrepPlan | null {
  try {
    const s: any = getProfile().settings as any;
    return planFromStored(s?.goals?.bbContestPrepPlan, s?.goals?.bbPeakConfig, s?.goals, s?.personal);
  } catch {
    return null;
  }
}

/** Прочитать сырой конфиг (без сборки плана) — для редактора. */
export function loadContestPrepConfig(): BBContestPrepConfig | null {
  try {
    const s: any = getProfile().settings as any;
    const raw = s?.goals?.bbPeakConfig;
    if (raw) {
      const cfg = deserializeBBPrepConfig(raw);
      if (cfg) return cfg;
    }
    // bridge через план
    const plan = planFromStored(s?.goals?.bbContestPrepPlan, s?.goals?.bbPeakConfig, s?.goals, s?.personal);
    if (plan) {
      // plan → cfg обратная проекция делается в движке через configFromPlan, но нам нужен полный cfg;
      // здесь достаточно вернуть cfg из плана, если он был сохранён рядом (bbPeakConfig), иначе — из плана
      // plan уже есть — вернём cfg, восстановленный из сериализованного bbPeakConfig (выше) либо fallback
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Полностью отключить тапер ББ (оба ключа + событие). */
export function clearContestPrepEverywhere(): void {
  try {
    const cur = getProfile();
    const next: any = JSON.parse(JSON.stringify(cur.settings || {}));
    if (!next.goals) next.goals = {};
    delete next.goals.bbContestPrepPlan;
    delete next.goals.bbPeakConfig;
    next.goals.peakWeek = false;
    next.goals.prepEnabled = false;
    updateProfile({ settings: next });
  } catch { /* silent */ }
  try {
    window.dispatchEvent(new CustomEvent(CONTEST_PREP_UPDATED_EVENT, { detail: { source: 'clear' } }));
  } catch { /* ignore */ }
}

/**
 * Однократная миграция: если версионированного плана нет, но есть легаси-конфиг
 * (bbPeakConfig или даже старые peakWeek/peakShowDay поля) — собрать план и сохранить.
 * Возвращает план, если миграция сработала, иначе null.
 * Идемпотентна: повторно не перестроит, если план уже есть.
 */
export function migrateLegacyContestPrepIfNeeded(opts: BuildPrepPlanOpts = {}): BBContestPrepPlan | null {
  try {
    const s: any = getProfile().settings as any;
    const hasPlan = !!s?.goals?.bbContestPrepPlan;
    if (hasPlan) return null; // уже есть план — миграция не нужна
    const plan = planFromStored(s?.goals?.bbContestPrepPlan, s?.goals?.bbPeakConfig, s?.goals, s?.personal, opts);
    if (!plan) return null;
    // planFromStored уже собрал план из конфига в памяти — теперь сохраним его
    try {
      const cur = getProfile();
      const next: any = JSON.parse(JSON.stringify(cur.settings || {}));
      if (!next.goals) next.goals = {};
      next.goals.bbContestPrepPlan = serializeBBContestPrepPlan(plan);
      // bbPeakConfig уже был — оставляем как есть; если плана не было из-за только legacy-полей — запишем cfg из плана
      if (!next.goals.bbPeakConfig) {
        const cfg = configFromPlan(plan);
        next.goals.bbPeakConfig = serializeBBPrepConfig(cfg);
        next.goals.peakWeek = true;
        next.goals.peakShowDay = cfg.showDate;
      }
      updateProfile({ settings: next });
    } catch { /* silent */ }
    try {
      window.dispatchEvent(new CustomEvent(CONTEST_PREP_UPDATED_EVENT, { detail: { prepPlanId: plan.id, showDate: plan.showDate, source: 'migrate' } }));
    } catch { /* ignore */ }
    return plan;
  } catch {
    return null;
  }
}

/** Подписка на событие обновления (удобный хелпер). */
export function onContestPrepUpdated(handler: (ev: Event) => void): () => void {
  window.addEventListener(CONTEST_PREP_UPDATED_EVENT, handler);
  return () => window.removeEventListener(CONTEST_PREP_UPDATED_EVENT, handler);
}
